import { createRouter } from '@tanstack/react-router'
import { ErrorView, NotFoundView } from './components/status-views'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: ErrorView,
    defaultNotFoundComponent: NotFoundView,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** The page has its own agent, so the floating CV assistant is hidden there. */
    hideCvAssistant?: boolean
  }
}
