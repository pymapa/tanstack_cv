import { describe, expect, it } from 'vitest'
import { CV_TEMPLATE_IDS } from '~/cv/schema'
import { CV_TEMPLATES, DEFAULT_TEMPLATE, templateContent, templateOf } from '~/pdf/template/templates'
import { buildCv, buildProject } from '../../fixtures/cv'

describe('templateOf', () => {
  it('should return the portrait template when the CV has no template', () => {
    expect(templateOf(buildCv())).toBe('kipina-portrait')
    expect(DEFAULT_TEMPLATE).toBe('kipina-portrait')
  })

  it('should return the template stored in the CV', () => {
    expect(templateOf(buildCv({ meta: { 'x-template': 'kipina-landscape' } }))).toBe('kipina-landscape')
  })
})

describe('CV_TEMPLATES', () => {
  it('should describe every template id the schema allows', () => {
    expect(Object.keys(CV_TEMPLATES).toSorted()).toEqual([...CV_TEMPLATE_IDS].toSorted())
  })

  it.each(CV_TEMPLATE_IDS)('should give %s a preview width that matches its orientation', (id) => {
    const expected = CV_TEMPLATES[id].label.includes('landscape') ? 1123 : 794

    expect(CV_TEMPLATES[id].pageWidthPx).toBe(expected)
  })
})

describe('templateContent', () => {
  const cv = buildCv({
    skills: [{ name: 'Backend' }],
    projects: [buildProject({ name: 'Star project', 'x-highlight': true }), buildProject({ name: 'Other project' })],
    work: [{ name: 'Example Oy' }],
    education: [{ institution: 'Example University' }],
    certificates: [{ name: 'Certified Tester' }],
    languages: [{ language: 'Finnish' }],
  })

  it('should keep the whole CV for the default templates', () => {
    expect(templateContent('kipina-portrait', cv)).toEqual(cv)
  })

  it('should keep only the profile and project highlights for the one-page summary', () => {
    const summary = templateContent('kipina-one-page', cv)

    expect(summary.basics).toEqual(cv.basics)
    expect(summary.projects.map((p) => p.name)).toEqual(['Star project'])
    expect(summary.skills).toEqual([])
    expect(summary.work).toBeUndefined()
    expect(summary.education).toBeUndefined()
    expect(summary.certificates).toBeUndefined()
    expect(summary.languages).toBeUndefined()
  })

  it('should keep key role and key skill titles without descriptions in the one-page summary', () => {
    const withRoles = buildCv({
      basics: {
        'x-keyRoles': [{ title: 'Tech lead', description: 'Leads teams' }],
        'x-keySkills': [{ title: 'Cloud', description: 'Builds platforms' }],
      },
    })

    const summary = templateContent('kipina-one-page', withRoles)

    expect(summary.basics['x-keyRoles']).toEqual([{ title: 'Tech lead' }])
    expect(summary.basics['x-keySkills']).toEqual([{ title: 'Cloud' }])
  })

  it('should keep at most three project highlights in the one-page summary', () => {
    const many = buildCv({
      projects: ['A', 'B', 'C', 'D'].map((name) => buildProject({ name, 'x-highlight': true })),
    })

    expect(templateContent('kipina-one-page', many).projects.map((p) => p.name)).toEqual(['A', 'B', 'C'])
  })
})
