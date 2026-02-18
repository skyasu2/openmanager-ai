import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 테스트 설정 (Vercel Production 전용)
 *
 * webServer 설정 제거 - 외부 Vercel URL만 테스트
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? {
      'x-vercel-protection-bypass': bypassSecret,
    }
  : undefined;
const parsedVercelWorkers = Number.parseInt(
  process.env.PLAYWRIGHT_VERCEL_WORKERS || '',
  10
);
const includeMobileProject =
  process.env.PLAYWRIGHT_VERCEL_INCLUDE_MOBILE === '1';
const defaultVercelWorkers = 2;
const vercelWorkers =
  Number.isFinite(parsedVercelWorkers) && parsedVercelWorkers > 0
    ? Math.min(parsedVercelWorkers, 4)
    : defaultVercelWorkers;
const chromiumLaunchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];
const projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // headless-shell 충돌 회피를 위해 full Chromium 채널을 기본 사용
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
      launchOptions: {
        args: chromiumLaunchArgs,
      },
    },
  },
];

// 모바일 검증은 고부하 경로로 분리(명시적 opt-in)해 Vercel 부하를 기본 최소화
if (includeMobileProject) {
  projects.push({
    name: 'mobile-chromium',
    use: {
      ...devices['Pixel 5'],
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
      launchOptions: {
        args: chromiumLaunchArgs,
      },
    },
  });
}

export default defineConfig({
  // Load environment variables globally before any tests run
  globalSetup: require.resolve('./tests/support/globalSetup'),
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* 병렬 테스트 worker 수 - CI에서도 병렬 실행 활성화 */
  workers: vercelWorkers,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || 'https://openmanager-ai.vercel.app',
    extraHTTPHeaders,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* 타임아웃 설정 최적화 */
    actionTimeout: 30000, // 30초
    navigationTimeout: 60000, // 60초
  },

  /* 전역 타임아웃 설정 */
  timeout: 120000, // 2분
  expect: {
    timeout: 10000, // assertion 타임아웃 10초
  },

  /* Configure projects for major browsers */
  projects,

  /* webServer 설정 제거 - Vercel URL 직접 테스트 */
});
