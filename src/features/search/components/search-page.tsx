import { useEffect, useId, useRef, useState } from 'react'
import type { SearchResult } from '~/cv/search'
import { Container } from '~/components/container'
import { PixelGrid } from '~/components/pixel-grid'
import { clearedFacets, facetsOf, hasActiveFacets, type SearchParams, type SearchParamsPatch } from '../search-params'
import { FacetPanel } from './facet-panel'
import { ResultList } from './result-list'

const DEBOUNCE_MS = 150

type Props = Readonly<{
  results: SearchResult
  search: SearchParams
  /** Query for the box when the page mounts. Defaults to `search.q`. */
  initialQuery?: string
  onChange: (patch: SearchParamsPatch) => void
}>

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function SearchPage({ results, search, initialQuery = search.q, onChange }: Props) {
  const inputId = useId()
  const [draft, setDraft] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  // The box owns the query: it only reads `search.q` on mount. The route remounts this page on
  // navigation that doesn't come from the page itself (links, back/forward; see routes/index.tsx),
  // so the URL catching up with an older debounced query can never overwrite newer typing.

  useEffect(() => {
    if (draft === search.q) return
    const timer = setTimeout(() => {
      onChange({ q: draft })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [draft, search.q, onChange])

  // "/" focuses the search box from anywhere on the page, unless the user is typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === '/' && target?.closest('input, textarea, select, [contenteditable]') == null) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const filtersActive = hasActiveFacets(search)

  return (
    <div>
      <section aria-labelledby="search-heading" className="hero-forest">
        <Container className="pb-14 pt-16">
          <h1 id="search-heading" className="max-w-4xl text-6xl text-white" tabIndex={-1}>
            Find the right expert.
            <br />
            <em>Send the CV today.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-light text-white/85">
            Search every Kipinä CV by name, skill, client, industry or role.
          </p>
          <form
            role="search"
            className="mt-8 max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault()
              onChange({ q: draft })
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Search CVs by name, skill, client, industry or role
            </label>
            <div className="flex items-center gap-3 rounded-card bg-white px-4 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.2)] focus-within:outline focus-within:outline-3 focus-within:outline-lime">
              <SearchIcon />
              <input
                ref={inputRef}
                id={inputId}
                type="search"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                }}
                placeholder="Try “Scrum banking” or “Azure DevOps”"
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                className="h-14 w-full bg-transparent text-lg outline-none placeholder:text-muted"
                data-testid="search-input"
              />
              <kbd className="hidden rounded border border-line px-1.5 text-xs text-muted lg:inline" aria-hidden="true">
                /
              </kbd>
            </div>
          </form>
        </Container>
      </section>

      <Container>
        <div className="mt-10 grid grid-cols-[260px_minmax(0,1fr)] gap-10">
          <aside aria-label="Filters">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Filters</h2>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(clearedFacets())
                  }}
                  className="text-sm font-medium text-teal hover:underline"
                  data-testid="clear-filters"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="mt-4">
              <FacetPanel
                facets={results.facets}
                selected={facetsOf(search)}
                onToggle={(kind, values) => {
                  onChange({ [kind]: values })
                }}
              />
            </div>
          </aside>

          <section aria-labelledby="results-heading">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <p role="status" aria-live="polite" className="text-sm text-muted">
                {plural(results.people.length, 'person', 'people')}, {plural(results.totalCvs, 'CV', 'CVs')}
              </p>
            </div>
            {results.people.length === 0 ? <EmptyState /> : <ResultList people={results.people} />}
          </section>
        </div>
      </Container>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card bg-ink p-10 text-white">
      <PixelGrid size={24} />
      <p className="text-2xl font-light tracking-tight">Nothing matches yet.</p>
      <p className="text-white/80">Try fewer words, check the spelling, or clear a filter.</p>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-muted">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
