import { useState } from 'react'
import { formatDateTime } from '~/lib/format'
import type { RevisionSummary } from '~/server/repositories/cv-repository'

const SOURCE_LABEL: Record<RevisionSummary['source'], string> = {
  import: 'Imported',
  manual: 'Edited',
  ai: 'AI-assisted edit',
  restore: 'Restored',
  duplicate: 'Created from another version',
}

type Props = Readonly<{
  revisions: readonly RevisionSummary[]
  onRestore: (revisionId: string) => void
  restoreDisabled?: boolean
}>

export function RevisionList({ revisions, onRestore, restoreDisabled = false }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null)
  if (revisions.length === 0) return null
  const headId = revisions[0]?.id
  return (
    <details className="mt-10 border-t border-line pt-6">
      <summary className="cursor-pointer text-xl font-light tracking-tight">History ({revisions.length})</summary>
      <ol className="mt-4 flex flex-col gap-3">
        {revisions.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 text-sm">
            <div className="flex gap-4">
              <span className="w-10 shrink-0 font-medium tabular-nums">#{r.number}</span>
              <span className="flex-1">
                <span className="font-medium">{SOURCE_LABEL[r.source]}</span> by {r.authorName}
                {r.message !== undefined && <span className="block text-muted">{r.message}</span>}
              </span>
              <time dateTime={r.createdAt} className="text-muted">
                {formatDateTime(r.createdAt)}
              </time>
              {r.id !== headId && confirming !== r.id && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(r.id)
                  }}
                  disabled={restoreDisabled}
                  aria-label={`Restore revision ${String(r.number)}`}
                  className="font-medium text-teal hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  Restore
                </button>
              )}
            </div>
            {confirming === r.id && (
              <div
                role="group"
                aria-label={`Restore revision ${String(r.number)}?`}
                className="ml-14 flex items-center gap-4"
              >
                <p className="flex-1 text-muted">
                  This saves revision {r.number} as a new revision. Unsaved changes are discarded. Later revisions stay
                  in the history.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null)
                    onRestore(r.id)
                  }}
                  disabled={restoreDisabled}
                  className="font-medium text-teal hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  Yes, restore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null)
                  }}
                  className="text-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
