import type { CvDocument } from '~/cv/schema'
import {
  applyTranslatedText,
  detectCvLanguage,
  extractTranslatableText,
  LANGUAGE_NAMES,
  otherLanguage,
  translatedVariantName,
  type CvLanguage,
} from '~/cv/translation'
import type { CvTranslator, TranslatorError } from '~/lib/ai/cv-translator'
import { err, ok, type Result } from '~/lib/result'
import type { CreateCvError, CvRepository } from '../repositories/cv-repository'

/*
 * SECURITY TODO (spec M2): add can(actor, 'cv.read', cv) before translating and
 * can(actor, 'cv.createVariant', cv) before saving, plus a rate limit like aiPropose.
 */

/** A machine translation the user has not reviewed yet. Nothing is saved. */
export type TranslationDraft = Readonly<{
  sourceCvId: string
  sourceRevisionId: string
  sourceRevisionNumber: number
  from: CvLanguage
  to: CvLanguage
  /** Suggested name for the new CV version. */
  variant: string
  data: CvDocument
}>

export type TranslateCvError = 'NOT_FOUND' | TranslatorError

type TranslateDeps = Readonly<{ repo: CvRepository; translator: CvTranslator | null; signal: AbortSignal }>

/** Translates the saved revision of a CV into the other language (English ↔ Finnish). */
export const translateCv = async (
  { repo, translator, signal }: TranslateDeps,
  { cvId }: Readonly<{ cvId: string }>,
): Promise<Result<TranslationDraft, TranslateCvError>> => {
  const cv = repo.getCv(cvId)
  if (cv === null) return err('NOT_FOUND')
  if (translator === null) return err('AI_UNAVAILABLE')

  const source = cv.revision.data
  const from = detectCvLanguage(source)
  const to = otherLanguage(from)
  const translated = await translator({ from, to, segments: extractTranslatableText(source) }, signal)
  if (!translated.ok) return err(translated.error)

  const applied = applyTranslatedText(source, translated.value)
  if (!applied.ok) return err('AI_INVALID_OUTPUT')
  const variant = translatedVariantName(cv.variant, to)
  // Not re-validated here on purpose: applyTranslatedText only swaps strings at existing text
  // fields, so the shape is intact. A text that grew past its field limit (Finnish runs longer)
  // is shown as a problem in the review screen for the user to shorten; saveTranslation
  // validates the whole CV before anything is stored.

  return ok({
    sourceCvId: cv.id,
    sourceRevisionId: cv.revision.id,
    sourceRevisionNumber: cv.revision.number,
    from,
    to,
    variant,
    data: { ...applied.value, meta: { ...applied.value.meta, variant } },
  })
}

export type SaveTranslationInput = Readonly<{
  sourceCvId: string
  variant: string
  to: CvLanguage
  data: CvDocument
  authorName: string
}>

/** Saves a reviewed (and possibly edited) translation as a new CV version of the same person. */
export const saveTranslation = (
  { repo }: Readonly<{ repo: CvRepository }>,
  { sourceCvId, variant, to, data, authorName }: SaveTranslationInput,
): Result<{ cvId: string }, CreateCvError> => {
  const origin = repo.getCv(sourceCvId)
  if (origin === null) return err('NOT_FOUND')
  return repo.createCvFrom({
    sourceCvId,
    variant,
    data,
    source: 'ai',
    message: `${LANGUAGE_NAMES[to]} translation of "${origin.variant}", reviewed`,
    authorName,
  })
}
