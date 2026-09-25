import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { openCvOf, waitForApp } from '../../fixtures/app'

// The E2E server runs with AI_PROVIDER=fake, which prefixes every translated text with "[FI] ".
test.describe('CV translation', () => {
  test('should translate, let the user review and fix it, and save it as a new version', async ({ page }) => {
    const cv = await openCvOf(page, 'Matti Saarela')
    const originalLabel = await cv.label.inputValue()

    await cv.translate.click()

    await expect(cv.heading).toContainText('Finnish translation of default')
    await expect(page.getByRole('note')).toContainText('Review the translation before you save it')
    await expect(cv.label).toHaveValue(`[FI] ${originalLabel}`)
    await expect(cv.previewHeading()).toHaveText('Matti Saarela')
    await expect(cv.previewTitle()).toHaveText(`[FI] ${originalLabel}`)
    await expectNoSeriousA11yViolations(page)

    await cv.previewVersion('Original').click()
    await expect(cv.previewTitle()).toHaveText(originalLabel)

    await cv.setLabel('Ohjelmistokehittäjä')
    await expect(cv.translationVariant).toHaveValue('default-fi')
    await cv.saveTranslation.click()

    await expect(cv.heading).toContainText('default-fi')
    await waitForApp(page)
    await expect(cv.label).toHaveValue('Ohjelmistokehittäjä')
  })

  test('should leave the CV unchanged when the translation is discarded', async ({ page }) => {
    const cv = await openCvOf(page, 'Pasi Harjula')
    const originalLabel = await cv.label.inputValue()

    await cv.translate.click()
    await expect(cv.saveTranslation).toBeVisible()
    await cv.discardTranslation.click()

    await expect(cv.label).toHaveValue(originalLabel)
    await expect(cv.heading).not.toContainText('translation')
  })
})
