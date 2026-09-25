import { anonymizeClients } from '~/cv/anonymize'
import type { CvDocument } from '~/cv/schema'
import { skillNames } from '~/cv/skills'
import { err, ok, type Result } from '~/lib/result'
import { renderCvHtml, type CvRenderOptions } from '~/pdf/template/render-html'
import type { CvRepository } from '../repositories/cv-repository'
import { renderPdf } from '../pdf/render'

const asciiPart = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 60)

/** `Kipina_CV_<First>_<Last>_<variant>_<YYYY-MM-DD>.pdf`: ASCII only, safe in a header. */
export const pdfFileName = (fullName: string, variant: string, now: Date): string =>
  ['Kipina_CV', asciiPart(fullName), asciiPart(variant), now.toISOString().slice(0, 10)]
    .filter((part) => part !== '')
    .join('_')
    .concat('.pdf')

export type ExportOptions = CvRenderOptions & Readonly<{ anonymizeClients: boolean }>

/** The JSON that goes to clients: no internal notes, contact details only on request. */
export const toExportDocument = (cv: CvDocument, options: ExportOptions): CvDocument => {
  const { email: _email, phone: _phone, profiles: _profiles, url: _url, ...basicsWithoutContact } = cv.basics
  const { 'x-conversionNotes': _notes, ...meta } = cv.meta
  const clientFacing = options.anonymizeClients ? anonymizeClients(cv) : cv
  return {
    ...clientFacing,
    basics: options.includeContact ? cv.basics : basicsWithoutContact,
    projects: clientFacing.projects.map(({ 'x-note': _note, ...project }) => project),
    ...(cv.work === undefined ? {} : { work: cv.work.map(({ 'x-note': _note, ...work }) => work) }),
    meta,
  }
}

export type PdfExport = Readonly<{ bytes: Uint8Array; fileName: string }>

export const exportCvPdf = async (
  repo: CvRepository,
  cvId: string,
  options: ExportOptions,
  now: Date = new Date(),
): Promise<Result<PdfExport, 'NOT_FOUND'>> => {
  const cv = repo.getCv(cvId)
  if (cv === null) return err('NOT_FOUND')
  const doc = toExportDocument(cv.revision.data, options)
  const topSkills = doc.skills.flatMap(skillNames).slice(0, 12)
  const bytes = await renderPdf(renderCvHtml(doc, options), {
    title: `${doc.basics.name} – ${doc.basics.label} – Kipinä CV`,
    subject: `CV of ${doc.basics.name} (${cv.variant})`,
    keywords: topSkills,
    attachment: { fileName: 'cv.json', json: JSON.stringify(doc, null, 2) },
  })
  return ok({ bytes, fileName: pdfFileName(cv.person.fullName, cv.variant, now) })
}
