import type { CvDocument, CvTemplateId } from '~/cv/schema'
import { LANDSCAPE_STYLES, PORTRAIT_STYLES } from './styles'

export type CvTemplate = Readonly<{ label: string; pageWidthPx: number; styles: string }>

export const DEFAULT_TEMPLATE: CvTemplateId = 'kipina-portrait'

export const CV_TEMPLATES: Readonly<Record<CvTemplateId, CvTemplate>> = {
  'kipina-portrait': { label: 'Portrait (A4)', pageWidthPx: 794, styles: PORTRAIT_STYLES },
  'kipina-landscape': { label: 'Landscape (A4)', pageWidthPx: 1123, styles: LANDSCAPE_STYLES },
}

export const templateOf = (cv: CvDocument): CvTemplateId => cv.meta['x-template'] ?? DEFAULT_TEMPLATE
