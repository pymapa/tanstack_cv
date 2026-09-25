import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { SearchPage } from '../../pages/search.page'

test.describe('suggested CVs link', () => {
  test('should show only the suggested CVs and return to all CVs', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto()
    await search.openFirstCvOf('Sami Lindroos')
    const cvId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    await search.gotoSuggested([cvId])

    await expect(search.status).toHaveText('1 person, 1 CV')
    await expect(search.resultFor('Sami Lindroos')).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await search.showAllCvs.click()
    await expect(search.status).toHaveText('28 people, 36 CVs')
  })
})
