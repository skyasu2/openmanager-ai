import * as path from 'node:path';
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

type PlaywrightTraceMode =
  | 'on'
  | 'off'
  | 'on-first-retry'
  | 'on-all-retries'
  | 'retain-on-failure'
  | 'retain-on-first-failure';

function resolveManualTraceMode(): PlaywrightTraceMode {
  const override =
    (process.env.PLAYWRIGHT_MANUAL_TRACE_MODE as
      | PlaywrightTraceMode
      | undefined) ??
    (process.env.PLAYWRIGHT_TRACE_MODE as PlaywrightTraceMode | undefined);

  return override ?? 'on';
}

function resolveManualReporter() {
  if (process.env.PLAYWRIGHT_MANUAL_HTML_REPORT === '0') {
    return 'list';
  }

  return [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder:
          process.env.PLAYWRIGHT_MANUAL_REPORT_DIR ||
          'playwright-report/manual-vercel',
      },
    ],
  ] as const;
}

export default defineConfig({
  globalSetup: path.resolve(__dirname, 'tests/support/globalSetup'),
  testDir: './tests/manual',
  outputDir:
    process.env.PLAYWRIGHT_MANUAL_OUTPUT_DIR || 'test-results/manual-vercel',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: resolveManualReporter(),
  timeout: 240_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || 'https://openmanager-ai.vercel.app',
    extraHTTPHeaders,
    trace: resolveManualTraceMode(),
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
