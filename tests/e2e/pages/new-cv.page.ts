import type { FrameLocator, Locator, Page } from '@playwright/test'
import { waitForApp } from '../fixtures/app'

export class NewCvPage {
  readonly heading: Locator
  readonly create: Locator
  readonly status: Locator
  readonly builderChat: Locator
  readonly cvAssistantButton: Locator
  readonly preview: FrameLocator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 })
    this.create = page.getByTestId('cv-create')
    this.status = page.getByRole('status').first()
    this.builderChat = page.getByRole('region', { name: 'CV builder' })
    this.cvAssistantButton = page.getByRole('button', { name: 'Open CV assistant' })
    this.preview = page.frameLocator('iframe[title="CV preview"]')
  }

  /** Opens the page from the header link, like a user would. */
  async openFromHeader() {
    await this.page.goto('/')
    await waitForApp(this.page)
    await this.page.getByTestId('nav-new-cv').click()
    await this.page.waitForURL('**/cvs/new')
  }

  field(path: string): Locator {
    return this.page.getByTestId(`field-${path}`)
  }

  previewHeading(): Locator {
    return this.preview.getByRole('heading', { level: 1 })
  }
}
