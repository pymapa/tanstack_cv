// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TranslateButton } from '~/features/translation/components/translate-button'
import type { TranslateCvResult } from '~/server/functions/cv'
import type { TranslationDraft } from '~/server/services/cv-translation'
import { buildCv } from '../../../fixtures/cv'

const draft: TranslationDraft = {
  sourceCvId: 'cv-1',
  sourceRevisionId: 'rev-1',
  sourceRevisionNumber: 1,
  from: 'en',
  to: 'fi',
  variant: 'default-fi',
  data: buildCv(),
}

const setup = (
  props: Partial<Parameters<typeof TranslateButton>[0]> = {},
  onTranslate = vi.fn<() => Promise<TranslateCvResult>>().mockResolvedValue({ ok: true, draft }),
) => {
  const onTranslated = vi.fn()
  render(
    <TranslateButton
      language="en"
      unsavedChanges={false}
      onTranslate={onTranslate}
      onTranslated={onTranslated}
      {...props}
    />,
  )
  return { onTranslate, onTranslated, user: userEvent.setup() }
}

describe('TranslateButton', () => {
  it('should offer Finnish for an English CV and English for a Finnish one', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Translate to Finnish' })).toBeInTheDocument()
  })

  it('should offer English for a Finnish CV', () => {
    setup({ language: 'fi' })
    expect(screen.getByRole('button', { name: 'Translate to English' })).toBeInTheDocument()
  })

  it('should hand over the draft for review when the translation is ready', async () => {
    const { user, onTranslated } = setup()

    await user.click(screen.getByRole('button', { name: 'Translate to Finnish' }))

    expect(onTranslated).toHaveBeenCalledWith(draft)
  })

  it('should show progress and block a second click while translating', async () => {
    const { user, onTranslate } = setup(
      {},
      vi.fn(() => new Promise<TranslateCvResult>(() => undefined)),
    )

    await user.click(screen.getByRole('button', { name: 'Translate to Finnish' }))

    const busy = screen.getByRole('button', { name: /Translating/ })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(onTranslate).toHaveBeenCalledTimes(1)
  })

  it('should explain that the saved version is translated when there are unsaved changes', () => {
    setup({ unsavedChanges: true })

    expect(screen.getByRole('button', { name: 'Translate to Finnish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Translate to Finnish' })).toHaveAccessibleDescription(
      'Save your changes first. The translation uses the saved version.',
    )
  })

  it.each([
    ['AI_UNAVAILABLE', 'Translation isn’t available right now. Your CV is unchanged.'],
    ['AI_INVALID_OUTPUT', 'The translation couldn’t be used. Try again.'],
  ] as const)('should explain a %s failure', async (error, message) => {
    const { user, onTranslated } = setup({}, vi.fn().mockResolvedValue({ ok: false, error }))

    await user.click(screen.getByRole('button', { name: 'Translate to Finnish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(onTranslated).not.toHaveBeenCalled()
  })

  it('should explain a failed request', async () => {
    const { user } = setup({}, vi.fn().mockRejectedValue(new Error('network')))

    await user.click(screen.getByRole('button', { name: 'Translate to Finnish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Translation failed. Try again.')
  })

  it('should not open the review when the CV was edited while translating', async () => {
    let finish: (result: TranslateCvResult) => void = () => undefined
    const onTranslate = vi.fn(() => new Promise<TranslateCvResult>((resolve) => (finish = resolve)))
    const onTranslated = vi.fn()
    const user = userEvent.setup()
    const props = { language: 'en' as const, onTranslate, onTranslated }
    const { rerender } = render(<TranslateButton {...props} unsavedChanges={false} />)
    await user.click(screen.getByRole('button', { name: 'Translate to Finnish' }))

    rerender(<TranslateButton {...props} unsavedChanges />)
    await act(async () => {
      finish({ ok: true, draft })
      await Promise.resolve()
    })

    expect(onTranslated).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('You changed the CV while it was being translated.')
  })
})
