import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { waitForApp } from '../../fixtures/app'
import { CvPage } from '../../pages/cv.page'
import { NewCvPage } from '../../pages/new-cv.page'

test.describe('New CV', () => {
  test('should open an empty form with the CV builder chat and pass accessibility checks', async ({ page }) => {
    const newCv = new NewCvPage(page)

    await newCv.openFromHeader()

    await expect(newCv.heading).toHaveText('New CV')
    await expect(newCv.builderChat).toBeVisible()
    await expect(newCv.cvAssistantButton).toBeHidden()
    await expect(newCv.create).toBeDisabled()
    await expect(newCv.status).toHaveText('Add a name to create the CV.')
    await expectNoSeriousA11yViolations(page)
  })

  test('should create a person with the filled-in CV and open it', async ({ page }) => {
    const newCv = new NewCvPage(page)
    await newCv.openFromHeader()

    await newCv.field('basics-name').fill('Mia Newcomer')
    await newCv.field('basics-label').fill('Data Engineer')
    await expect(newCv.previewHeading()).toHaveText('Mia Newcomer')
    await newCv.create.click()

    await page.waitForURL(/\/cvs\/[0-9a-f-]+$/)
    await waitForApp(page)
    const cv = new CvPage(page)
    await expect(cv.heading).toContainText('Mia Newcomer')
    await expect(cv.label).toHaveValue('Data Engineer')
  })
})
