import type { Locator, Page } from '@playwright/test'
import { waitForApp } from '../fixtures/app'

export class SearchPage {
  readonly input: Locator
  readonly status: Locator
  readonly results: Locator

  constructor(private readonly page: Page) {
    this.input = page.getByTestId('search-input')
    this.status = page.getByRole('status').filter({ hasText: /people|person/ })
    this.results = page.getByRole('list', { name: 'Search results' }).getByRole('listitem')
  }

  async goto(query = '') {
    await this.page.goto(query === '' ? '/' : `/?q=${encodeURIComponent(query)}`)
    await waitForApp(this.page)
  }

  async gotoSuggested(cvIds: readonly string[]) {
    await this.page.goto(`/?cv=${encodeURIComponent(JSON.stringify(cvIds))}`)
    await waitForApp(this.page)
  }

  get showAllCvs(): Locator {
    return this.page.getByTestId('show-all-cvs')
  }

  async search(query: string) {
    await this.input.fill(query)
  }

  resultFor(name: string): Locator {
    return this.results.filter({ has: this.page.getByRole('heading', { name }) })
  }

  facet(name: RegExp | string): Locator {
    return this.page.getByRole('complementary', { name: 'Filters' }).getByRole('checkbox', { name })
  }

  async openFirstCvOf(name: string) {
    await this.resultFor(name).getByTestId('result-cv-link').first().click()
    await this.page.waitForURL(/\/cvs\//)
  }
}
