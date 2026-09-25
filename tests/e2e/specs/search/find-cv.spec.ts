import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../../fixtures/a11y'
import { waitForApp } from '../../fixtures/app'
import { SearchPage } from '../../pages/search.page'

test.describe('search', () => {
  test('should list every sample CV when the query is empty', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto()

    await expect(search.status).toHaveText('28 people, 36 CVs')
    await expectNoSeriousA11yViolations(page)
  })

  test('should find a person by skill and client when typing', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto()

    await search.search('Scrum Kanervapankki')

    await expect(page).toHaveURL(/q=Scrum/)
    await expect(search.resultFor('Sami Lindroos')).toBeVisible()
    await expect(search.resultFor('Sami Lindroos').locator('mark').first()).toBeVisible()
  })

  test('should narrow results with a facet and keep it in the URL', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto()

    // Controlled by the URL: the box turns checked once the navigation lands.
    await search.facet(/^Finance/).click()

    await expect(search.facet(/^Finance/)).toBeChecked()
    await expect(page).toHaveURL(/industry=/)
    await expect(search.status).not.toHaveText('28 people, 36 CVs')
    await page.reload()
    await waitForApp(page)
    await expect(search.facet(/^Finance/)).toBeChecked()
  })

  test('should match names without typing Finnish letters', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('Henri Makinen')

    await expect(search.resultFor('Henri Mäkinen')).toBeVisible()
  })

  test('should show a helpful empty state when nothing matches', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('zzzqqq')

    await expect(search.status).toHaveText('0 people, 0 CVs')
    await expect(page.getByText('Nothing matches yet.')).toBeVisible()
  })
})
