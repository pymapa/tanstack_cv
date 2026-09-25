import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { CvDocument } from '~/cv/schema'
import { searchCvs } from '~/cv/search'
import { FACET_KINDS } from '~/cv/search-text'
import { getCvRepository } from '../repositories/instance'

/*
 * SECURITY TODO (spec M2): these functions have no authentication or authorization yet.
 * The dev server is bound to localhost only (vite.config.ts). Before anything else is
 * exposed, add authMiddleware + can() checks per .claude/skills/secure-server-fn.
 */

const MAX_DOCUMENT_BYTES = 512 * 1024
const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9a-f-]+$/)

const FacetInput = z.strictObject(
  Object.fromEntries(FACET_KINDS.map((k) => [k, z.array(z.string().max(100)).max(20).optional()])) as Record<
    (typeof FACET_KINDS)[number],
    z.ZodOptional<z.ZodArray<z.ZodString>>
  >,
)

export const SearchInput = z.strictObject({
  q: z.string().max(200),
  facets: FacetInput,
  cvIds: z.array(Id).max(20).optional(),
})

export const searchCvsFn = createServerFn({ method: 'GET' })
  .validator(SearchInput)
  .handler(async ({ data }) => {
    const repo = await getCvRepository()
    return searchCvs(repo.listSearchable(), data)
  })

export const getPersonFn = createServerFn({ method: 'GET' })
  .validator(z.strictObject({ personId: Id }))
  .handler(async ({ data }) => {
    const person = (await getCvRepository()).getPerson(data.personId)
    if (person === null) throw notFound()
    return person
  })

export const getCvFn = createServerFn({ method: 'GET' })
  .validator(z.strictObject({ cvId: Id }))
  .handler(async ({ data }) => {
    const cv = (await getCvRepository()).getCv(data.cvId)
    if (cv === null) throw notFound()
    return cv
  })

const SaveInput = z.strictObject({
  cvId: Id,
  baseRevisionId: Id,
  data: CvDocument.refine((doc) => JSON.stringify(doc).length <= MAX_DOCUMENT_BYTES, {
    message: 'The CV is too large',
  }),
  message: z.string().trim().max(200).optional(),
})

export type SaveCvResult =
  { ok: true; revisionId: string; revisionNumber: number } | { ok: false; error: 'NOT_FOUND' | 'CONFLICT' }

export const saveCvRevisionFn = createServerFn({ method: 'POST' })
  .validator(SaveInput)
  .handler(async ({ data }): Promise<SaveCvResult> => {
    const repo = await getCvRepository()
    const result = repo.saveRevision({ ...data, authorName: 'Local user' })
    return result.ok
      ? { ok: true, revisionId: result.value.id, revisionNumber: result.value.number }
      : { ok: false, error: result.error }
  })
