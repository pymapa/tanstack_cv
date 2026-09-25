import type { ReactNode } from 'react'
import { theme } from '../theme'

/** Small 3×3 logo-grid marker in front of section headings. Decorative. */
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
      <div className="section__head">
        <GridMark />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function Chips({ items, tint = false }: { items: readonly string[]; tint?: boolean }) {
  if (items.length === 0) return null
  return (
    <ul className="chips">
      {items.map((item) => (
        <li key={item} className={tint ? 'chip chip--tint' : 'chip'}>
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Drops empty strings/undefined; used to build " · "-joined meta lines. */
export const present = (values: ReadonlyArray<string | undefined>): string[] =>
  values.filter((v): v is string => v !== undefined && v.trim() !== '')

/** Unique by case-insensitive value, keeping first spelling. */
export const uniqueValues = (values: readonly string[]): string[] => [
  ...new Map(values.map((v) => [v.toLowerCase(), v])).values(),
]
