import { Link, useBlocker } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { Container } from '~/components/container'
import type { CvDocument } from '~/cv/schema'
import { LANGUAGE_NAMES, MAX_VARIANT_LENGTH, type CvLanguage } from '~/cv/translation'
import { CvPreview } from '~/features/cv/components/cv-preview'
import { UnsavedChangesDialog } from '~/features/cv/components/unsaved-changes-dialog'
import { CvEditor } from '~/features/editor/cv-editor'
import { validateCv } from '~/features/editor/validation'
import type { SaveTranslationResult } from '~/server/functions/cv'
import type { CvView } from '~/server/repositories/cv-repository'
import type { TranslationDraft } from '~/server/services/cv-translation'

export type SaveTranslationRequest = Readonly<{ variant: string; to: CvLanguage; data: CvDocument }>

type Props = Readonly<{
  person: CvView['person']
  sourceVariant: string
  original: CvDocument
  draft: TranslationDraft
  onSave: (request: SaveTranslationRequest) => Promise<SaveTranslationResult>
  onSaved: (cvId: string) => void
  onDiscard: () => void
}>

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'failed'; message: string } | { kind: 'saved' }

/**
 * Review step for a machine translation. The user reads and fixes the translated draft
 * next to the original, then saves it as a new CV version. The source CV is never changed.
 */
export function TranslationReview({ person, sourceVariant, original, draft, onSave, onSaved, onDiscard }: Props) {
  const [data, setData] = useState<CvDocument>(draft.data)
  const [variant, setVariant] = useState(draft.variant)
  const [showOriginal, setShowOriginal] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const issues = useMemo(() => validateCv(data), [data])
  const language = LANGUAGE_NAMES[draft.to]
  const name = variant.trim()
  const canSave = issues.length === 0 && name !== '' && saveState.kind !== 'saving'

  // A ref, so the navigation that onSaved starts in the same tick already sees it.
  const saved = useRef(false)

  const save = async () => {
    if (!canSave) return
    setSaveState({ kind: 'saving' })
    try {
      const result = await onSave({ variant: name, to: draft.to, data })
      if (result.ok) {
        saved.current = true
        setSaveState({ kind: 'saved' })
        onSaved(result.cvId)
      } else if (result.error === 'VARIANT_TAKEN') {
        setSaveState({
          kind: 'failed',
          message: `${person.fullName} already has a CV called “${name}”. Pick another name.`,
        })
      } else {
        setSaveState({ kind: 'failed', message: 'The original CV no longer exists.' })
      }
    } catch {
      setSaveState({ kind: 'failed', message: 'Saving failed. Try again.' })
    }
  }

  // The translation only lives in this page until it is saved.
  const blocker = useBlocker({
    shouldBlockFn: () => !saved.current,
    enableBeforeUnload: saveState.kind !== 'saved',
    withResolver: true,
  })

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="border-b border-line bg-white">
        <Container className="flex items-end gap-6 py-4">
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="text-sm">
              <Link to="/" className="font-medium">
                Search
              </Link>
              <span className="px-2 text-muted" aria-hidden="true">
                /
              </span>
              <Link to="/people/$personId" params={{ personId: person.id }} className="font-medium">
                {person.fullName}
              </Link>
            </nav>
            <h1 className="mt-1 truncate text-3xl" tabIndex={-1}>
              {person.fullName}{' '}
              <span className="text-muted">
                · {language} translation of {sourceVariant}
              </span>
            </h1>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name of the new version
            <input
              value={variant}
              onChange={(e) => {
                setVariant(e.target.value)
              }}
              maxLength={MAX_VARIANT_LENGTH}
              className="rounded-card border border-line px-3 py-2 font-normal"
              data-testid="translation-variant"
            />
          </label>
          <button
            type="button"
            onClick={onDiscard}
            className="px-2 py-2.5 text-sm font-medium text-teal hover:underline"
            data-testid="translation-discard"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="rounded-card bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-ink/30"
            data-testid="translation-save"
          >
            {saveState.kind === 'saving' ? 'Saving…' : 'Save as new version'}
          </button>
        </Container>
        <Container className="pb-4">
          <div role="note" className="rounded-card border-l-4 border-lime bg-mist p-4 text-sm">
            <p>
              <strong className="font-semibold">Review the translation before you save it.</strong> It was made by AI
              from revision {draft.sourceRevisionNumber} of “{sourceVariant}”. Read it through and fix anything that
              sounds off, especially job titles and industry terms. Names, clients, dates and technologies are kept as
              they were. Saving creates a new version; “{sourceVariant}” stays as it is.
            </p>
          </div>
          {issues.length > 0 && (
            <p role="status" className="mt-2 text-sm text-danger">
              {issues.length} {issues.length === 1 ? 'problem' : 'problems'} to fix before saving
            </p>
          )}
          {saveState.kind === 'failed' && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {saveState.message}
            </p>
          )}
        </Container>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,640px)_minmax(0,1fr)]">
        <section
          aria-label={`Edit ${language} translation`}
          className="min-h-0 overflow-y-auto border-r border-line bg-white px-8 py-6"
        >
          <CvEditor value={data} onChange={setData} issues={issues} />
        </section>
        <section aria-label="PDF preview" className="flex min-h-0 flex-col bg-mist">
          <div className="flex items-center gap-4 px-8 pb-2 pt-4">
            <h2 className="eyebrow">Preview</h2>
            <div role="group" aria-label="Preview version" className="flex gap-1 text-sm">
              {[
                { label: 'Translation', value: false },
                { label: 'Original', value: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={showOriginal === option.value}
                  onClick={() => {
                    setShowOriginal(option.value)
                  }}
                  className="rounded-card px-3 py-1 aria-pressed:bg-ink aria-pressed:text-white"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 px-8 pb-6">
            <CvPreview cv={showOriginal ? original : data} />
          </div>
        </section>
      </div>

      {blocker.status === 'blocked' && <UnsavedChangesDialog onStay={blocker.reset} onLeave={blocker.proceed} />}
    </div>
  )
}
