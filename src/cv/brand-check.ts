import type { CvDocument } from './schema'

/**
 * Checks a CV against the Kipinä CV style, as seen in the sample CVs: a third-person summary
 * of 60–150 words, 2–4 "In a nutshell" strengths, 2–4 highlighted projects, and plain
 * language without buzzwords or exclamation marks.
 *
 * Pure and deterministic. Findings name the field and the rule, never the CV text, so they can
 * be shown in the UI or handed to the CV builder agent.
 */

export type BrandFinding = Readonly<{ field: string; issue: string }>

const BUZZWORDS = [
  'passionate',
  'synergy',
  'synergies',
  'results-driven',
  'leverage',
  'world-class',
  'rockstar',
  'ninja',
  'guru',
  'go-getter',
  'self-starter',
  'dynamic',
  'cutting-edge',
  'best-in-class',
  'thought leader',
  'team player',
  'hard-working',
  'detail-oriented',
  'think outside the box',
] as const

const buzzwordPattern = (word: string) => new RegExp(`(?<![\\p{L}\\p{N}-])${word}(?![\\p{L}\\p{N}-])`, 'iu')
const BUZZWORD_PATTERNS = BUZZWORDS.map((word) => ({ word, pattern: buzzwordPattern(word) }))

const FIRST_PERSON = /(?<![\p{L}\p{N}])(?:I|I'm|I've|me|my|mine)(?![\p{L}\p{N}'])/u
const MIN_SUMMARY_WORDS = 60
const MAX_SUMMARY_WORDS = 150
const MIN_HIGHLIGHTS = 2
const MAX_HIGHLIGHTS = 4
const MAX_STRENGTHS = 4

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

type Text = Readonly<{ field: string; text: string }>

const optional = (field: string, text: string | undefined): Text[] => (text ? [{ field, text }] : [])

const titled = (field: string, items: CvDocument['basics']['x-strengths']): Text[] =>
  (items ?? []).flatMap((item, i) => [
    ...optional(`${field}[${i}].title`, item.title),
    ...optional(`${field}[${i}].description`, item.description),
  ])

/** The free-text fields a reader sees as prose. */
const proseFields = ({ basics, projects }: CvDocument): Text[] => [
  ...optional('basics.label', basics.label),
  ...optional('basics.summary', basics.summary),
  ...optional('basics.x-tagline', basics['x-tagline']),
  ...titled('basics.x-strengths', basics['x-strengths']),
  ...titled('basics.x-keyRoles', basics['x-keyRoles']),
  ...titled('basics.x-keySkills', basics['x-keySkills']),
  ...projects.flatMap((p, i) => optional(`projects[${i}].description`, p.description)),
]

const wordingFindings = ({ field, text }: Text): BrandFinding[] => [
  ...BUZZWORD_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ word }) => ({
    field,
    issue: `Replace the buzzword "${word}" with a concrete result or skill.`,
  })),
  ...(text.includes('!') ? [{ field, issue: 'Remove the exclamation mark. Kipinä CVs keep a calm tone.' }] : []),
]

const summaryFindings = (summary: string): BrandFinding[] => {
  const field = 'basics.summary'
  const count = wordCount(summary)
  return [
    ...(FIRST_PERSON.test(summary)
      ? [{ field, issue: 'Write the summary in the third person with the first name, e.g. "Anna has…".' }]
      : []),
    ...(count < MIN_SUMMARY_WORDS
      ? [{ field, issue: `The summary is too short (${count} words). Aim for 60–150 words.` }]
      : []),
    ...(count > MAX_SUMMARY_WORDS
      ? [{ field, issue: `The summary is too long (${count} words). Aim for 60–150 words.` }]
      : []),
  ]
}

const structureFindings = ({ basics, projects }: CvDocument): BrandFinding[] => {
  const strengths = basics['x-strengths']?.length ?? 0
  const highlighted = projects.filter((p) => p['x-highlight'] === true).length
  return [
    ...(basics.label.trim() === ''
      ? [{ field: 'basics.label', issue: 'Add a title, e.g. "Software Architect".' }]
      : []),
    ...(basics['x-experienceSummary']
      ? []
      : [
          {
            field: 'basics.x-experienceSummary',
            issue: 'Add a one-line experience summary, e.g. "15+ years in software".',
          },
        ]),
    ...(strengths < 2 ? [{ field: 'basics.x-strengths', issue: 'Add 2–4 strengths for "In a nutshell".' }] : []),
    ...(strengths > MAX_STRENGTHS
      ? [{ field: 'basics.x-strengths', issue: 'Keep 2–4 strengths so the cover stays skimmable.' }]
      : []),
    ...((basics['x-keyRoles']?.length ?? 0) === 0 ? [{ field: 'basics.x-keyRoles', issue: 'Add the key roles.' }] : []),
    // A CV with a single project can't highlight two.
    ...(projects.length > 0 && (highlighted < Math.min(MIN_HIGHLIGHTS, projects.length) || highlighted > MAX_HIGHLIGHTS)
      ? [{ field: 'projects', issue: 'Highlight 2–4 projects that best show the person’s strengths.' }]
      : []),
  ]
}

export const checkBrand = (cv: CvDocument): BrandFinding[] => [
  ...summaryFindings(cv.basics.summary),
  ...proseFields(cv).flatMap(wordingFindings),
  ...structureFindings(cv),
]
