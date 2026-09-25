import { createFileRoute, stripSearchParams, useLocation } from '@tanstack/react-router'
import { useCallback } from 'react'
import { SearchPage } from '~/features/search/components/search-page'
import { EMPTY_SEARCH, facetsOf, searchParamsSchema, type SearchParamsPatch } from '~/features/search/search-params'
import { searchCvsFn } from '~/server/functions/cv'

export const Route = createFileRoute('/')({
  validateSearch: searchParamsSchema,
  // Keep URLs short: drop params that equal their defaults (e.g. `?q=` and empty facets).
  search: { middlewares: [stripSearchParams(EMPTY_SEARCH)] },
  loaderDeps: ({ search }) => ({ q: search.q, facets: facetsOf(search), cvIds: search.cv }),
  loader: ({ deps }) => searchCvsFn({ data: deps }),
  head: () => ({ meta: [{ title: 'Search · Kipinä CV bank' }] }),
  component: SearchRoute,
})

function SearchRoute() {
  const results = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onChange = useCallback(
    (patch: SearchParamsPatch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  )
  // The page updates the URL with `replace`, which keeps the history index. Any other navigation
  // (a link, back/forward) lands on a different index and remounts the page, so the search box
  // re-reads the query from the URL. The box's own typing is never overwritten.
  // Both come from the location, which updates as soon as navigation starts (`search` from the
  // match lags until the loader finishes).
  const { historyIndex, initialQuery } = useLocation({
    select: (location) => ({
      historyIndex: location.state.__TSR_index,
      initialQuery: searchParamsSchema.parse(location.search).q,
    }),
    structuralSharing: true,
  })
  return (
    <SearchPage key={historyIndex} initialQuery={initialQuery} results={results} search={search} onChange={onChange} />
  )
}
