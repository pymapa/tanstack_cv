import { defineConfig, devices } from '@playwright/test'

const PORT = 3200

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
