import type { CvDocument } from './schema'

const NO_INDUSTRY = 'Confidential client'

export const anonymizeClients = (cv: CvDocument): CvDocument => ({
  ...cv,
  projects: cv.projects.map(({ 'x-industry': industry, ...project }) => ({
    ...project,
    entity: industry ?? NO_INDUSTRY,
  })),
})
