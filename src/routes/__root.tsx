/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { AppHeader } from '~/components/app-header'
import CvChatWidget from '~/components/CvChatWidget'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'CV bank · Kipinä' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-mist text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-lime focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <AppHeader />
        <main id="main" className="pb-24">
          {children}
        </main>
        <CvChatWidget />
        <HydrationMarker />
        <Scripts />
      </body>
    </html>
  )
}

/** Sets html[data-hydrated] once React is interactive. E2E tests wait for it before acting. */
function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset['hydrated'] = 'true'
  }, [])
  return null
}
