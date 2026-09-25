import { describe, expect, it } from 'vitest'
import { checkBrand } from '~/cv/brand-check'
import { buildCv, buildProject } from '../../fixtures/cv'

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')

/** A CV that follows every rule, so each test can break exactly one. */
const onBrand = (overrides: Parameters<typeof buildCv>[0] = {}) =>
  buildCv({
    ...overrides,
    basics: {
      name: 'Anna Example',
      label: 'Software Architect',
      summary: `Anna designs payment systems. ${words(60)}`,
      'x-experienceSummary': '15 years of software development',
      'x-strengths': [{ title: 'Architect' }, { title: 'Coach' }, { title: 'Developer' }],
      'x-keyRoles': [{ title: 'Solution architect' }],
      ...overrides.basics,
    },
    projects: overrides.projects ?? [
      buildProject({ 'x-highlight': true }),
      buildProject({ name: 'Mobile bank', 'x-highlight': true }),
    ],
  })

const fields = (cv: Parameters<typeof checkBrand>[0]) => checkBrand(cv).map((f) => f.field)

describe('checkBrand', () => {
  it('should find nothing when the CV follows the Kipinä style', () => {
    expect(checkBrand(onBrand())).toEqual([])
  })

  it('should flag a summary written in the first person', () => {
    const findings = checkBrand(onBrand({ basics: { summary: `I am a developer and my focus is data. ${words(55)}` } }))

    expect(findings).toEqual([
      expect.objectContaining({ field: 'basics.summary', issue: expect.stringMatching(/third person/) }),
    ])
  })

  it.each([
    { summary: words(20), expected: /too short/ },
    { summary: `Anna codes. ${words(200)}`, expected: /too long/ },
  ])('should flag a summary that is $expected', ({ summary, expected }) => {
    const findings = checkBrand(onBrand({ basics: { summary } }))

    expect(findings).toEqual([
      expect.objectContaining({ field: 'basics.summary', issue: expect.stringMatching(expected) }),
    ])
  })

  it('should name the buzzword and the field it is in', () => {
    const cv = onBrand({ projects: [buildProject({ description: 'A results-driven team.', 'x-highlight': true })] })

    const findings = checkBrand(cv).filter((f) => f.field === 'projects[0].description')

    expect(findings).toEqual([{ field: 'projects[0].description', issue: expect.stringContaining('"results-driven"') }])
  })

  it('should match buzzwords as whole words in any case', () => {
    expect(fields(onBrand({ basics: { 'x-tagline': 'Passionate about Synergy' } }))).toEqual([
      'basics.x-tagline',
      'basics.x-tagline',
    ])
    expect(fields(onBrand({ basics: { 'x-tagline': 'Leverages compassion' } }))).toEqual([])
  })

  it('should flag exclamation marks', () => {
    expect(fields(onBrand({ basics: { 'x-strengths': [{ title: 'Great coach!' }, { title: 'A' }] } }))).toEqual([
      'basics.x-strengths[0].title',
    ])
  })

  it.each([
    { strengths: [], expected: /Add 2–4/ },
    { strengths: Array.from({ length: 6 }, () => ({ title: 'Strength' })), expected: /Keep 2–4/ },
  ])('should flag $strengths.length strengths', ({ strengths, expected }) => {
    const findings = checkBrand(onBrand({ basics: { 'x-strengths': strengths } }))

    expect(findings).toEqual([
      expect.objectContaining({ field: 'basics.x-strengths', issue: expect.stringMatching(expected) }),
    ])
  })

  it('should ask for highlighted projects when there are projects but none is highlighted', () => {
    const findings = checkBrand(onBrand({ projects: [buildProject()] }))

    expect(findings).toEqual([
      expect.objectContaining({ field: 'projects', issue: expect.stringMatching(/Highlight 2–4/) }),
    ])
  })

  it.each([
    { words: 59, flagged: true },
    { words: 60, flagged: false },
    { words: 150, flagged: false },
    { words: 151, flagged: true },
  ])('should flag a $words-word summary: $flagged', ({ words: count, flagged }) => {
    const findings = checkBrand(onBrand({ basics: { summary: words(count) } }))

    expect(findings.some((f) => f.field === 'basics.summary')).toBe(flagged)
  })

  it.each([
    { count: 1, flagged: true },
    { count: 4, flagged: false },
    { count: 5, flagged: true },
  ])('should flag $count strengths: $flagged', ({ count, flagged }) => {
    const strengths = Array.from({ length: count }, () => ({ title: 'Strength' }))

    const findings = checkBrand(onBrand({ basics: { 'x-strengths': strengths } }))

    expect(findings.some((f) => f.field === 'basics.x-strengths')).toBe(flagged)
  })

  it.each([
    { count: 1, flagged: true },
    { count: 2, flagged: false },
    { count: 4, flagged: false },
    { count: 5, flagged: true },
  ])('should flag $count highlighted projects: $flagged', ({ count, flagged }) => {
    const projects = [...Array.from({ length: count }, () => buildProject({ 'x-highlight': true })), buildProject()]

    const findings = checkBrand(onBrand({ projects }))

    expect(findings.some((f) => f.field === 'projects')).toBe(flagged)
  })

  it('should flag missing label, experience summary and key roles', () => {
    const cv = onBrand({ basics: { label: '', 'x-experienceSummary': undefined, 'x-keyRoles': [] } })

    expect(fields(cv)).toEqual(['basics.label', 'basics.x-experienceSummary', 'basics.x-keyRoles'])
  })

  it('should not report CV text in its findings', () => {
    const cv = onBrand({ basics: { summary: `I build things! ${words(10)} synergy` } })

    const issues = checkBrand(cv).map((f) => f.issue)

    expect(issues.join(' ')).not.toContain('I build things')
  })
})
