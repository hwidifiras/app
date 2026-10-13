import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: 'artifacts/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright/report', open: 'never' }],
    ['json', { outputFile: 'artifacts/playwright/results.json' }],
  ],
  use: {
    browserName: 'chromium',
    channel: process.env.GYM_E2E_CHANNEL || undefined,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
