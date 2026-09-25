import type { CvDocument, Project } from '~/cv/schema'

type DeepPartialCv = Partial<Omit<CvDocument, 'basics' | 'meta'>> & {
  basics?: Partial<CvDocument['basics']>
  meta?: Partial<CvDocument['meta']>
}

/** Invented test data only. Never copy names or contact details from sample_data/. */
export const buildCv = (overrides: DeepPartialCv = {}): CvDocument => {
  const { basics, meta, ...rest } = overrides
  return {
    basics: {
      name: 'Anna Example',
      label: 'Software Architect',
      summary: 'Anna designs pragmatic systems and helps teams ship.',
      ...basics,
    },
    skills: [],
    projects: [],
    ...rest,
    meta: {
      personId: 'p99',
      variant: 'default',
      sourceFormat: 'pptx',
      'x-cvYear': '2026',
      ...meta,
    },
  }
}

export const buildProject = (overrides: Partial<Project> = {}): Project => ({
  name: 'Payments platform renewal',
  entity: 'Example Bank',
  ...overrides,
})
