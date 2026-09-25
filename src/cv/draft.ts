import { z } from 'zod'
import { Basics, CvDocument } from './schema'

/**
 * The CV draft that the CV builder agent fills in. The agent only ever sends a `DraftUpdate`:
 * content sections, never contact details or `meta`. It can't save; the user reviews the form
 * and creates the CV.
 */

/** True when both CVs have the same content. */
export const sameCv = (a: CvDocument, b: CvDocument): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

/** A blank CV for the new-CV form. `meta` is a placeholder; the server assigns it on create. */
export const emptyCv = (cvYear: string): CvDocument => ({
  basics: { name: '', label: '', summary: '' },
  skills: [],
  projects: [],
  meta: { personId: 'p00', variant: 'default', sourceFormat: 'pdf', 'x-cvYear': cvYear },
})

const DraftBasics = Basics.pick({
  name: true,
  label: true,
  summary: true,
  'x-experienceSummary': true,
  'x-tagline': true,
  'x-keywords': true,
  'x-industries': true,
  'x-strengths': true,
  'x-keyRoles': true,
  'x-keySkills': true,
  'x-hobbies': true,
}).partial()

const { shape } = CvDocument

/** Fields the builder may set. Each given section replaces the draft's; `basics` is merged. */
export const DraftUpdate = z.strictObject({
  basics: DraftBasics.optional(),
  skills: shape.skills.optional(),
  projects: shape.projects.optional(),
  work: shape.work,
  education: shape.education,
  certificates: shape.certificates,
  languages: shape.languages,
  'x-testimonials': shape['x-testimonials'],
})

export type DraftUpdate = z.infer<typeof DraftUpdate>

/** Keys set to `undefined` are left out, so they never blank a field. */
const defined = <T extends object>(value: T): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>
  }

export const applyDraftUpdate = (cv: CvDocument, { basics = {}, ...sections }: DraftUpdate): CvDocument => ({
  ...cv,
  ...defined(sections),
  basics: { ...cv.basics, ...defined(basics) },
})

const withoutNote = <T extends { 'x-note'?: string | undefined }>({ 'x-note': _note, ...rest }: T) => rest

/** The draft as the builder agent may see it: no contact details, conversion notes or `meta`. */
export const toModelDraft = (cv: CvDocument) => {
  const { email: _e, phone: _p, url: _u, profiles: _pr, ...basics } = cv.basics
  const { $schema: _s, meta: _m, basics: _b, projects, work, ...rest } = cv
  return {
    ...rest,
    basics,
    projects: projects.map(withoutNote),
    ...(work === undefined ? {} : { work: work.map(withoutNote) }),
  }
}
