// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CvDocument } from '~/cv/schema'
import { CvWorkspace } from '~/features/cv/components/cv-workspace'
import type { CvView } from '~/server/repositories/cv-repository'
import { buildCv } from '../../../fixtures/cv'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useBlocker: () => ({ status: 'idle', proceed: vi.fn(), reset: vi.fn() }),
}))

// The editor and preview have their own tests; here they are thin stand-ins.
vi.mock('~/features/editor/cv-editor', () => ({
  CvEditor: ({ value, onChange }: { value: CvDocument; onChange: (cv: CvDocument) => void }) => (
    <label>
      Label
      <input
        value={value.basics.label}
        onChange={(e) => {
          onChange({ ...value, basics: { ...value.basics, label: e.target.value } })
        }}
      />
    </label>
  ),
}))
vi.mock('~/features/editor/validation', () => ({
  validateCv: (cv: CvDocument) => (cv.basics.label === '' ? [{ path: 'basics.label', message: 'Required' }] : []),
}))
vi.mock('~/features/cv/components/cv-preview', () => ({ CvPreview: () => <div>preview</div> }))

const view = (): CvView => ({
  id: 'cv-1',
  person: { id: 'person-1', fullName: 'Anna Example' },
  variant: 'default',
  isPrimary: true,
  revision: {
    id: 'rev-1',
    cvId: 'cv-1',
    number: 1,
    data: buildCv(),
    source: 'import',
    message: undefined,
    authorName: 'Import',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  revisions: [],
})

const setup = (onSave = vi.fn().mockResolvedValue({ ok: true, revisionId: 'rev-2', revisionNumber: 2 })) => {
  const onReload = vi.fn()
  render(<CvWorkspace cv={view()} onSave={onSave} onReload={onReload} />)
  return { onSave, onReload, user: userEvent.setup() }
}

describe('CvWorkspace', () => {
  it('should show unsaved changes after an edit', async () => {
    const { user } = setup()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Label'), ' Lead')

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('should save the draft against the current revision when Save is clicked', async () => {
    const { user, onSave } = setup()
    await user.type(screen.getByLabelText('Label'), ' Lead')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRevisionId: 'rev-1',
        data: expect.objectContaining({ basics: expect.objectContaining({ label: 'Software Architect Lead' }) }),
      }),
    )
    expect(await screen.findByText('Saved as revision 2.')).toBeInTheDocument()
  })

  it('should save with Ctrl+S', async () => {
    const { user, onSave } = setup()
    await user.type(screen.getByLabelText('Label'), 'X')

    await user.keyboard('{Control>}s{/Control}')

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('should explain a conflict and offer to reload when someone saved first', async () => {
    const { user, onReload } = setup(vi.fn().mockResolvedValue({ ok: false, error: 'CONFLICT' }))
    await user.type(screen.getByLabelText('Label'), 'X')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Someone saved a newer version')
    await user.click(screen.getByRole('button', { name: 'Load the latest version' }))
    expect(onReload).toHaveBeenCalled()
  })

  it('should block saving and say why when the CV has problems', async () => {
    const { user, onSave } = setup()

    await user.clear(screen.getByLabelText('Label'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('1 problem to fix before saving')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('should keep Save disabled when nothing has changed', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
