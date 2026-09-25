import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Fails on serious or critical axe violations (spec §10). */
export const expectNoSeriousA11yViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    // The CV preview iframe is sandboxed without scripts on purpose, so axe can't enter it (it would
    // hang waiting). The template's accessibility is covered by its own tests and the tagged-PDF checks.
    .exclude('iframe[title="CV preview"]')
    .analyze()
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
}
