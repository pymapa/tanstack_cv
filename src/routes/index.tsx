import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback } from 'react'
import { SearchPage } from '~/features/search/components/search-page'
import { EMPTY_SEARCH, facetsOf, searchParamsSchema, type SearchParamsPatch } from '~/features/search/search-params'
import { searchCvsFn } from '~/server/functions/cv'

export const Route = createFileRoute('/')({
  validateSearch: searchParamsSchema,
  // Keep URLs short: drop params that equal their defaults (e.g. `?q=` and empty facets).
  search: { middlewares: [stripSearchParams(EMPTY_SEARCH)] },
  loaderDeps: ({ search }) => ({ q: search.q, facets: facetsOf(search) }),
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
  return <SearchPage results={results} search={search} onChange={onChange} />
}
