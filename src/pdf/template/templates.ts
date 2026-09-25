import type { ComponentType } from 'react'
import type { CvDocument, CvTemplateId, TitledItem } from '~/cv/schema'
import { CvDocumentView } from './cv-document'
import { EDITORIAL_STYLES, ONE_PAGE_STYLES, SIDEBAR_STYLES, SLIDES_STYLES } from './experimental-styles'
import { SidebarLayout } from './layouts/sidebar'
import type { CvRenderOptions } from './render-html'
import { LANDSCAPE_STYLES, PORTRAIT_STYLES } from './styles'

export type CvTemplate = Readonly<{
  label: string
  pageWidthPx: number
  styles: string
  Layout: ComponentType<Readonly<{ cv: CvDocument; options: CvRenderOptions }>>
  content: (cv: CvDocument) => CvDocument
}>

const PORTRAIT_PX = 794
const LANDSCAPE_PX = 1123

const wholeCv = (cv: CvDocument): CvDocument => cv

const ONE_PAGE_MAX_HIGHLIGHTS = 3

const titlesOnly = (items: TitledItem[] | undefined): TitledItem[] | undefined => items?.map(({ title }) => ({ title }))

const profileAndHighlights = (cv: CvDocument): CvDocument => {
  const { work: _work, education: _education, certificates: _certificates, languages: _languages, ...rest } = cv
  const { 'x-keyRoles': keyRoles, 'x-keySkills': keySkills, ...basics } = cv.basics
  const roles = titlesOnly(keyRoles)
  const skills = titlesOnly(keySkills)
  return {
    ...rest,
    basics: {
      ...basics,
      ...(roles === undefined ? {} : { 'x-keyRoles': roles }),
      ...(skills === undefined ? {} : { 'x-keySkills': skills }),
    },
    skills: [],
    projects: cv.projects.filter((p) => p['x-highlight'] === true).slice(0, ONE_PAGE_MAX_HIGHLIGHTS),
  }
}

export const DEFAULT_TEMPLATE: CvTemplateId = 'kipina-portrait'

export const CV_TEMPLATES: Readonly<Record<CvTemplateId, CvTemplate>> = {
  'kipina-portrait': {
    label: 'Default (portrait A4)',
    pageWidthPx: PORTRAIT_PX,
    styles: PORTRAIT_STYLES,
    Layout: CvDocumentView,
    content: wholeCv,
  },
  'kipina-landscape': {
    label: 'Default (landscape A4)',
    pageWidthPx: LANDSCAPE_PX,
    styles: LANDSCAPE_STYLES,
    Layout: CvDocumentView,
    content: wholeCv,
  },
  'kipina-sidebar': {
    label: 'Experimental: Sidebar (portrait A4)',
    pageWidthPx: PORTRAIT_PX,
    styles: SIDEBAR_STYLES,
    Layout: SidebarLayout,
    content: wholeCv,
  },
  'kipina-editorial': {
    label: 'Experimental: Editorial (portrait A4)',
    pageWidthPx: PORTRAIT_PX,
    styles: EDITORIAL_STYLES,
    Layout: CvDocumentView,
    content: wholeCv,
  },
  'kipina-slides': {
    label: 'Experimental: Slides (landscape A4)',
    pageWidthPx: LANDSCAPE_PX,
    styles: SLIDES_STYLES,
    Layout: CvDocumentView,
    content: wholeCv,
  },
  'kipina-one-page': {
    label: 'Experimental: One-page summary (portrait A4)',
    pageWidthPx: PORTRAIT_PX,
    styles: ONE_PAGE_STYLES,
    Layout: CvDocumentView,
    content: profileAndHighlights,
  },
}

export const templateOf = (cv: CvDocument): CvTemplateId => cv.meta['x-template'] ?? DEFAULT_TEMPLATE

export const templateContent = (id: CvTemplateId, cv: CvDocument): CvDocument => CV_TEMPLATES[id].content(cv)
