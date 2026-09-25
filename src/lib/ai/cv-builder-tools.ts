/**
 * Tools of the CV builder agent. They all run in the browser, on the new-CV form's draft:
 * the server route only sends their definitions to the model. The agent can read and fill in
 * the draft, but it can't save, search or read other people's CVs. The user reviews the form
 * and creates the CV.
 */
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

import { checkBrand } from '~/cv/brand-check'
import { applyDraftUpdate, DraftUpdate, toModelDraft } from '~/cv/draft'
import type { CvDocument } from '~/cv/schema'
import { validateCv } from '~/features/editor/validation'

const NoInput = z.object({})

export const readDraftToolDef = toolDefinition({
  name: 'readDraft',
  description:
    'Read the new CV as it is in the form now, including edits the user typed. Contact details are not included.',
  inputSchema: NoInput,
})

export const updateDraftToolDef = toolDefinition({
  name: 'updateDraft',
  description:
    'Fill in the new CV form. Each section you pass (skills, projects, work, education, certificates, languages, x-testimonials) replaces that whole section, so pass every item, not only new ones. basics is merged field by field. Contact details and meta cannot be set. Returns the problems left in the form and style findings to fix.',
  inputSchema: DraftUpdate,
})

export const checkBrandToolDef = toolDefinition({
  name: 'checkBrand',
  description:
    'Check the new CV against the Kipinä CV style: third-person summary of 60–150 words, 2–4 strengths, 2–4 highlighted projects, no buzzwords or exclamation marks. Returns findings by field.',
  inputSchema: NoInput,
})

/** Definitions for the server route, in the same order as the client tools. */
export const CV_BUILDER_TOOL_DEFS = [readDraftToolDef, updateDraftToolDef, checkBrandToolDef] as const

/** They read the form the user may be editing, so the same call can return something new. */
export const CV_BUILDER_REPEATABLE_TOOLS = [readDraftToolDef.name, checkBrandToolDef.name]

export type DraftAccess = Readonly<{
  /** The latest draft, including updates made earlier in the same turn. */
  get: () => CvDocument
  set: (next: CvDocument) => void
}>

const problemsOf = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) =>
  issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }))

export const createCvBuilderClientTools = ({ get, set }: DraftAccess) =>
  [
    readDraftToolDef.client(() => toModelDraft(get())),
    updateDraftToolDef.client((input) => {
      const parsed = DraftUpdate.safeParse(input)
      if (!parsed.success) return { ok: false, problems: problemsOf(parsed.error.issues) }
      const next = applyDraftUpdate(get(), parsed.data)
      set(next)
      return {
        ok: true,
        updated: Object.keys(parsed.data),
        problems: validateCv(next),
        brandFindings: checkBrand(next),
      }
    }),
    checkBrandToolDef.client(() => ({ findings: checkBrand(get()) })),
  ] as const
