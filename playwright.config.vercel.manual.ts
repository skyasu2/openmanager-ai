import { defineConfig, devices } from '@playwright/test';

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? {
      'x-vercel-protection-bypass': bypassSecret,
    }
  : undefined;

const chromiumLaunchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

export default defineConfig({
  globalSetup: require.resolve('./tests/support/globalSetup'),
  testDir: './tests/manual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 240_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || 'https://openmanager-ai.vercel.app',
    extraHTTPHeaders,
    trace: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
        launchOptions: {
          args: chromiumLaunchArgs,
        },
      },
    },
  ],
});
