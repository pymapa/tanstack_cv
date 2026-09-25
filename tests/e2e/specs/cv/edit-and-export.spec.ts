import { expect, test } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { waitForApp } from '../../fixtures/app'
import { CvPage } from '../../pages/cv.page'
import { SearchPage } from '../../pages/search.page'

const openCvOf = async (page: import('@playwright/test').Page, name: string) => {
  const search = new SearchPage(page)
  await search.goto(name)
  await search.openFirstCvOf(name)
  const cv = new CvPage(page)
  await expect(cv.heading).toContainText(name)
  await waitForApp(page)
  return cv
}

test.describe('CV editor', () => {
  test('should show the live preview and pass accessibility checks', async ({ page }) => {
    const cv = await openCvOf(page, 'Daniel Brandt')

    await expect(cv.previewHeading()).toHaveText('Daniel Brandt')
    await expectNoSeriousA11yViolations(page)
  })

  test('should update the preview and save a new revision when the title changes', async ({ page }) => {
    const cv = await openCvOf(page, 'Eero Salmela')

    await cv.setLabel('Principal Software Developer')
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(cv.previewText('Principal Software Developer')).toBeVisible()

    await cv.saveWithShortcut()

    await expect(page.getByText(/Saved as revision 2\./)).toBeVisible()
    await page.reload()
    await waitForApp(page)
    await expect(cv.label).toHaveValue('Principal Software Developer')
  })

  test('should block saving while the CV has a validation problem', async ({ page }) => {
    const cv = await openCvOf(page, 'Heikki Rautanen')

    await cv.openSection('Projects')
    await cv.field('projects-0-startDate').fill('spring 2020')

    await expect(cv.save).toBeDisabled()
    await expect(page.getByText(/problem to fix before saving/)).toBeVisible()
  })
})

test.describe('PDF export', () => {
  test('should download a tagged PDF with a safe file name', async ({ page }) => {
    const cv = await openCvOf(page, 'Ilkka Toivola')

    const [download] = await Promise.all([page.waitForEvent('download'), cv.downloadPdf.click()])

    expect(download.suggestedFilename()).toMatch(/^Kipina_CV_Ilkka_Toivola_[A-Za-z0-9-]+_\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  test('should serve a tagged, uncached PDF with the machine-readable CV attached', async ({ page, request }) => {
    await openCvOf(page, 'Ilkka Toivola')
    const cvPath = new URL(page.url()).pathname

    const response = await request.get(`/api${cvPath}/pdf`)
    const pdf = await PDFDocument.load(await response.body())

    expect(response.headers()['content-type']).toBe('application/pdf')
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(pdf.catalog.has(PDFName.of('StructTreeRoot'))).toBe(true)
    expect(pdf.catalog.has(PDFName.of('Names'))).toBe(true) // embedded cv.json
    expect(pdf.getTitle()).toContain('Ilkka Toivola')
  })

  test('should return 404 for an unknown CV', async ({ request }) => {
    const response = await request.get('/api/cvs/00000000-0000-7000-8000-000000000000/pdf')

    expect(response.status()).toBe(404)
  })
})
