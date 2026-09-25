import { useEffect, useId, useRef, useState } from 'react'
import { LANGUAGE_NAMES, otherLanguage, type CvLanguage } from '~/cv/translation'
import type { TranslateCvResult } from '~/server/functions/cv'
import type { TranslateCvError, TranslationDraft } from '~/server/services/cv-translation'

type Props = Readonly<{
  /** The language of the saved CV. The button offers the other one. */
  language: CvLanguage
  unsavedChanges: boolean
  onTranslate: () => Promise<TranslateCvResult>
  onTranslated: (draft: TranslationDraft) => void
}>

const MESSAGES: Readonly<Record<TranslateCvError, string>> = {
  AI_UNAVAILABLE: 'Translation isn’t available right now. Your CV is unchanged.',
  AI_INVALID_OUTPUT: 'The translation couldn’t be used. Try again.',
  NOT_FOUND: 'This CV no longer exists.',
}

type State = { kind: 'idle' } | { kind: 'translating' } | { kind: 'failed'; message: string }

export function TranslateButton({ language, unsavedChanges, onTranslate, onTranslated }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const noteId = useId()
  const target = LANGUAGE_NAMES[otherLanguage(language)]
  const translating = state.kind === 'translating'
  // Read when the translation returns: edits made while waiting would be lost by opening the review.
  const editedMeanwhile = useRef(unsavedChanges)
  useEffect(() => {
    editedMeanwhile.current = unsavedChanges
  }, [unsavedChanges])

  const translate = async () => {
    setState({ kind: 'translating' })
    try {
      const result = await onTranslate()
      if (result.ok && editedMeanwhile.current) {
        setState({
          kind: 'failed',
          message: 'You changed the CV while it was being translated. Save your changes, then translate again.',
        })
      } else if (result.ok) {
        setState({ kind: 'idle' })
        onTranslated(result.draft)
      } else {
        setState({ kind: 'failed', message: MESSAGES[result.error] })
      }
    } catch {
      setState({ kind: 'failed', message: 'Translation failed. Try again.' })
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void translate()}
        disabled={unsavedChanges || translating}
        aria-busy={translating}
        {...(unsavedChanges ? { 'aria-describedby': noteId } : {})}
        className="rounded-card border border-ink px-4 py-2 text-sm font-medium text-ink hover:bg-mist disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-ink/40"
        data-testid="cv-translate"
      >
        {translating ? `Translating to ${target}…` : `Translate to ${target}`}
      </button>
      {unsavedChanges && (
        <p id={noteId} className="text-xs text-muted">
          Save your changes first. The translation uses the saved version.
        </p>
      )}
      {translating && (
        <p role="status" className="text-xs text-muted">
          This can take a minute.
        </p>
      )}
      {state.kind === 'failed' && (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      )}
    </div>
  )
}
