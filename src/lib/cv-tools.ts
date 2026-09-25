/**
 * Server-side tools that let the chatbot search and read CVs.
 *
 * Their results are sent to the Claude API, so they only return CVs through
 * `toSharedCv`, which leaves out contact details and conversion notes.
 */
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

import { type Cv, readCv, readPeople, toSharedCv } from '~/lib/cv-data'
import { buildCvLinks } from '~/lib/cv-links'
import { getCvRepository } from '~/server/repositories/instance'

/** All string and number values in a JSON value, without its keys. */
function values(value: unknown): Array<string> {
  if (typeof value === 'string') return [value]
  if (typeof value === 'number') return [String(value)]
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(values)
  }
  return []
}

const WORD_CHAR = /[\p{L}\p{N}]/u

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Regex source matching an English word in its singular or plural form.
 *
 * English plurals can't be undone with one rule ("databases" → "database",
 * "boxes" → "box", "companies" → "company", "movies" → "movie"), so each
 * possible singular is tried, and each one may take a plural ending.
 */
function singularOrPlural(term: string): string {
  const stems = new Set([term])
  // Short terms are usually acronyms ("aws", "sql"): keep their "s".
  if (term.length > 3) {
    // Not "-ss": "sass" and "less" aren't plurals.
    if (/[^s]s$/i.test(term)) stems.add(term.slice(0, -1))
    // "-es" is only a plural ending after a sibilant ("boxes", "processes").
    if (/(?:s|x|z|ch|sh)es$/i.test(term)) stems.add(term.slice(0, -2))
    if (/ies$/i.test(term)) stems.add(`${term.slice(0, -3)}y`)
  }
  const forms = [...stems]
    // Very short stems ("us" from "uses") would match unrelated words.
    .filter((stem) => stem === term || stem.length >= 3)
    .map((stem) =>
      /[^aeiou]y$/i.test(stem) ? `${escapeRegExp(stem.slice(0, -1))}(?:y|ies)` : `${escapeRegExp(stem)}(?:e?s)?`,
    )
  return `(?:${forms.join('|')})`
}

/**
 * Matches `term` as a whole word in its singular or plural form, so "api"
 * matches "APIs" and "companies" matches "company", but "go" doesn't match
 * "Google". A side of the term that is punctuation needs no word boundary,
 * so ".net" matches "ASP.NET".
 */
function wholeWord(term: string): RegExp {
  const wordEnd = WORD_CHAR.test(term.at(-1) ?? '')
  const start = WORD_CHAR.test(term.at(0) ?? '') ? '(?<![\\p{L}\\p{N}])' : ''
  const body = wordEnd ? singularOrPlural(term) : escapeRegExp(term)
  const end = wordEnd ? '(?![\\p{L}\\p{N}])' : ''
  return new RegExp(`${start}${body}${end}`, 'iu')
}

export const searchPeopleToolDef = toolDefinition({
  name: 'searchPeople',
  description:
    "Search Kipinä people by skill, technology, role, industry or past client. Every term must appear as a whole word somewhere in the person's CV; singular and plural forms match each other, other word forms don't. If a search finds few or no people, retry with other word forms, e.g. 'banking' as well as 'bank'. Returns each matching person with their CV versions. Pass an empty query to list everyone.",
  inputSchema: z.object({
    query: z.string().describe('Space-separated search terms, e.g. "react aws" or "product owner insurance"'),
  }),
})

export const searchPeople = searchPeopleToolDef.server(async ({ query }) => {
  const patterns = query.split(/\s+/).filter(Boolean).map(wholeWord)
  const people = await readPeople()
  const results = await Promise.all(
    people.map(async (person) => {
      const cvs = (await Promise.all(person.versions.map((v) => readCv(v.file, people)))) as Array<Cv>
      // Search everything the model may see, so a match here is a match in getCv.
      const text = cvs.flatMap((cv) => values(toSharedCv(cv))).join('\n')
      if (!patterns.every((pattern) => pattern.test(text))) return null
      const primary = cvs[person.versions.findIndex((v) => v.file === person.primary)]
      return {
        personId: person.personId,
        name: person.name,
        label: primary?.basics.label,
        primary: person.primary,
        versions: person.versions.map(({ file, variant, cvYear }) => ({
          file,
          variant,
          cvYear,
        })),
      }
    }),
  )
  return results.filter((r) => r !== null)
})

export const getCvToolDef = toolDefinition({
  name: 'getCv',
  description:
    'Read one CV version in full: summary, strengths, key roles and skills, skill years, projects, certificates and testimonials. Contact details are not included. Use a file name returned by searchPeople.',
  inputSchema: z.object({
    file: z.string().describe('CV version file name, e.g. "p10-v3.json"'),
  }),
})

export const getCv = getCvToolDef.server(async ({ file }) => {
  const cv = await readCv(file)
  return cv ? toSharedCv(cv) : { error: `No CV version named ${file}` }
})

export const linkCvsToolDef = toolDefinition({
  name: 'linkCvs',
  description:
    'Get app links for the CV versions you recommend. Returns a link to each CV and one filterUrl that opens the search page showing exactly these CVs. Use these URLs as they are; never write CV links yourself.',
  inputSchema: z.object({
    files: z
      .array(z.string().max(40))
      .min(1)
      .max(20)
      .describe('CV version file names from searchPeople, best match first, e.g. ["p10-v3.json"]'),
  }),
})

export const linkCvs = linkCvsToolDef.server(async ({ files }) => {
  const [people, repo] = await Promise.all([readPeople(), getCvRepository()])
  return buildCvLinks(people, repo.listSearchable(), files)
})
