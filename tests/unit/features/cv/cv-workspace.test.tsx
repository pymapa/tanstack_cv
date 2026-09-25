// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { CvDocument } from '~/cv/schema'
import type { CreateCvVariantResult, SaveCvResult } from '~/server/functions/cv'
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

const view = (revisionId = 'rev-1', data: CvDocument = buildCv()): CvView => ({
  id: 'cv-1',
  person: { id: 'person-1', fullName: 'Anna Example' },
  variant: 'default',
  isPrimary: true,
  revision: {
    id: revisionId,
    cvId: 'cv-1',
    number: 1,
    data,
    source: 'import',
    message: undefined,
    authorName: 'Import',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  revisions: [],
})

const translateProps = { onTranslate: vi.fn(), onTranslated: vi.fn() }

const setup = (
  onSave = vi.fn().mockResolvedValue({ ok: true, revisionId: 'rev-2', revisionNumber: 2 }),
  onSaveAsNew = vi.fn<() => Promise<CreateCvVariantResult>>().mockResolvedValue({ ok: true, cvId: 'cv-2' }),
) => {
  const onRefresh = vi.fn()
  render(
    <CvWorkspace cv={view()} onSave={onSave} onSaveAsNew={onSaveAsNew} onRefresh={onRefresh} {...translateProps} />,
  )
  return { onSave, onSaveAsNew, onRefresh, user: userEvent.setup() }
}

describe('CvWorkspace', () => {
  it('should render the page header with the title and the save and export controls', () => {
    setup()
    const header = within(screen.getByRole('banner'))

    expect(header.getByRole('heading', { level: 1, name: 'Anna Example' })).toBeInTheDocument()
    expect(header.getByText('default')).toBeInTheDocument()
    expect(header.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(header.getByRole('button', { name: 'Save as new version…' })).toBeInTheDocument()
    expect(header.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', '/api/cvs/cv-1/pdf')
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('banner'))
  })

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
    const { user, onRefresh } = setup(vi.fn().mockResolvedValue({ ok: false, error: 'CONFLICT' }))
    await user.type(screen.getByLabelText('Label'), 'X')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Someone saved a newer version')
    await user.click(screen.getByRole('button', { name: 'Load the latest version' }))
    expect(onRefresh).toHaveBeenCalled()
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

  it('should keep edits typed while a save is in flight', async () => {
    let finish: (result: SaveCvResult) => void = () => undefined
    const onSave = vi.fn(() => new Promise<SaveCvResult>((resolve) => (finish = resolve)))
    const onRefresh = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <CvWorkspace cv={view()} onSave={onSave} onSaveAsNew={vi.fn()} onRefresh={onRefresh} {...translateProps} />,
    )
    await user.type(screen.getByLabelText('Label'), ' Lead')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.type(screen.getByLabelText('Label'), ' More')
    await act(async () => {
      finish({ ok: true, revisionId: 'rev-2', revisionNumber: 2 })
      await Promise.resolve()
    })
    const saved = buildCv({ basics: { label: 'Software Architect Lead' } })
    rerender(
      <CvWorkspace
        cv={view('rev-2', saved)}
        onSave={onSave}
        onSaveAsNew={vi.fn()}
        onRefresh={onRefresh}
        {...translateProps}
      />,
    )

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Label')).toHaveValue('Software Architect Lead More')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('should clear the conflict and show the latest version after reloading', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: 'CONFLICT' })
    const user = userEvent.setup()
    const { rerender } = render(
      <CvWorkspace cv={view()} onSave={onSave} onSaveAsNew={vi.fn()} onRefresh={vi.fn()} {...translateProps} />,
    )
    await user.type(screen.getByLabelText('Label'), 'X')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    const latest = buildCv({ basics: { label: 'Saved elsewhere' } })
    rerender(
      <CvWorkspace
        cv={view('rev-9', latest)}
        onSave={onSave}
        onSaveAsNew={vi.fn()}
        onRefresh={vi.fn()}
        {...translateProps}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Label')).toHaveValue('Saved elsewhere')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  describe('save as new version', () => {
    // jsdom has no <dialog> modal support.
    beforeAll(() => {
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.open = true
      }
    })

    const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Save as new version…' }))
      return screen.getByRole('dialog', { name: 'Save as new version' })
    }

    it('should ask for a name when Save as new version is clicked', async () => {
      const { user } = setup()

      await openDialog(user)

      expect(screen.getByLabelText('Version name')).toHaveFocus()
    })

    it('should create a new version from the draft with the entered name', async () => {
      const { user, onSaveAsNew } = setup()
      await user.type(screen.getByLabelText('Label'), ' Lead')
      await openDialog(user)

      await user.type(screen.getByLabelText('Version name'), 'Client X{Enter}')

      expect(onSaveAsNew).toHaveBeenCalledWith({
        variant: 'Client X',
        data: expect.objectContaining({ basics: expect.objectContaining({ label: 'Software Architect Lead' }) }),
      })
    })

    it('should explain an invalid name without calling the server', async () => {
      const { user, onSaveAsNew } = setup()
      await openDialog(user)

      await user.type(screen.getByLabelText('Version name'), 'Client/X')
      await user.click(screen.getByRole('button', { name: 'Create version' }))

      expect(screen.getByLabelText('Version name')).toHaveAccessibleDescription(
        expect.stringContaining('Use only letters, digits, spaces, and hyphens.'),
      )
      expect(screen.getByLabelText('Version name')).toHaveAttribute('aria-invalid', 'true')
      expect(onSaveAsNew).not.toHaveBeenCalled()
    })

    it('should say so when the person already has a version with that name', async () => {
      const { user } = setup(undefined, vi.fn().mockResolvedValue({ ok: false, error: 'VARIANT_TAKEN' }))
      await openDialog(user)

      await user.type(screen.getByLabelText('Version name'), 'PM{Enter}')

      expect(screen.getByLabelText('Version name')).toHaveAccessibleDescription(
        expect.stringContaining('Anna Example already has a version with this name.'),
      )
    })

    it('should show a generic error when creating the version fails', async () => {
      const { user } = setup(undefined, vi.fn().mockRejectedValue(new Error('boom')))
      await openDialog(user)

      await user.type(screen.getByLabelText('Version name'), 'Client X{Enter}')

      expect(screen.getByLabelText('Version name')).toHaveAccessibleDescription(
        expect.stringContaining('Saving failed. Try again.'),
      )
    })

    it('should close without saving when Cancel is clicked', async () => {
      const { user, onSaveAsNew } = setup()
      await openDialog(user)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(onSaveAsNew).not.toHaveBeenCalled()
    })

    it('should not save the current version with Ctrl+S while the dialog is open', async () => {
      const { user, onSave } = setup()
      await user.type(screen.getByLabelText('Label'), 'X')
      await openDialog(user)

      await user.keyboard('{Control>}s{/Control}')

      expect(onSave).not.toHaveBeenCalled()
    })

    it('should keep the dialog open while the version is being created', async () => {
      const { user } = setup(undefined, vi.fn().mockReturnValue(new Promise(() => undefined)))
      const dialog = await openDialog(user)

      await user.type(screen.getByLabelText('Version name'), 'Client X{Enter}')
      await user.keyboard('{Escape}')

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(dialog).toBeInTheDocument()
    })

    it('should be unavailable when the CV has problems', async () => {
      const { user } = setup()

      await user.clear(screen.getByLabelText('Label'))

      expect(screen.getByRole('button', { name: 'Save as new version…' })).toBeDisabled()
    })
  })

  it('should offer to translate the saved CV into the other language', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Translate to Finnish' })).toBeEnabled()
  })

  it('should not translate while there are unsaved changes', async () => {
    const { user } = setup()

    await user.type(screen.getByLabelText('Label'), ' Lead')

    expect(screen.getByRole('button', { name: 'Translate to Finnish' })).toBeDisabled()
  })
})
