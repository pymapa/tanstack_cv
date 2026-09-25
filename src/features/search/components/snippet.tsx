import type { SnippetSegment } from '~/cv/search'

/** Renders server-computed segments as text + <mark>; never parses HTML. */
export function Snippet({ segments }: { segments: readonly SnippetSegment[] }) {
  if (segments.length === 0) return null
  return (
    <p className="mt-3 text-sm leading-relaxed text-muted">
      {/* Segments are static per render, so position-based keys are stable. */}
      {segments.map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </p>
  )
}
