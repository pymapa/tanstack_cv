import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { CvDocument } from '~/cv/schema'
import { VariantName } from '~/cv/variant'
import { searchCvs } from '~/cv/search'
import { FACET_KINDS } from '~/cv/search-text'
import { CV_LANGUAGES, MAX_VARIANT_LENGTH } from '~/cv/translation'
import { isClaudeConfigured } from '~/lib/ai/claude'
import { selectCvTranslator } from '~/lib/ai/cv-translator'
import type { CreateCvError } from '../repositories/cv-repository'
import { getCvRepository } from '../repositories/instance'
import { saveTranslation, translateCv, type TranslateCvError, type TranslationDraft } from '../services/cv-translation'

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

const BoundedCvDocument = CvDocument.refine((doc) => JSON.stringify(doc).length <= MAX_DOCUMENT_BYTES, {
  message: 'The CV is too large',
})

const SaveInput = z.strictObject({
  cvId: Id,
  baseRevisionId: Id,
  data: BoundedCvDocument,
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

export const RestoreRevisionInput = z.strictObject({
  cvId: Id,
  revisionId: Id,
  baseRevisionId: Id,
})

export const restoreCvRevisionFn = createServerFn({ method: 'POST' })
  .validator(RestoreRevisionInput)
  .handler(async ({ data }): Promise<SaveCvResult> => {
    const result = (await getCvRepository()).restoreRevision({ ...data, authorName: 'Local user' })
    return result.ok
      ? { ok: true, revisionId: result.value.id, revisionNumber: result.value.number }
      : { ok: false, error: result.error }
  })

export const CreateVariantInput = z.strictObject({
  sourceCvId: Id,
  variant: VariantName,
  data: BoundedCvDocument,
})

export type CreateCvVariantResult = { ok: true; cvId: string } | { ok: false; error: 'NOT_FOUND' | 'VARIANT_TAKEN' }

export const createCvVariantFn = createServerFn({ method: 'POST' })
  .validator(CreateVariantInput)
  .handler(async ({ data }): Promise<CreateCvVariantResult> => {
    const result = (await getCvRepository()).createVariant({ ...data, authorName: 'Local user' })
    return result.ok ? { ok: true, cvId: result.value.cvId } : { ok: false, error: result.error }
  })

export type TranslateCvResult = { ok: true; draft: TranslationDraft } | { ok: false; error: TranslateCvError }

/** POST: calls the translator (an LLM when a human has turned it on). Saves nothing. */
export const translateCvFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ cvId: Id }))
  .handler(async ({ data }): Promise<TranslateCvResult> => {
    // Stop the model calls when the user cancels or leaves the page.
    const { signal } = getRequest()
    const translator = selectCvTranslator({
      provider: process.env.AI_PROVIDER?.trim(),
      claudeConfigured: isClaudeConfigured(),
    })
    const result = await translateCv({ repo: await getCvRepository(), translator, signal }, data)
    return result.ok ? { ok: true, draft: result.value } : { ok: false, error: result.error }
  })

export const SaveTranslationInput = z.strictObject({
  sourceCvId: Id,
  variant: z
    .string()
    .trim()
    .min(1)
    .max(MAX_VARIANT_LENGTH)
    .regex(/^[\p{L}\p{N} ._()-]+$/u),
  to: z.enum(CV_LANGUAGES),
  data: BoundedCvDocument,
})

export type SaveTranslationResult = { ok: true; cvId: string } | { ok: false; error: CreateCvError }

export const saveTranslationFn = createServerFn({ method: 'POST' })
  .validator(SaveTranslationInput)
  .handler(async ({ data }): Promise<SaveTranslationResult> => {
    const result = saveTranslation({ repo: await getCvRepository() }, { ...data, authorName: 'Local user' })
    return result.ok ? { ok: true, cvId: result.value.cvId } : { ok: false, error: result.error }
  })

export type CreateCvResult = { ok: true; cvId: string } | { ok: false; error: 'ID_EXHAUSTED' }

/** Creates a new person with this CV as their first, primary version. The server sets `meta`. */
export const createCvFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ data: BoundedCvDocument }))
  .handler(async ({ data }): Promise<CreateCvResult> => {
    const repo = await getCvRepository()
    const result = repo.createPerson({ data: data.data, authorName: 'Local user' })
    return result.ok ? { ok: true, cvId: result.value.cvId } : { ok: false, error: result.error }
  })
