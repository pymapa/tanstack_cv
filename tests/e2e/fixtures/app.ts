import type { Page } from '@playwright/test'

/** Resolves once React has hydrated (see HydrationMarker in src/routes/__root.tsx). */
export const waitForApp = async (page: Page) => {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
}
