import type { FrameLocator, Locator, Page } from '@playwright/test'

export class CvPage {
  readonly heading: Locator
  readonly save: Locator
  readonly saveStatus: Locator
  readonly label: Locator
  readonly preview: FrameLocator
  readonly downloadPdf: Locator
  readonly saveAsNew: Locator
  readonly versionDialog: Locator
  readonly versionName: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 })
    this.save = page.getByTestId('cv-save')
    this.saveStatus = page.getByRole('status').first()
    this.label = page.getByTestId('field-basics-label')
    this.preview = page.frameLocator('iframe[title="CV preview"]')
    this.downloadPdf = page.getByTestId('cv-download-pdf')
    this.saveAsNew = page.getByTestId('cv-save-as-new')
    this.versionDialog = page.getByRole('dialog', { name: 'Save as new version' })
    this.versionName = page.getByTestId('cv-version-name')
  }

  previewHeading(): Locator {
    return this.preview.getByRole('heading', { level: 1 })
  }

  previewText(text: string): Locator {
    return this.preview.getByText(text)
  }

  field(path: string): Locator {
    return this.page.getByTestId(`field-${path}`)
  }

  async openSection(title: string) {
    const toggle = this.page.getByRole('button', { name: new RegExp(`^${title}`), expanded: false })
    if (await toggle.isVisible()) await toggle.click()
  }

  /** The latest revision number, read from the "History (n)" summary. */
  async latestRevision(): Promise<number> {
    const text = await this.page.getByText(/^History \(\d+\)$/).textContent()
    return Number(/\((\d+)\)/.exec(text ?? '')?.[1])
  }

  async setLabel(value: string) {
    await this.label.fill(value)
  }

  async saveWithShortcut() {
    await this.page.keyboard.press('ControlOrMeta+s')
  }

  async saveAsNewVersion(name: string) {
    await this.saveAsNew.click()
    await this.versionName.fill(name)
    await this.page.getByTestId('cv-version-create').click()
  }
}
