import { expect, type Page } from '@playwright/test'
import { CvPage } from '../pages/cv.page'
import { SearchPage } from '../pages/search.page'

/** Resolves once React has hydrated (see HydrationMarker in src/routes/__root.tsx). */
export const waitForApp = async (page: Page) => {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
}

/** Searches for a person and opens their first CV. */
export const openCvOf = async (page: Page, name: string) => {
  const search = new SearchPage(page)
  await search.goto(name)
  await search.openFirstCvOf(name)
  const cv = new CvPage(page)
  await expect(cv.heading).toContainText(name)
  await waitForApp(page)
  return cv
}
