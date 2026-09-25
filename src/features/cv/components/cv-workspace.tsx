import { useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeaderView } from '~/components/app-header'
import { Container } from '~/components/container'
import { sameCv } from '~/cv/draft'
import type { CvDocument } from '~/cv/schema'
import { detectCvLanguage } from '~/cv/translation'
import { CvEditor } from '~/features/editor/cv-editor'
import { validateCv } from '~/features/editor/validation'
import { TranslateButton } from '~/features/translation/components/translate-button'
import type { CreateCvVariantResult, SaveCvResult, TranslateCvResult } from '~/server/functions/cv'
import type { CvView } from '~/server/repositories/cv-repository'
import type { TranslationDraft } from '~/server/services/cv-translation'
import { CvPreview } from './cv-preview'
import { RevisionList } from './revision-list'
import { SaveAsVersionDialog } from './save-as-version-dialog'
import { UnsavedChangesDialog } from './unsaved-changes-dialog'

export type SaveRequest = Readonly<{ baseRevisionId: string; data: CvDocument }>
export type SaveAsNewRequest = Readonly<{ variant: string; data: CvDocument }>

type Props = Readonly<{
  cv: CvView
  onSave: (request: SaveRequest) => Promise<SaveCvResult>
  onSaveAsNew: (request: SaveAsNewRequest) => Promise<CreateCvVariantResult>
  /** Reload the CV from the server: after a recorded save (history) and from the conflict banner. */
  onRefresh: () => void
  /** Machine-translates the saved revision into the other language. Saves nothing. */
  onTranslate: () => Promise<TranslateCvResult>
  /** Called with the translation, which the user then reviews. */
  onTranslated: (draft: TranslationDraft) => void
}>

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; revisionNumber: number }
  | { kind: 'conflict' }
  | { kind: 'error' }

export function CvWorkspace({ cv, onSave, onSaveAsNew, onRefresh, onTranslate, onTranslated }: Props) {
  const [draft, setDraft] = useState<CvDocument>(cv.revision.data)
  const [base, setBase] = useState({ id: cv.revision.id, data: cv.revision.data })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [naming, setNaming] = useState(false)

  // A new revision arrived from the server. If it's the one this workspace just saved, `base`
  // already points at it: keep the draft, which may hold edits typed during the save. Otherwise
  // (a reload after a conflict) make it the new baseline and clear the save state.
  // Adjusted during render (not in an effect), as React recommends for prop-driven resets.
  const [seenRevisionId, setSeenRevisionId] = useState(cv.revision.id)
  if (cv.revision.id !== seenRevisionId) {
    setSeenRevisionId(cv.revision.id)
    if (cv.revision.id !== base.id) {
      setBase({ id: cv.revision.id, data: cv.revision.data })
      setDraft(cv.revision.data)
      setSaveState({ kind: 'idle' })
    }
  }

  const dirty = !sameCv(draft, base.data)
  const issues = useMemo(() => validateCv(draft), [draft])
  const savedLanguage = useMemo(() => detectCvLanguage(base.data), [base.data])
  const canSave = dirty && issues.length === 0 && saveState.kind !== 'saving'
  const canSaveAsNew = issues.length === 0 && saveState.kind !== 'saving'

  const save = useCallback(async () => {
    if (!canSave) return
    setSaveState({ kind: 'saving' })
    try {
      // `draft` is this render's value: keystrokes during the request land in a newer draft and stay unsaved.
      const result = await onSave({ baseRevisionId: base.id, data: draft })
      if (result.ok) {
        setBase({ id: result.revisionId, data: draft })
        setSaveState({ kind: 'saved', revisionNumber: result.revisionNumber })
        onRefresh()
      } else {
        setSaveState({ kind: result.error === 'CONFLICT' ? 'conflict' : 'error' })
      }
    } catch {
      setSaveState({ kind: 'error' })
    }
  }, [canSave, onSave, onRefresh, base.id, draft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!naming) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [save, naming])

  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: dirty, withResolver: true })

  return (
    <div className="flex h-screen flex-col">
      <AppHeaderView
        title={{ title: cv.person.fullName, subtitle: cv.variant, personId: cv.person.id }}
        actions={
          <>
            <TranslateButton
              language={savedLanguage}
              unsavedChanges={dirty}
              onTranslate={onTranslate}
              onTranslated={onTranslated}
            />
            <SaveStatus state={saveState} dirty={dirty} issueCount={issues.length} />
            <div className="flex flex-col items-end">
              <a
                href={`/api/cvs/${cv.id}/pdf`}
                // `download` keeps the unsaved-changes guard (beforeunload) from firing.
                download
                className="cta-underline text-sm text-ink"
                data-testid="cv-download-pdf"
                {...(dirty ? { 'aria-describedby': 'pdf-saved-note' } : {})}
              >
                Download PDF
              </a>
              {dirty && (
                <p id="pdf-saved-note" className="mt-1 text-xs text-muted">
                  The PDF uses the last saved version.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setNaming(true)
              }}
              disabled={!canSaveAsNew}
              className="rounded-card border border-line px-5 py-2.5 text-sm font-medium hover:border-ink disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
              data-testid="cv-save-as-new"
            >
              Save as new version…
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              aria-keyshortcuts="Control+S Meta+S"
              className="rounded-card bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-ink/30"
              data-testid="cv-save"
            >
              {saveState.kind === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {saveState.kind === 'conflict' && (
          <div className="border-b border-line bg-white">
            <Container className="py-4">
              <div
                role="alert"
                className="flex items-center gap-4 rounded-card border border-danger/30 bg-white p-4 text-sm"
              >
                <p className="flex-1">
                  <strong className="font-semibold">Someone saved a newer version of this CV.</strong> Your changes are
                  still here. Load the latest version to see theirs (your edits will be discarded), or copy what you
                  need first.
                </p>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="font-medium text-teal hover:underline"
                  data-testid="cv-reload"
                >
                  Load the latest version
                </button>
              </div>
            </Container>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,640px)_minmax(0,1fr)]">
          <section aria-label="Edit CV" className="min-h-0 overflow-y-auto border-r border-line bg-white px-8 py-6">
            <CvEditor value={draft} onChange={setDraft} issues={issues} />
            <RevisionList revisions={cv.revisions} />
          </section>
          <section aria-label="PDF preview" className="flex min-h-0 flex-col bg-mist">
            <h2 className="eyebrow px-8 pb-2 pt-4">Preview</h2>
            <div className="min-h-0 flex-1 px-8">
              <CvPreview cv={draft} />
            </div>
          </section>
        </div>
      </main>

      {naming && (
        <SaveAsVersionDialog
          personName={cv.person.fullName}
          onSubmit={(variant) => onSaveAsNew({ variant, data: draft })}
          onCancel={() => {
            setNaming(false)
          }}
        />
      )}
      {blocker.status === 'blocked' && <UnsavedChangesDialog onStay={blocker.reset} onLeave={blocker.proceed} />}
    </div>
  )
}

function SaveStatus({ state, dirty, issueCount }: { state: SaveState; dirty: boolean; issueCount: number }) {
  const text =
    issueCount > 0
      ? `${issueCount} ${issueCount === 1 ? 'problem' : 'problems'} to fix before saving`
      : state.kind === 'error'
        ? 'Saving failed. Try again.'
        : dirty
          ? 'Unsaved changes'
          : state.kind === 'saved'
            ? `Saved as revision ${state.revisionNumber}.`
            : ''
  const tone = issueCount > 0 || state.kind === 'error' ? 'text-danger' : 'text-muted'
  return (
    <p role="status" aria-live="polite" className={`text-sm ${tone}`}>
      {text}
    </p>
  )
}
