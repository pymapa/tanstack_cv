import { describe, expect, it } from 'vitest'
import { validateCv } from '~/features/editor/validation'
import { buildCv, buildProject } from '../../../fixtures/cv'

describe('validateCv', () => {
  it('should return no issues when the CV is valid', () => {
    expect(validateCv(buildCv())).toEqual([])
  })

  it('should map an over-long summary to the basics.summary path', () => {
    const issues = validateCv(buildCv({ basics: { summary: 'a'.repeat(5001) } }))

    expect(issues.map((i) => i.path)).toContain('basics.summary')
  })

  it('should use dotted paths with indexes for array items', () => {
    const issues = validateCv(buildCv({ projects: [buildProject(), buildProject({ startDate: 'spring' })] }))

    expect(issues.map((i) => i.path)).toContain('projects.1.startDate')
    expect(issues.find((i) => i.path === 'projects.1.startDate')?.message).toMatch(/YYYY/)
  })
})
