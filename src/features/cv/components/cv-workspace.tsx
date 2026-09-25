import { Link, useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container } from '~/components/container'
import type { CvDocument } from '~/cv/schema'
import { CvEditor } from '~/features/editor/cv-editor'
import { validateCv } from '~/features/editor/validation'
import type { SaveCvResult } from '~/server/functions/cv'
import type { CvView } from '~/server/repositories/cv-repository'
import { CvPreview } from './cv-preview'
import { RevisionList } from './revision-list'
import { UnsavedChangesDialog } from './unsaved-changes-dialog'

export type SaveRequest = Readonly<{ baseRevisionId: string; data: CvDocument }>

type Props = Readonly<{
  cv: CvView
  onSave: (request: SaveRequest) => Promise<SaveCvResult>
  onReload: () => void
}>

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; revisionNumber: number }
  | { kind: 'conflict' }
  | { kind: 'error' }

const sameCv = (a: CvDocument, b: CvDocument): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

export function CvWorkspace({ cv, onSave, onReload }: Props) {
  const [draft, setDraft] = useState<CvDocument>(cv.revision.data)
  const [base, setBase] = useState({ id: cv.revision.id, data: cv.revision.data })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  // A new revision arrived from the server (after save or reload): make it the new baseline.
  // Adjusted during render (not in an effect), as React recommends for prop-driven resets.
  const [seenRevisionId, setSeenRevisionId] = useState(cv.revision.id)
  if (cv.revision.id !== seenRevisionId) {
    setSeenRevisionId(cv.revision.id)
    setBase({ id: cv.revision.id, data: cv.revision.data })
    setDraft(cv.revision.data)
  }

  const dirty = !sameCv(draft, base.data)
  const issues = useMemo(() => validateCv(draft), [draft])
  const canSave = dirty && issues.length === 0 && saveState.kind !== 'saving'

  const save = useCallback(async () => {
    if (!canSave) return
    setSaveState({ kind: 'saving' })
    try {
      const result = await onSave({ baseRevisionId: base.id, data: draft })
      if (result.ok) {
        setBase({ id: result.revisionId, data: draft })
        setSaveState({ kind: 'saved', revisionNumber: result.revisionNumber })
      } else {
        setSaveState({ kind: result.error === 'CONFLICT' ? 'conflict' : 'error' })
      }
    } catch {
      setSaveState({ kind: 'error' })
    }
  }, [canSave, onSave, base.id, draft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [save])

  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: dirty, withResolver: true })

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-white">
        <Container className="flex items-center gap-6 py-4">
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="text-sm">
              <Link to="/" className="font-medium">
                Search
              </Link>
              <span className="px-2 text-muted" aria-hidden="true">
                /
              </span>
              <Link to="/people/$personId" params={{ personId: cv.person.id }} className="font-medium">
                {cv.person.fullName}
              </Link>
            </nav>
            <h1 className="mt-1 truncate text-3xl" tabIndex={-1}>
              {cv.person.fullName} <span className="text-muted">· {cv.variant}</span>
            </h1>
          </div>
          <SaveStatus state={saveState} dirty={dirty} issueCount={issues.length} />
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
        </Container>
        {saveState.kind === 'conflict' && (
          <Container className="pb-4">
            <div
              role="alert"
              className="flex items-center gap-4 rounded-card border border-danger/30 bg-white p-4 text-sm"
            >
              <p className="flex-1">
                <strong className="font-semibold">Someone saved a newer version of this CV.</strong> Your changes are
                still here. Load the latest version to see theirs (your edits will be discarded), or copy what you need
                first.
              </p>
              <button
                type="button"
                onClick={onReload}
                className="font-medium text-teal hover:underline"
                data-testid="cv-reload"
              >
                Load the latest version
              </button>
            </div>
          </Container>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,640px)_minmax(0,1fr)]">
        <section aria-label="Edit CV" className="min-h-0 overflow-y-auto border-r border-line bg-white px-8 py-6">
          <CvEditor value={draft} onChange={setDraft} issues={issues} />
          <RevisionList revisions={cv.revisions} />
        </section>
        <section aria-label="PDF preview" className="flex min-h-0 flex-col bg-mist">
          <div className="flex items-center justify-between px-8 pb-2 pt-4">
            <h2 className="eyebrow">Preview</h2>
            <a
              href={`/api/cvs/${cv.id}/pdf`}
              className="cta-underline text-sm text-ink"
              data-testid="cv-download-pdf"
              {...(dirty ? { 'aria-describedby': 'pdf-saved-note' } : {})}
            >
              Download PDF
            </a>
          </div>
          {dirty && (
            <p id="pdf-saved-note" className="px-8 pb-2 text-xs text-muted">
              The PDF uses the last saved version. Save first to include your changes.
            </p>
          )}
          <div className="min-h-0 flex-1 px-8 pb-6">
            <CvPreview cv={draft} />
          </div>
        </section>
      </div>

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
