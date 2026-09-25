import { err, ok, type Result } from '~/lib/result'
import type { CvDocument } from './schema'

/**
 * Pure helpers for translating a CV between English and Finnish.
 * Only the text fields listed in TRANSLATABLE go to the translator: never the name, contact
 * details, client or employer names, dates or meta (data minimization, spec §9.3).
 */

export const CV_LANGUAGES = ['en', 'fi'] as const
export type CvLanguage = (typeof CV_LANGUAGES)[number]

export const LANGUAGE_NAMES: Readonly<Record<CvLanguage, string>> = { en: 'English', fi: 'Finnish' }

/** One text field: `id` is its JSON pointer in the CV. */
export type TextSegment = Readonly<{ id: string; text: string }>

const ANY = '*'

const each = (base: readonly string[], fields: readonly string[]): string[][] =>
  fields.map((field) => [...base, ANY, field])

/** Path patterns of the fields that are translated. `*` is any array index. */
const TRANSLATABLE: readonly (readonly string[])[] = [
  ['basics', 'label'],
  ['basics', 'summary'],
  ['basics', 'x-experienceSummary'],
  ['basics', 'x-tagline'],
  ['basics', 'x-hobbies'],
  ['basics', 'x-keywords', ANY],
  ['basics', 'x-industries', ANY],
  ...each(['basics', 'x-strengths'], ['title', 'description']),
  ...each(['basics', 'x-keyRoles'], ['title', 'description']),
  ...each(['basics', 'x-keySkills'], ['title', 'description']),
  ...each(['skills'], ['name', 'level']),
  ['skills', ANY, 'keywords', ANY],
  ...each(['skills', ANY, 'x-skillDetails'], ['yearsText', 'note']),
  ...each(['projects'], ['name', 'description', 'x-industry', 'x-duration', 'x-note']),
  ['projects', ANY, 'roles', ANY],
  ['projects', ANY, 'keywords', ANY],
  ...each(['work'], ['position', 'summary', 'x-note']),
  ...each(['education'], ['institution', 'area', 'studyType']),
  ...each(['certificates'], ['x-dateText']),
  ...each(['languages'], ['language', 'fluency']),
  ...each(['x-testimonials'], ['quote']),
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collect = (value: unknown, pattern: readonly string[], path: readonly string[], out: TextSegment[]): void => {
  const [head, ...rest] = pattern
  if (head === undefined) {
    if (typeof value === 'string' && value.trim() !== '') out.push({ id: `/${path.join('/')}`, text: value })
    return
  }
  if (head === ANY) {
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        collect(item, rest, [...path, String(i)], out)
      })
    }
    return
  }
  if (isRecord(value) && Object.hasOwn(value, head)) collect(value[head], rest, [...path, head], out)
}

export const extractTranslatableText = (cv: CvDocument): TextSegment[] => {
  const out: TextSegment[] = []
  for (const pattern of TRANSLATABLE) collect(cv, pattern, [], out)
  return out
}

/** Writes `text` at `id`. Only called with ids from extractTranslatableText, so every step exists. */
const setAt = (root: Record<string, unknown>, id: string, text: string): void => {
  const keys = id.split('/').slice(1)
  const last = keys.pop()
  let node: unknown = root
  for (const key of keys) node = (node as Record<string, unknown>)[key]
  if (last !== undefined) (node as Record<string, unknown>)[last] = text
}

export type ApplyTranslationError = 'UNKNOWN_FIELD'

/**
 * Returns a new CV with the translated texts in place. Fields the translation leaves out keep
 * their original text. Any id that isn't a translatable field of this CV fails the whole
 * translation, so a model can't write to the name, meta or anything else.
 */
export const applyTranslatedText = (
  cv: CvDocument,
  translations: readonly TextSegment[],
): Result<CvDocument, ApplyTranslationError> => {
  const allowed = new Set(extractTranslatableText(cv).map((s) => s.id))
  if (translations.some((t) => !allowed.has(t.id))) return err('UNKNOWN_FIELD')
  const copy = structuredClone(cv) as CvDocument & Record<string, unknown>
  for (const { id, text } of translations) setAt(copy, id, text)
  return ok(copy)
}

const FINNISH_WORDS = new Set([
  'ja',
  'oli',
  'hän',
  'sekä',
  'että',
  'kanssa',
  'joka',
  'jossa',
  'myös',
  'kuin',
  'ovat',
  'olen',
  'vuotta',
  'kokemusta',
  'asiakkaan',
  'tiimin',
  'projektissa',
  'toimi',
  'vastasi',
])
const ENGLISH_WORDS = new Set([
  'the',
  'and',
  'with',
  'of',
  'in',
  'is',
  'for',
  'to',
  'a',
  'an',
  'as',
  'has',
  'was',
  'he',
  'she',
  'years',
  'experience',
  'team',
  'project',
  'client',
])

/**
 * A best guess from the running text. English wins ties, since most CVs are in English.
 * Only lowercase words with ä/ö count as Finnish: capitalised ones are usually names
 * ("University of Jyväskylä") inside English text.
 */
export const detectCvLanguage = (cv: CvDocument): CvLanguage => {
  const words = extractTranslatableText(cv)
    .map((s) => s.text)
    .join(' ')
    .split(/[^\p{L}]+/u)
  let fi = 0
  let en = 0
  for (const word of words) {
    const lower = word.toLowerCase()
    if (FINNISH_WORDS.has(lower) || (word === lower && /[äö]/.test(word))) fi++
    else if (ENGLISH_WORDS.has(lower)) en++
  }
  return fi > en ? 'fi' : 'en'
}

export const otherLanguage = (language: CvLanguage): CvLanguage => (language === 'en' ? 'fi' : 'en')

/** Longest version name `saveTranslation` accepts. */
export const MAX_VARIANT_LENGTH = 60

/** `PM` → `PM-fi`, `PM-en` → `PM-fi`, cut to fit MAX_VARIANT_LENGTH. */
export const translatedVariantName = (variant: string, target: CvLanguage): string =>
  `${variant.replace(/-(en|fi)$/i, '').slice(0, MAX_VARIANT_LENGTH - 3)}-${target}`
