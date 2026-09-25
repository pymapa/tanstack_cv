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
