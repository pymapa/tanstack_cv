import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { waitForApp } from '../../fixtures/app'
import { CvPage } from '../../pages/cv.page'
import { SearchPage } from '../../pages/search.page'

// Adds CVs to the shared store: keep this file sorted after specs/search, which count every CV.
const NAME = 'Kevin Rask'

const openCv = async (page: import('@playwright/test').Page) => {
  const search = new SearchPage(page)
  await search.goto(NAME)
  await search.openFirstCvOf(NAME)
  const cv = new CvPage(page)
  await expect(cv.heading).toContainText(NAME)
  await waitForApp(page)
  return cv
}

test.describe('Save as new version', () => {
  test('should open a new named version holding the unsaved edits and keep the original', async ({ page }) => {
    const cv = await openCv(page)
    const originalUrl = page.url()
    const originalLabel = await cv.label.inputValue()
    await cv.setLabel('Cloud Architect for Client X')

    await cv.saveAsNew.click()
    await expect(cv.versionDialog).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await cv.versionName.fill('E2E Client X')
    await page.getByTestId('cv-version-create').click()

    await expect(cv.heading).toContainText('E2E Client X')
    await waitForApp(page)
    expect(page.url()).not.toBe(originalUrl)
    await expect(cv.label).toHaveValue('Cloud Architect for Client X')
    await page.goto(originalUrl)
    await waitForApp(page)
    await expect(cv.label).toHaveValue(originalLabel)
  })

  test('should refuse a name the person already uses', async ({ page }) => {
    const cv = await openCv(page)
    await cv.saveAsNewVersion('E2E Duplicate')
    await expect(cv.heading).toContainText('E2E Duplicate')
    await waitForApp(page)

    await cv.saveAsNewVersion('e2e duplicate')

    await expect(cv.versionDialog.getByText(`${NAME} already has a version with this name.`)).toBeVisible()
  })
})
