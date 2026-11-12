import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8420',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'cd .. && PITONIKA_DEV=1 ./.venv/bin/uvicorn --app-dir server app.main:app --host 127.0.0.1 --port 8420',
    url: 'http://127.0.0.1:8420/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
