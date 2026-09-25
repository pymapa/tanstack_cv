import type { ReactNode } from 'react'

/** Page-width wrapper. Pages own their width so hero bands can run full-bleed. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-8 ${className}`}>{children}</div>
}
