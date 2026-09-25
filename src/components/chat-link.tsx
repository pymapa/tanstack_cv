import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const isAppPath = (href: string) => href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')

export function ChatLink({ href, children }: { href?: string | undefined; children?: ReactNode }) {
  const router = useRouter()
  if (href === undefined || !isAppPath(href)) return <span>{children}</span>
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        void router.navigate({ href })
      }}
      className="font-medium text-teal underline"
    >
      {children}
    </a>
  )
}

export const chatMarkdownComponents = {
  a: ({ href, children }: { href?: string | undefined; children?: ReactNode }) => (
    <ChatLink href={href}>{children}</ChatLink>
  ),
  img: () => null,
}
