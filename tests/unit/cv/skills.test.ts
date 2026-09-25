import { describe, expect, it } from 'vitest'
import { skillNames, skillTerms } from '~/cv/skills'

describe('skillTerms', () => {
  it('should keep only keywords that have no technology row, ignoring case', () => {
    const terms = skillTerms({
      name: 'Backend',
      keywords: ['kotlin', 'GraphQL'],
      'x-skillDetails': [{ name: 'Kotlin' }],
    })

    expect(terms.keywords).toEqual(['GraphQL'])
  })

  it('should drop repeated keywords', () => {
    expect(skillTerms({ name: 'Cloud', keywords: ['Azure', 'azure', 'AWS'] }).keywords).toEqual(['Azure', 'AWS'])
  })

  it('should list rows before keywords', () => {
    const names = skillNames({ name: 'Backend', keywords: ['GraphQL'], 'x-skillDetails': [{ name: 'Kotlin' }] })

    expect(names).toEqual(['Kotlin', 'GraphQL'])
  })
})
