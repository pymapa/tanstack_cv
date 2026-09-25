import { z } from 'zod'
import { FACET_KINDS, type FacetKind } from '~/cv/search-text'

const facet = z.array(z.string().max(100)).max(20).default([]).catch([])
const cvIds = z
  .array(
    z
      .string()
      .max(64)
      .regex(/^[0-9a-f-]+$/),
  )
  .max(20)
  .default([])
  .catch([])

/** URL search params for `/`. Every field degrades to a default instead of throwing. */
export const searchParamsSchema = z.object({
  q: z.string().max(200).default('').catch(''),
  skillCategory: facet,
  skill: facet,
  industry: facet,
  role: facet,
  client: facet,
  variant: facet,
  tag: facet,
  cv: cvIds,
})

export type SearchParams = z.infer<typeof searchParamsSchema>
export type SearchParamsPatch = Partial<SearchParams>

export const EMPTY_SEARCH: SearchParams = {
  q: '',
  skillCategory: [],
  skill: [],
  industry: [],
  role: [],
  client: [],
  variant: [],
  tag: [],
  cv: [],
}

export const facetsOf = (search: SearchParams): Record<FacetKind, string[]> =>
  Object.fromEntries(FACET_KINDS.map((k) => [k, search[k]])) as Record<FacetKind, string[]>

export const hasActiveFacets = (search: SearchParams): boolean => FACET_KINDS.some((k) => search[k].length > 0)

export const clearedFacets = (): Record<FacetKind, string[]> =>
  Object.fromEntries(FACET_KINDS.map((k) => [k, []])) as unknown as Record<FacetKind, string[]>
