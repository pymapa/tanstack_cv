import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CvDocument, CvTemplateId } from '~/cv/schema'
import { CvHtmlDocument } from './cv-document'
import { CV_TEMPLATES, DEFAULT_TEMPLATE, templateContent } from './templates'

export type CvRenderOptions = Readonly<{ includeContact: boolean; template?: CvTemplateId }>

/** Client exports default to no contact details (spec §7.7). */
export const DEFAULT_RENDER_OPTIONS: CvRenderOptions = { includeContact: false }

/**
 * Renders a CV to a complete, self-contained HTML document: inline CSS, embedded fonts and logo,
 * no scripts and no external resources. React escapes all CV text.
 */
export function renderCvHtml(cv: CvDocument, options: CvRenderOptions = DEFAULT_RENDER_OPTIONS): string {
  const id = options.template ?? DEFAULT_TEMPLATE
  const document = createElement(CvHtmlDocument, { cv: templateContent(id, cv), options, template: CV_TEMPLATES[id] })
  return `<!doctype html>${renderToStaticMarkup(document)}`
}
