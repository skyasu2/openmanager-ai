import * as path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

/**
 * Playwright E2E 테스트 설정
 *
 * Environment variables are loaded via globalSetup.ts
 * This ensures variables are available before worker processes spawn
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? {
      'x-vercel-protection-bypass': bypassSecret,
    }
  : undefined;

export default defineConfig({
  // Load environment variables globally before any tests run
  globalSetup: require.resolve('./tests/support/globalSetup'),
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    /* Phase 17.1: 'retain-on-failure'로 변경 - 실패 시 항상 trace 생성 (로컬 환경에서도) */
    trace: 'retain-on-failure',

    /* 타임아웃 설정 최적화 (2025-09-28) */
    actionTimeout: 30000, // 30초 (기존 15초에서 증가)
    navigationTimeout: 60000, // 60초 (네트워크 지연 고려)
  },

  /* 전역 타임아웃 설정 */
  timeout: 120000, // 2분 (전체 테스트 타임아웃)
  expect: {
    timeout: 10000, // assertion 타임아웃 10초
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // headless-shell 충돌 회피를 위해 full Chromium 채널을 기본 사용
        channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
        // Playwright 자체 최신 Chromium 사용 (자동 선택)
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },

    /* Firefox, WebKit 제거 (2025-10-12 WSL 환경 최적화)
     * 이유:
     * - Chromium/Chrome 프로덕션 점유율 90%+
     * - Firefox/WebKit ROI 낮음 (3% 이하)
     * - 테스트 속도 3배 향상
     * - 디스크 공간 1.6GB 절약
     * - WSL 환경에서 Chromium 헤드리스 최적화
     * - MCP 통합 (Playwright + Serena 모두 Chromium 사용)
     */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run local dev server before starting the tests */
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined // 이미 실행 중인 서버 사용 시 webServer 비활성화
    : process.env.PLAYWRIGHT_USE_PRODUCTION
      ? {
          // 프로덕션 빌드 모드 - Next.js DevTools 문제 완전 회피
          // 사용: PLAYWRIGHT_USE_PRODUCTION=1 npx playwright test
          command: 'npm run start',
          url: 'http://localhost:3000',
          reuseExistingServer: true, // 프로덕션 모드에서는 항상 기존 서버 재사용
          timeout: 30 * 1000, // 프로덕션은 빠름
        }
      : {
          // 개발 모드 - DevTools 비활성화 (WSL + Playwright 호환성)
          command: 'npm run dev:playwright',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          // Next.js devIndicators 완전 비활성화를 위한 환경변수
          env: {
            NEXT_PUBLIC_E2E_TESTING: 'true',
            NEXT_DISABLE_DEVTOOLS: '1',
          },
        },
});
