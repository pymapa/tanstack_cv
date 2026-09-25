import { defineConfig, devices } from '@playwright/test'

const PORT = 3200
const ADDS_PEOPLE = '**/cv/create-cv.spec.ts'
const chromium = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: false, // one shared in-memory store per server; keep specs independent but serial
  retries: process.env['CI'] === undefined ? 0 : 2,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: chromium, testIgnore: ADDS_PEOPLE },
    // Adding a person changes the counts that search specs check, and the store is shared by
    // every spec, so specs that add people run last.
    { name: 'chromium-adds-people', use: chromium, testMatch: ADDS_PEOPLE, dependencies: ['chromium'] },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
