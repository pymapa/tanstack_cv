import { PDFDocument } from 'pdf-lib'
import { afterAll, describe, expect, it } from 'vitest'
import { closePdfRenderer } from '~/server/pdf/render'
import { createMemoryCvRepository } from '~/server/repositories/memory-cv-repository'
import { exportCvPdf } from '~/server/services/pdf-export'
import { buildCv } from '../fixtures/cv'

afterAll(async () => {
  await closePdfRenderer()
})

describe('exportCvPdf', () => {
  it('should print the PDF with the template saved in the CV', async () => {
    let counter = 0
    const repo = createMemoryCvRepository(
      [
        {
          legacyId: 'p99',
          fullName: 'Anna Example',
          versions: [{ document: buildCv({ meta: { 'x-template': 'kipina-landscape' } }), isPrimary: true }],
        },
      ],
      { clock: () => new Date('2026-09-25T10:00:00.000Z'), idGen: () => `id-${String(++counter)}` },
    )
    const cvId = repo.listSearchable()[0]?.cvId ?? ''

    const result = await exportCvPdf(repo, cvId, { includeContact: false, anonymizeClients: false })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { width, height } = (await PDFDocument.load(result.value.bytes)).getPage(0).getSize()
    expect(width).toBeGreaterThan(height)
  }, 30_000)

  it('should keep skill keywords in the metadata when the template hides the skills section', async () => {
    let counter = 0
    const repo = createMemoryCvRepository(
      [
        {
          legacyId: 'p99',
          fullName: 'Anna Example',
          versions: [
            {
              document: buildCv({
                skills: [{ name: 'Backend', keywords: ['Kotlin'] }],
                meta: { 'x-template': 'kipina-one-page' },
              }),
              isPrimary: true,
            },
          ],
        },
      ],
      { clock: () => new Date('2026-09-25T10:00:00.000Z'), idGen: () => `id-${String(++counter)}` },
    )
    const cvId = repo.listSearchable()[0]?.cvId ?? ''

    const result = await exportCvPdf(repo, cvId, { includeContact: false, anonymizeClients: false })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect((await PDFDocument.load(result.value.bytes)).getKeywords()).toContain('Kotlin')
  }, 30_000)
})
