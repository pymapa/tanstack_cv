// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChatPanelProps } from '~/components/chat-panel'
import type { CvDocument } from '~/cv/schema'
import { NewCvWorkspace } from '~/features/cv/components/new-cv-workspace'
import type { CreateCvResult } from '~/server/functions/cv'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useBlocker: (options: { shouldBlockFn: () => boolean }) => {
    blocker.shouldBlock = options.shouldBlockFn
    return { status: 'idle', proceed: vi.fn(), reset: vi.fn() }
  },
}))

const blocker: { shouldBlock: () => boolean } = { shouldBlock: () => false }

const chat: { props: ChatPanelProps | null } = { props: null }
vi.mock('~/components/chat-panel', () => ({
  ChatPanel: (props: ChatPanelProps) => {
    chat.props = props
    return <section aria-label={props.title} />
  },
}))

// The editor and preview have their own tests; here they are thin stand-ins.
vi.mock('~/features/editor/cv-editor', () => ({
  CvEditor: ({
    value,
    onChange,
    nameEditable,
  }: {
    value: CvDocument
    onChange: (cv: CvDocument) => void
    nameEditable: boolean
  }) => (
    <label>
      Name
      <input
        value={value.basics.name}
        readOnly={!nameEditable}
        onChange={(e) => {
          onChange({ ...value, basics: { ...value.basics, name: e.target.value } })
        }}
      />
    </label>
  ),
}))
vi.mock('~/features/cv/components/cv-preview', () => ({ CvPreview: () => <div>preview</div> }))

type OnCreate = (data: CvDocument) => Promise<CreateCvResult>

const setup = (onCreate: OnCreate = vi.fn<OnCreate>().mockResolvedValue({ ok: true, cvId: 'cv-9' })) => {
  const onCreated = vi.fn()
  render(<NewCvWorkspace cvYear="2026" onCreate={onCreate} onCreated={onCreated} />)
  return { onCreate, onCreated, user: userEvent.setup() }
}

const runTool = async (name: string, input: unknown) => {
  const tool = chat.props?.tools?.find((t) => t.name === name)
  if (tool?.execute === undefined) throw new Error(`no tool ${name}`)
  let result: unknown
  await act(async () => {
    result = await (tool.execute as (i: unknown) => unknown)(input)
  })
  return result
}

describe('NewCvWorkspace', () => {
  it('should start from an empty form with the CV builder chat next to it', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'New CV' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CV builder' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('readonly')
  })

  it('should not allow creating the CV while the name is missing', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Create CV' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Add a name to create the CV.')
  })

  it('should create the CV from the draft and open it', async () => {
    const { user, onCreate, onCreated } = setup()
    await user.type(screen.getByLabelText('Name'), 'Mia Newcomer')

    await user.click(screen.getByRole('button', { name: 'Create CV' }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ basics: expect.objectContaining({ name: 'Mia Newcomer' }) }),
    )
    expect(onCreated).toHaveBeenCalledWith('cv-9')
  })

  it('should explain when creating the CV fails', async () => {
    const { user, onCreated } = setup(vi.fn<OnCreate>().mockRejectedValue(new Error('network')))
    await user.type(screen.getByLabelText('Name'), 'Mia Newcomer')

    await user.click(screen.getByRole('button', { name: 'Create CV' }))

    expect(screen.getByRole('status')).toHaveTextContent('Creating the CV failed. Try again.')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('should let the builder agent fill in the form and read back what the user typed', async () => {
    const { user } = setup()

    await runTool('updateDraft', { basics: { name: 'Mia Newcomer', label: 'Data Engineer' } })

    expect(screen.getByLabelText('Name')).toHaveValue('Mia Newcomer')
    await user.type(screen.getByLabelText('Name'), ' Jr')
    expect(await runTool('readDraft', {})).toMatchObject({
      basics: { name: 'Mia Newcomer Jr', label: 'Data Engineer' },
    })
  })

  it('should talk to the CV builder agent and attach files as old CVs', () => {
    setup()

    expect(chat.props).toMatchObject({
      title: 'CV builder',
      endpoint: '/api/cv-builder-chat',
      attachment: { tag: 'old_cv' },
    })
  })

  it('should not warn about leaving when an edit was undone', async () => {
    const { user } = setup()

    await user.type(screen.getByLabelText('Name'), 'M')
    expect(blocker.shouldBlock()).toBe(true)
    await user.clear(screen.getByLabelText('Name'))

    expect(blocker.shouldBlock()).toBe(false)
  })
})
