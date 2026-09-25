import { useId, useState, type ReactNode } from 'react'
import { PixelGrid } from '~/components/pixel-grid'
import { useEditor } from './editor-context'
import { issuesUnder } from './validation'

type Props = Readonly<{
  title: string
  /** Issue path prefixes this section owns, e.g. ["projects"]. Sections with issues open. */
  paths: readonly string[]
  count?: number
  defaultOpen?: boolean
  /** Controlled open state, for sections whose header action opens them. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  action?: ReactNode
  children: ReactNode
}>

/** Collapsible editor section: an h2 with a disclosure button, plus an optional header action. */
export function Section({ title, paths, count, defaultOpen = false, open, onOpenChange, action, children }: Props) {
  const { issues } = useEditor()
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const headingId = useId()
  const panelId = useId()
  const issueCount = paths.reduce((n, p) => n + issuesUnder(issues, p).length, 0)
  const isOpen = (open ?? localOpen) || issueCount > 0
  const toggle = () => {
    const next = !isOpen
    setLocalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <section aria-labelledby={headingId} className="border-b border-line py-4">
      <div className="flex items-center gap-3">
        <h2 id={headingId} className="flex-1 text-xl">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded text-left font-light tracking-tight"
          >
            <Chevron open={isOpen} />
            <span>{title}</span>
            {count !== undefined && (
              <span className="rounded-full bg-mist px-2 text-xs font-medium tabular-nums text-muted">{count}</span>
            )}
            {issueCount > 0 && (
              <span className="rounded-full bg-danger px-2 text-xs font-semibold text-white">
                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
              </span>
            )}
          </button>
        </h2>
        {action}
      </div>
      <div id={panelId} hidden={!isOpen} className="pt-4">
        {isOpen && children}
      </div>
    </section>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SectionIntro({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2 text-xs text-muted">
      <PixelGrid size={9} />
      {children}
    </p>
  )
}
