import { useBlocker } from '@tanstack/react-router'
import { useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChatPanel } from '~/components/chat-panel'
import { AppHeaderView } from '~/components/app-header'
import { emptyCv, sameCv } from '~/cv/draft'
import type { CvDocument } from '~/cv/schema'
import { CvEditor } from '~/features/editor/cv-editor'
import { type EditorIssue, validateCv } from '~/features/editor/validation'
import { createCvBuilderClientTools } from '~/lib/ai/cv-builder-tools'
import type { CreateCvResult } from '~/server/functions/cv'
import { CvPreview } from './cv-preview'
import { UnsavedChangesDialog } from './unsaved-changes-dialog'

type Props = Readonly<{
  /** Year for the new CV's `meta` placeholder; the server sets the real one. */
  cvYear: string
  onCreate: (data: CvDocument) => Promise<CreateCvResult>
  /** Open the created CV. */
  onCreated: (cvId: string) => void
}>

type CreateState = { kind: 'idle' } | { kind: 'creating' } | { kind: 'error'; message: string }

const TOOL_LABELS: Record<string, string> = {
  readDraft: 'Reading the form',
  updateDraft: 'Filling in the form',
  checkBrand: 'Checking the style',
}

const OLD_CV_ATTACHMENT = {
  label: 'Attach your old CV',
  listLabel: 'Attached CVs',
  tag: 'old_cv',
  defaultRequest: 'Fill in the new CV from my old CV.',
} as const

const CREATE_ERRORS: Record<Extract<CreateCvResult, { ok: false }>['error'], string> = {
  ID_EXHAUSTED: 'No more people can be added yet. Ask an admin.',
}

const statusText = (issues: readonly EditorIssue[], state: CreateState): string => {
  if (state.kind === 'error') return state.message
  if (issues.some((i) => i.path === 'basics.name')) return 'Add a name to create the CV.'
  if (issues.length > 0)
    return `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} to fix before creating`
  return ''
}

const createDraftStore = (initial: CvDocument) => {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    initial,
    get: () => current,
    set: (next: CvDocument) => {
      current = next
      listeners.forEach((listener) => {
        listener()
      })
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** New CV: the CV builder chat, the form it fills in, and the live preview. */
export function NewCvWorkspace({ cvYear, onCreate, onCreated }: Props) {
  // The builder's tools run outside render and may update the draft twice in one turn, so the
  // draft lives in a small store that always returns the latest value.
  const [store] = useState(() => createDraftStore(emptyCv(cvYear)))
  const draft = useSyncExternalStore(store.subscribe, store.get, store.get)
  const builderTools = useMemo(() => createCvBuilderClientTools(store), [store])
  const [createState, setCreateState] = useState<CreateState>({ kind: 'idle' })
  const chatId = useId()

  const issues = useMemo(() => validateCv(draft), [draft])
  const dirty = !sameCv(draft, store.initial)
  const created = useRef(false)
  const canCreate = issues.length === 0 && createState.kind !== 'creating'

  const create = async () => {
    if (!canCreate) return
    setCreateState({ kind: 'creating' })
    try {
      const result = await onCreate(draft)
      if (result.ok) {
        created.current = true
        onCreated(result.cvId)
      } else {
        setCreateState({ kind: 'error', message: CREATE_ERRORS[result.error] })
      }
    } catch {
      setCreateState({ kind: 'error', message: 'Creating the CV failed. Try again.' })
    }
  }

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !created.current,
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  const status = statusText(issues, createState)

  return (
    <div className="flex h-screen flex-col">
      <AppHeaderView
        title={{ title: 'New CV' }}
        actions={
          <>
            <p
              role="status"
              aria-live="polite"
              className={`text-sm ${createState.kind === 'error' ? 'text-danger' : 'text-muted'}`}
            >
              {status}
            </p>
            <button
              type="button"
              onClick={() => void create()}
              disabled={!canCreate}
              className="rounded-card bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-ink/30"
              data-testid="cv-create"
            >
              {createState.kind === 'creating' ? 'Creating…' : 'Create CV'}
            </button>
          </>
        }
      />
      <main id="main" className="grid min-h-0 flex-1 grid-cols-[minmax(320px,380px)_minmax(480px,600px)_minmax(0,1fr)]">
        <ChatPanel
          id={chatId}
          title="CV builder"
          endpoint="/api/cv-builder-chat"
          tools={builderTools}
          toolLabels={TOOL_LABELS}
          intro={
            <>
              Drop your old CV here (PDF, .txt or .md) and I’ll fill in the form. Then I’ll ask a few questions so it
              reads like a Kipinä CV. No old CV? Tell me about your work and we’ll build it together.
            </>
          }
          placeholder="Answer or ask for changes…"
          attachment={OLD_CV_ATTACHMENT}
          className="min-h-0 border-r"
        />
        <section aria-label="Edit CV" className="min-h-0 overflow-y-auto border-r border-line bg-white px-8 py-6">
          <CvEditor value={draft} onChange={store.set} issues={issues} nameEditable />
        </section>
        <section aria-label="PDF preview" className="flex min-h-0 flex-col bg-mist">
          <div className="px-8 pb-2 pt-4">
            <h2 className="eyebrow">Preview</h2>
          </div>
          <div className="min-h-0 flex-1 px-8 pb-6">
            <CvPreview cv={draft} />
          </div>
        </section>
      </main>

      {blocker.status === 'blocked' && <UnsavedChangesDialog onStay={blocker.reset} onLeave={blocker.proceed} />}
    </div>
  )
}
