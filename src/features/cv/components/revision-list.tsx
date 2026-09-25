import { formatDateTime } from '~/lib/format'
import type { RevisionSummary } from '~/server/repositories/cv-repository'

const SOURCE_LABEL: Record<RevisionSummary['source'], string> = {
  import: 'Imported',
  manual: 'Edited',
  ai: 'AI-assisted edit',
  restore: 'Restored',
  duplicate: 'Created from another version',
}

export function RevisionList({ revisions }: { revisions: readonly RevisionSummary[] }) {
  if (revisions.length === 0) return null
  return (
    <details className="mt-10 border-t border-line pt-6">
      <summary className="cursor-pointer text-xl font-light tracking-tight">History ({revisions.length})</summary>
      <ol className="mt-4 flex flex-col gap-3">
        {revisions.map((r) => (
          <li key={r.id} className="flex gap-4 text-sm">
            <span className="w-10 shrink-0 font-medium tabular-nums">#{r.number}</span>
            <span className="flex-1">
              <span className="font-medium">{SOURCE_LABEL[r.source]}</span> by {r.authorName}
              {r.message !== undefined && <span className="block text-muted">{r.message}</span>}
            </span>
            <time dateTime={r.createdAt} className="text-muted">
              {formatDateTime(r.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </details>
  )
}
