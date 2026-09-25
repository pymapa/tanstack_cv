// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CvDocument } from '~/cv/schema'
import { TranslationReview } from '~/features/translation/components/translation-review'
import type { SaveTranslationResult } from '~/server/functions/cv'
import type { TranslationDraft } from '~/server/services/cv-translation'
import { buildCv } from '../../../fixtures/cv'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useBlocker: () => ({ status: 'idle', proceed: vi.fn(), reset: vi.fn() }),
}))
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
vi.mock('~/features/cv/components/cv-preview', () => ({
  CvPreview: ({ cv }: { cv: CvDocument }) => <div data-testid="preview">{cv.basics.label}</div>,
}))

const original = buildCv()
const draft: TranslationDraft = {
  sourceCvId: 'cv-1',
  sourceRevisionId: 'rev-1',
  sourceRevisionNumber: 3,
  from: 'en',
  to: 'fi',
  variant: 'default-fi',
  data: buildCv({ basics: { label: 'Ohjelmistoarkkitehti' }, meta: { variant: 'default-fi' } }),
}

const setup = (onSave = vi.fn().mockResolvedValue({ ok: true, cvId: 'cv-2' } satisfies SaveTranslationResult)) => {
  const onSaved = vi.fn()
  const onDiscard = vi.fn()
  render(
    <TranslationReview
      person={{ id: 'person-1', fullName: 'Anna Example' }}
      sourceVariant="default"
      original={original}
      draft={draft}
      onSave={onSave}
      onSaved={onSaved}
      onDiscard={onDiscard}
    />,
  )
  return { onSave, onSaved, onDiscard, user: userEvent.setup() }
}

describe('TranslationReview', () => {
  it('should ask the user to review the machine translation before saving', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Finnish translation of default')
    expect(screen.getByRole('note')).toHaveTextContent('Review the translation before you save it')
    expect(screen.getByTestId('preview')).toHaveTextContent('Ohjelmistoarkkitehti')
  })

  it('should switch the preview between the translation and the original', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'Original' }))

    expect(screen.getByTestId('preview')).toHaveTextContent('Software Architect')
    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('should save the edited translation as a new version with the chosen name', async () => {
    const { user, onSave, onSaved } = setup()
    await user.type(screen.getByLabelText('Label'), ' (tarkistettu)')
    await user.clear(screen.getByLabelText('Name of the new version'))
    await user.type(screen.getByLabelText('Name of the new version'), 'PM-fi')

    await user.click(screen.getByRole('button', { name: 'Save as new version' }))

    expect(onSave).toHaveBeenCalledWith({
      variant: 'PM-fi',
      to: 'fi',
      data: expect.objectContaining({
        basics: expect.objectContaining({ label: 'Ohjelmistoarkkitehti (tarkistettu)' }),
      }) as CvDocument,
    })
    expect(onSaved).toHaveBeenCalledWith('cv-2')
  })

  it('should ask for another name when the version name is taken', async () => {
    const { user, onSaved } = setup(vi.fn().mockResolvedValue({ ok: false, error: 'VARIANT_TAKEN' }))

    await user.click(screen.getByRole('button', { name: 'Save as new version' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Anna Example already has a CV called “default-fi”. Pick another name.',
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('should not save while the CV has problems or the name is empty', async () => {
    const { user } = setup()

    await user.clear(screen.getByLabelText('Label'))
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled()

    await user.type(screen.getByLabelText('Label'), 'Arkkitehti')
    await user.clear(screen.getByLabelText('Name of the new version'))
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled()
  })

  it('should drop the translation when the user discards it', async () => {
    const { user, onDiscard, onSave } = setup()

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(onDiscard).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
