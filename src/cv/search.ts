import type { CvDocument } from './schema'
import {
  extractFacets,
  extractSearchFields,
  FACET_KINDS,
  FIELD_WEIGHTS,
  SEARCH_FIELDS,
  type FacetKind,
  type SearchField,
} from './search-text'

/**
 * In-memory search over CV documents. Same semantics the SQLite FTS5 index will have (spec §7.2):
 * every term must prefix-match (AND), field-weighted ranking, OR within a facet, AND across facets.
 * Pure: no I/O, no globals.
 */

const MAX_TERMS = 10
const MAX_TERM_LENGTH = 64
const SNIPPET_RADIUS = 80

export type SearchableCv = Readonly<{
  cvId: string
  personId: string
  personName: string
  variant: string
  isPrimary: boolean
  /** null when the CV is unchanged since import (the real edit date is unknown). */
  updatedAt: string | null
  document: CvDocument
  tags: readonly string[]
}>

export type FacetSelection = Partial<Record<FacetKind, readonly string[] | undefined>>
export type SearchQuery = Readonly<{ q: string; facets: FacetSelection }>

export type SnippetSegment = Readonly<{ text: string; match: boolean }>
export type FacetCount = Readonly<{ key: string; value: string; count: number }>

export type CvHit = Readonly<{
  cvId: string
  variant: string
  label: string
  isPrimary: boolean
  updatedAt: string | null
  cvYear: string
  score: number
  snippet: readonly SnippetSegment[]
}>

export type PersonHit = Readonly<{
  personId: string
  personName: string
  label: string
  experienceSummary: string | undefined
  score: number
  cvs: readonly CvHit[]
}>

export type SearchResult = Readonly<{
  people: readonly PersonHit[]
  totalCvs: number
  facets: Readonly<Record<FacetKind, readonly FacetCount[]>>
}>

/** Lowercase, strip diacritics (ä → a), collapse whitespace. */
export const normalize = (value: string): string =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Split user input into safe terms: letters and digits only, capped in count and length. */
export const parseQuery = (q: string): string[] =>
  normalize(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '')
    .slice(0, MAX_TERMS)
    .map((t) => t.slice(0, MAX_TERM_LENGTH))

const tokenize = (text: string): string[] =>
  normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '')

type Indexed = Readonly<{
  entry: SearchableCv
  tokens: Readonly<Record<SearchField, readonly string[]>>
  body: string
  facets: Readonly<Record<FacetKind, readonly string[]>>
}>

const indexEntry = (entry: SearchableCv): Indexed => {
  const fields = extractSearchFields(entry.document)
  const tokens = {} as Record<SearchField, readonly string[]>
  for (const field of SEARCH_FIELDS) tokens[field] = tokenize(fields[field])
  return { entry, tokens, body: fields.body, facets: extractFacets(entry.document, entry.tags) }
}

const scoreEntry = (indexed: Indexed, terms: readonly string[]): number | null => {
  let total = 0
  for (const term of terms) {
    const termScore = SEARCH_FIELDS.reduce(
      (sum, field) => sum + (indexed.tokens[field].some((t) => t.startsWith(term)) ? FIELD_WEIGHTS[field] : 0),
      0,
    )
    if (termScore === 0) return null
    total += termScore
  }
  return total
}

const matchesFacets = (indexed: Indexed, selection: FacetSelection): boolean =>
  FACET_KINDS.every((kind) => {
    const wanted = selection[kind]
    if (wanted === undefined || wanted.length === 0) return true
    const have = new Set(indexed.facets[kind].map(normalize))
    return wanted.some((w) => have.has(normalize(w)))
  })

/** Build a short excerpt around the first matching term, split into marked/unmarked segments. */
export const buildSnippet = (body: string, terms: readonly string[]): SnippetSegment[] => {
  if (terms.length === 0 || body === '') return []
  const text = body.split('\n').find((passage) => terms.some((term) => wordStartRe(term).test(normalize(passage))))
  if (text === undefined) return []
  const folded = normalize(text.replace(/\s+/g, ' '))
  const flat = text.replace(/\s+/g, ' ').trim()
  // normalize() keeps one char per base char for Latin text, so indexes line up with `flat`.
  if (folded.length !== flat.length) return []
  const positions = terms
    .map((term) => {
      const m = wordStartRe(term).exec(folded)
      return m === null ? null : { start: m.index + (m[1]?.length ?? 0), term }
    })
    .filter((p): p is { start: number; term: string } => p !== null)
  const first = positions.sort((a, b) => a.start - b.start)[0]
  if (first === undefined) return []

  const from = Math.max(0, first.start - SNIPPET_RADIUS)
  const to = Math.min(flat.length, first.start + first.term.length + SNIPPET_RADIUS)
  const window = flat.slice(from, to)
  const foldedWindow = folded.slice(from, to)
  const markRe = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map(escapeRegExp).join('|')})[\\p{L}\\p{N}]*`, 'gu')

  const segments: SnippetSegment[] = []
  let cursor = 0
  for (const m of foldedWindow.matchAll(markRe)) {
    if (m.index > cursor) segments.push({ text: window.slice(cursor, m.index), match: false })
    segments.push({ text: window.slice(m.index, m.index + m[0].length), match: true })
    cursor = m.index + m[0].length
  }
  if (cursor < window.length) segments.push({ text: window.slice(cursor), match: false })
  return [
    ...(from > 0 ? [{ text: '…', match: false }] : []),
    ...segments,
    ...(to < flat.length ? [{ text: '…', match: false }] : []),
  ]
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Matches `term` at the start of a word in normalized text. */
const wordStartRe = (term: string): RegExp => new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(term)})`, 'u')

const countFacets = (items: readonly Indexed[]): SearchResult['facets'] => {
  const result = {} as Record<FacetKind, FacetCount[]>
  for (const kind of FACET_KINDS) {
    const counts = new Map<string, { value: string; count: number }>()
    for (const item of items) {
      for (const value of item.facets[kind]) {
        const key = normalize(value)
        const current = counts.get(key)
        counts.set(key, { value: current?.value ?? value, count: (current?.count ?? 0) + 1 })
      }
    }
    result[kind] = [...counts.entries()]
      .map(([key, v]) => ({ key, value: v.value, count: v.count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'fi'))
  }
  return result
}

export const searchCvs = (entries: readonly SearchableCv[], query: SearchQuery): SearchResult => {
  const terms = parseQuery(query.q)
  const scored = entries
    .map(indexEntry)
    .map((indexed) => ({ indexed, score: scoreEntry(indexed, terms) }))
    .filter((s): s is { indexed: Indexed; score: number } => s.score !== null)

  const facetCounts = countFacets(scored.map((s) => s.indexed))
  const matched = scored.filter((s) => matchesFacets(s.indexed, query.facets))

  const byPerson = new Map<string, { indexed: Indexed; score: number }[]>()
  for (const hit of matched) {
    const list = byPerson.get(hit.indexed.entry.personId) ?? []
    byPerson.set(hit.indexed.entry.personId, [...list, hit])
  }

  const people: PersonHit[] = [...byPerson.values()].map((hits) => {
    const cvs = hits
      .map(({ indexed, score }) => ({
        cvId: indexed.entry.cvId,
        variant: indexed.entry.variant,
        label: indexed.entry.document.basics.label,
        isPrimary: indexed.entry.isPrimary,
        updatedAt: indexed.entry.updatedAt,
        cvYear: indexed.entry.document.meta['x-cvYear'],
        score,
        snippet: buildSnippet(indexed.body, terms),
      }))
      .sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.score - a.score || a.variant.localeCompare(b.variant),
      )
    const lead = (hits.find((h) => h.indexed.entry.isPrimary) ?? hits[0])?.indexed.entry
    return {
      personId: lead?.personId ?? '',
      personName: lead?.personName ?? '',
      label: lead?.document.basics.label ?? '',
      experienceSummary: lead?.document.basics['x-experienceSummary'],
      score: Math.max(...cvs.map((c) => c.score)),
      cvs,
    }
  })

  return {
    people: people.sort((a, b) => b.score - a.score || a.personName.localeCompare(b.personName, 'fi')),
    totalCvs: matched.length,
    facets: facetCounts,
  }
}
