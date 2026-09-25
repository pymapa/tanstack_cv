import type { ReactNode } from 'react'
import { theme } from '../theme'

/** Small 3×3 logo-grid marker. Decorative. */
export function GridMark() {
  return (
    <span className="grid-mark" aria-hidden="true">
      {theme.grid.map((fill) => (
        <span key={fill} style={{ background: fill }} />
      ))}
    </span>
  )
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className === undefined ? 'section' : `section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function InlineList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="inline-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function Entry({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <li className="entry">
      <div className="entry__aside">{aside}</div>
      <div className="entry__body">{children}</div>
    </li>
  )
}

/** Drops empty strings/undefined; used to build " · "-joined meta lines. */
export const present = (values: ReadonlyArray<string | undefined>): string[] =>
  values.filter((v): v is string => v !== undefined && v.trim() !== '')

/** Unique by case-insensitive value, keeping first spelling. */
export const uniqueValues = (values: readonly string[]): string[] => [
  ...new Map(values.map((v) => [v.toLowerCase(), v])).values(),
]
