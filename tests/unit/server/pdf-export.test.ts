import { describe, expect, it } from 'vitest'
import { pdfFileName, toExportDocument } from '~/server/services/pdf-export'
import { buildCv, buildProject } from '../../fixtures/cv'

describe('pdfFileName', () => {
  it('should fold diacritics and join parts with underscores', () => {
    const name = pdfFileName('Äke Öhman-Lindén', 'SM-PO', new Date('2026-09-25T12:00:00Z'))

    expect(name).toBe('Kipina_CV_Ake_Ohman-Linden_SM-PO_2026-09-25.pdf')
  })

  it('should strip characters that could break a Content-Disposition header', () => {
    const name = pdfFileName('Anna "x"\r\nSet-Cookie: a', '../../etc', new Date('2026-01-01T00:00:00Z'))

    expect(name).toMatch(/^[A-Za-z0-9_.-]+$/)
    expect(name).not.toContain('..')
  })
})

describe('toExportDocument', () => {
  const cv = buildCv({
    basics: {
      email: 'anna@example.com',
      phone: '+358 40 000 0000',
      profiles: [{ network: 'LinkedIn', url: 'https://example.com/anna' }],
    },
    projects: [buildProject({ 'x-note': 'internal conversion note' })],
    meta: { 'x-conversionNotes': ['internal'], 'x-template': 'kipina-landscape' },
  })

  it('should remove contact details when they are not included', () => {
    const doc = toExportDocument(cv, { includeContact: false, anonymizeClients: false })

    expect(doc.basics.email).toBeUndefined()
    expect(doc.basics.phone).toBeUndefined()
    expect(doc.basics.profiles).toBeUndefined()
  })

  it('should keep contact details when they are included', () => {
    expect(toExportDocument(cv, { includeContact: true, anonymizeClients: false }).basics.email).toBe(
      'anna@example.com',
    )
  })

  it('should never export internal conversion notes', () => {
    const json = JSON.stringify(toExportDocument(cv, { includeContact: true, anonymizeClients: false }))

    expect(json).not.toContain('internal')
  })

  it('should replace client names with industries when anonymizing', () => {
    const doc = toExportDocument(cv, { includeContact: false, anonymizeClients: true })

    expect(JSON.stringify(doc)).not.toContain('Example Bank')
  })

  it('should keep client names when not anonymizing', () => {
    const doc = toExportDocument(cv, { includeContact: false, anonymizeClients: false })

    expect(doc.projects[0]?.entity).toBe('Example Bank')
  })

  it('should not export the template choice', () => {
    expect(toExportDocument(cv, { includeContact: true, anonymizeClients: false }).meta['x-template']).toBeUndefined()
  })
})
