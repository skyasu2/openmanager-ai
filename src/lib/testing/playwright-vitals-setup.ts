import type { Page } from '@playwright/test';
import { test } from '@playwright/test';
import { logger } from '@/lib/logging';
import { universalVitals } from './universal-vitals';

type PlaywrightVitalsController = {
  reset: () => void;
  startSuite: (suiteName: string, browserName?: string) => void;
  startTest: (testName: string, page?: Page) => void;
  collectBrowserMetrics: (
    page: Page,
    label?: string
  ) => Promise<unknown | null>;
  passTest: (testName?: string) => unknown;
  failTest: (testName?: string, error?: Error) => unknown;
  endSuite: (suiteName: string) => unknown;
  generateReport: () => {
    timestamp: number;
    sessionId: string;
    browserName: string;
    testExecution: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      successRate: number;
    };
    summary: {
      goodVitals: number;
      poorVitals: number;
    };
    recommendations: Array<{ metric: string; recommendations?: string[] }>;
  };
};

type SetupPlaywrightVitalsOptions = {
  suiteName?: string;
  browserName?: string;
  collectWebVitals?: boolean;
  collectBrowserMetrics?: boolean;
  reportEndpoint?: string;
};

export function setupPlaywrightVitalsWithController(
  playwrightVitals: PlaywrightVitalsController,
  options: SetupPlaywrightVitalsOptions = {}
) {
  const {
    suiteName = 'playwright-suite',
    browserName = 'chromium',
    collectWebVitals: _collectWebVitals = true,
    collectBrowserMetrics = true,
    reportEndpoint,
  } = options;

  test.beforeAll(async () => {
    playwrightVitals.reset();
    playwrightVitals.startSuite(suiteName, browserName);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    const testName = testInfo.title || 'unknown-test';
    playwrightVitals.startTest(testName, page);

    if (collectBrowserMetrics) {
      await playwrightVitals.collectBrowserMetrics(
        page,
        `test-start-${testName}`
      );
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    const testName = testInfo.title || 'unknown-test';

    if (collectBrowserMetrics) {
      await playwrightVitals.collectBrowserMetrics(
        page,
        `test-end-${testName}`
      );
    }

    if (testInfo.status === 'passed') {
      playwrightVitals.passTest(testName);
    } else if (testInfo.status === 'failed') {
      const testError = testInfo.errors?.[0];
      const errorToPass = testError
        ? new Error(testError.message || 'Test failed')
        : undefined;
      playwrightVitals.failTest(testName, errorToPass);
    }
  });

  test.afterAll(async () => {
    playwrightVitals.endSuite(suiteName);
    const report = playwrightVitals.generateReport();

    logger.info('\n📊 [Playwright Vitals] 최종 E2E 리포트:');
    logger.info(
      `✅ 성공: ${report.testExecution.passedTests}/${report.testExecution.totalTests}`
    );
    logger.info(`📈 성공률: ${report.testExecution.successRate.toFixed(1)}%`);
    logger.info(`🎭 브라우저: ${report.browserName}`);
    logger.info(
      `🎯 Vitals 품질: ${report.summary.goodVitals}개 Good, ${report.summary.poorVitals}개 Poor`
    );

    if (report.recommendations.length > 0) {
      logger.info('\n💡 [E2E 성능 개선 권장사항]:');
      report.recommendations.forEach((rec) => {
        logger.info(`- ${rec.metric}: ${rec.recommendations?.join(', ')}`);
      });
    }

    if (reportEndpoint) {
      try {
        const response = await fetch(reportEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'playwright',
            sessionId: report.sessionId,
            timestamp: report.timestamp,
            metrics: universalVitals.getAllMetrics(),
            metadata: {
              browserName: report.browserName,
              testSuite: suiteName,
              environment: process.env.NODE_ENV,
            },
          }),
        });

        if (response.ok) {
          logger.info(
            `📤 [Playwright Vitals] E2E 리포트 전송 완료: ${reportEndpoint}`
          );
        }
      } catch (error) {
        logger.warn(`⚠️ [Playwright Vitals] E2E 리포트 전송 실패:`, error);
      }
    }
  });
}

export const playwrightExample = {
  setup: `
// tests/setup/playwright-vitals.setup.ts
import { setupPlaywrightVitals } from '@/lib/testing/playwright-vitals-plugin';

setupPlaywrightVitals({
  suiteName: 'my-e2e-suite',
  browserName: 'chromium',
  collectWebVitals: true,
  collectBrowserMetrics: true,
  reportEndpoint: '/api/universal-vitals'
});
  `,
  usage: `
import { test, expect } from '@playwright/test';
import { PlaywrightVitals } from '@/lib/testing/playwright-vitals-plugin';

test('페이지 성능 측정', async ({ page }) => {
  PlaywrightVitals.startNavigation(page, '/dashboard');
  await page.goto('/dashboard');
  await PlaywrightVitals.endNavigation(page, '/dashboard');

  const apiVital = await PlaywrightVitals.measureAPICall(page, '/api/servers');
  expect(apiVital.value).toBeLessThan(1000);

  const metrics = await PlaywrightVitals.collectBrowserMetrics(page, 'dashboard-test');
  expect(metrics?.usedJSHeapSize).toBeLessThan(50);
});
  `,
};
