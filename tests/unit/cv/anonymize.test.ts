import { describe, expect, it } from 'vitest'
import { anonymizeClients } from '~/cv/anonymize'
import { buildCv, buildProject } from '../../fixtures/cv'

describe('anonymizeClients', () => {
  it('should replace each project client with its industry', () => {
    const cv = buildCv({ projects: [buildProject({ entity: 'Example Bank', 'x-industry': 'Retail banking' })] })

    const [project] = anonymizeClients(cv).projects

    expect(project?.entity).toBe('Retail banking')
    expect(project?.['x-industry']).toBeUndefined()
  })

  it('should use a neutral label when a project has no industry', () => {
    const cv = buildCv({ projects: [buildProject({ entity: 'Example Bank' })] })

    expect(anonymizeClients(cv).projects[0]?.entity).toBe('Confidential client')
  })

  it('should leave no client name anywhere in the projects', () => {
    const cv = buildCv({
      projects: [
        buildProject({ entity: 'Example Bank', 'x-industry': 'Banking' }),
        buildProject({ entity: 'Sample Insurance' }),
      ],
    })

    const json = JSON.stringify(anonymizeClients(cv))

    expect(json).not.toContain('Example Bank')
    expect(json).not.toContain('Sample Insurance')
  })
})
