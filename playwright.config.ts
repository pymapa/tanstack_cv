import { defineConfig, devices } from '@playwright/test'

const PORT = 3200
const ADDS_CVS = /(translate|create-cv)\.spec\.ts$/
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }

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
    { name: 'chromium', use: desktop, testIgnore: ADDS_CVS },
    // Specs that add CVs or people to the shared store run last, so counts in the other specs stay exact.
    { name: 'adds-cvs', use: desktop, testMatch: ADDS_CVS, dependencies: ['chromium'] },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    // Never a real model in E2E: the fake translator is deterministic and offline.
    env: { AI_PROVIDER: 'fake' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
