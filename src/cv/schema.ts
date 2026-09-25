import { z } from 'zod'

/**
 * Kipinä CV document: JSON Resume 1.0 + Kipinä `x-` extensions.
 * Mirrors sample_data/schema/cv.schema.json (tests validate every sample with both).
 * All objects are strict so no field is ever lost silently on import or save.
 */

const LONG_TEXT = 5000
const SHORT_TEXT = 300
const MAX_ITEMS = 200

const shortText = z.string().max(SHORT_TEXT)
const longText = z.string().max(LONG_TEXT)
const list = <T extends z.ZodType>(item: T) => z.array(item).max(MAX_ITEMS)

/**
 * Every object is strict: an unknown field fails validation instead of being silently dropped.
 * To support a new JSON Resume field, add it here (see the cv-schema skill).
 */
const jsonObject = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape)

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, same pattern as JSON Resume's iso8601. */
export const IsoPartialDate = z
  .string()
  .regex(/^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$/, {
    message: 'Use YYYY, YYYY-MM or YYYY-MM-DD',
  })

const TitledItem = z.strictObject({
  title: shortText,
  description: longText.optional(),
})

const Profile = jsonObject({
  network: shortText.optional(),
  username: shortText.optional(),
  url: z.url().max(SHORT_TEXT).optional(),
})

export const Basics = jsonObject({
  name: shortText.min(1),
  label: shortText,
  summary: longText,
  email: z.email().max(SHORT_TEXT).optional(),
  phone: shortText.optional(),
  url: z.url().max(SHORT_TEXT).optional(),
  profiles: list(Profile).optional(),
  'x-experienceSummary': shortText.optional(),
  'x-tagline': shortText.optional(),
  'x-keywords': list(shortText).optional(),
  'x-industries': list(shortText).optional(),
  'x-strengths': list(TitledItem).optional(),
  'x-keyRoles': list(TitledItem).optional(),
  'x-keySkills': list(TitledItem).optional(),
  'x-hobbies': longText.optional(),
})

export const SkillDetail = z.strictObject({
  name: shortText,
  years: z.number().min(0).max(80).nullable().optional(),
  yearsText: shortText.optional(),
  note: shortText.optional(),
})

export const Skill = jsonObject({
  name: shortText,
  level: shortText.optional(),
  keywords: list(shortText).optional(),
  'x-skillDetails': list(SkillDetail).optional(),
})

export const Project = jsonObject({
  name: shortText,
  entity: shortText,
  description: longText.optional(),
  roles: list(shortText).optional(),
  keywords: list(shortText).optional(),
  startDate: IsoPartialDate.optional(),
  endDate: IsoPartialDate.optional(),
  'x-employer': shortText.optional(),
  'x-industry': shortText.optional(),
  'x-duration': shortText.optional(),
  'x-highlight': z.boolean().optional(),
  'x-note': longText.optional(),
})

export const Work = jsonObject({
  name: shortText,
  position: shortText.optional(),
  summary: longText.optional(),
  startDate: IsoPartialDate.optional(),
  endDate: IsoPartialDate.optional(),
  'x-note': longText.optional(),
})

export const Education = jsonObject({
  institution: shortText.optional(),
  area: shortText.optional(),
  studyType: shortText.optional(),
  startDate: IsoPartialDate.optional(),
  endDate: IsoPartialDate.optional(),
})

export const Certificate = jsonObject({
  name: shortText,
  issuer: shortText.optional(),
  date: IsoPartialDate.optional(),
  'x-dateText': shortText.optional(),
})

export const Language = jsonObject({
  language: shortText.optional(),
  fluency: shortText.optional(),
})

export const Testimonial = z.strictObject({
  quote: longText,
  author: shortText.optional(),
})

export const CV_TEMPLATE_IDS = ['kipina-portrait', 'kipina-landscape'] as const
export const CvTemplateId = z.enum(CV_TEMPLATE_IDS)
export type CvTemplateId = z.infer<typeof CvTemplateId>

export const CvMeta = jsonObject({
  version: shortText.optional(),
  personId: z.string().regex(/^p[0-9]{2}$/),
  variant: shortText,
  sourceFormat: z.enum(['pptx', 'pdf']),
  'x-cvYear': z.string().regex(/^[0-9]{4}$/),
  'x-conversionNotes': list(longText).optional(),
  'x-template': CvTemplateId.optional(),
})

export const CvDocument = jsonObject({
  $schema: z.string().optional(),
  basics: Basics,
  skills: list(Skill),
  projects: list(Project),
  work: list(Work).optional(),
  education: list(Education).optional(),
  certificates: list(Certificate).optional(),
  languages: list(Language).optional(),
  'x-testimonials': list(Testimonial).optional(),
  meta: CvMeta,
})

export type CvDocument = z.infer<typeof CvDocument>
export type Basics = z.infer<typeof Basics>
export type Skill = z.infer<typeof Skill>
export type SkillDetail = z.infer<typeof SkillDetail>
export type Project = z.infer<typeof Project>
export type Work = z.infer<typeof Work>
export type Certificate = z.infer<typeof Certificate>
export type TitledItem = z.infer<typeof TitledItem>
