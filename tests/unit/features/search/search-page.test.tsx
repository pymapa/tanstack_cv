// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { searchCvs, type SearchableCv } from '~/cv/search'
import { SearchPage } from '~/features/search/components/search-page'
import { EMPTY_SEARCH, type SearchParams } from '~/features/search/search-params'
import { buildCv, buildProject } from '../../../fixtures/cv'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _p, ...rest }: { children: React.ReactNode; to: string; params?: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const entries: SearchableCv[] = [
  {
    cvId: 'cv-1',
    personId: 'person-1',
    personName: 'Anna Example',
    variant: 'default',
    isPrimary: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    document: buildCv({
      basics: { label: 'Scrum Master', 'x-industries': ['Finance'], 'x-experienceSummary': '10+ years' },
      projects: [buildProject({ description: 'Led the mortgage system renewal.' })],
    }),
  },
  {
    cvId: 'cv-2',
    personId: 'person-2',
    personName: 'Bob Example',
    variant: 'default',
    isPrimary: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    document: buildCv({ basics: { name: 'Bob Example', label: 'Cloud Engineer', 'x-industries': ['Telecom'] } }),
  },
]

const renderPage = (search: SearchParams = EMPTY_SEARCH) => {
  const onChange = vi.fn()
  const results = searchCvs(entries, { q: search.q, facets: search, cvIds: search.cv })
  render(<SearchPage results={results} search={search} onChange={onChange} />)
  return { onChange }
}

describe('SearchPage', () => {
  it('should announce the result count in a live region', () => {
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('2 people, 2 CVs')
  })

  it('should list each person with a link to their CV versions', () => {
    renderPage()

    const list = screen.getByRole('list', { name: 'Search results' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByRole('heading', { name: 'Anna Example' })).toBeInTheDocument()
  })

  it('should call onChange with the facet value when a facet checkbox is ticked', async () => {
    const { onChange } = renderPage()

    await userEvent.click(screen.getByRole('checkbox', { name: /Finance/ }))

    expect(onChange).toHaveBeenCalledWith({ industry: ['Finance'] })
  })

  it('should mark matching words in the snippet when searching', () => {
    renderPage({ ...EMPTY_SEARCH, q: 'mortgage' })

    expect(screen.getByText('mortgage', { selector: 'mark' })).toBeInTheDocument()
  })

  it('should show a friendly empty state when nothing matches', () => {
    renderPage({ ...EMPTY_SEARCH, q: 'zzzz' })

    expect(screen.getByRole('status')).toHaveTextContent('0 people')
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('should offer to clear filters when a facet is active', async () => {
    const { onChange } = renderPage({ ...EMPTY_SEARCH, industry: ['Finance'] })

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ industry: [], skill: [] }))
  })

  it('should show only the suggested CVs and offer to show all when cv ids are in the URL', async () => {
    const { onChange } = renderPage({ ...EMPTY_SEARCH, cv: ['cv-2'] })

    expect(screen.getByRole('status')).toHaveTextContent('1 person, 1 CV')
    expect(screen.getByText(/Showing 1 CV suggested by the CV assistant/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show all CVs' }))

    expect(onChange).toHaveBeenCalledWith({ cv: [] })
  })

  it('should not mention suggested CVs when no cv ids are in the URL', () => {
    renderPage()

    expect(screen.queryByText(/suggested by the CV assistant/)).not.toBeInTheDocument()
  })

  it('should keep characters typed while the previous search is still loading', async () => {
    const onChange = vi.fn()
    const results = searchCvs(entries, { q: '', facets: {} })
    const user = userEvent.setup()
    const { rerender } = render(<SearchPage results={results} search={EMPTY_SEARCH} onChange={onChange} />)
    const box = screen.getByRole('searchbox')
    await user.type(box, 'azure')
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ q: 'azure' })
    })

    await user.type(box, ' dev')
    rerender(<SearchPage results={results} search={{ ...EMPTY_SEARCH, q: 'azure' }} onChange={onChange} />)

    expect(box).toHaveValue('azure dev')
  })
})
