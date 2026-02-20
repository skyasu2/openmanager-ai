import type { Page } from '@playwright/test';

export type BrowserMetricsSnapshot = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  domContentLoaded: number;
  pageLoad: number;
};

export async function collectWebVitalsFromPage(
  page: Page
): Promise<Record<string, number>> {
  const webVitals = await page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals: Record<string, unknown> = {};
      let metricsCollected = 0;
      const totalMetrics = 5;

      const handleMetric = (metricName: string, value: number) => {
        vitals[metricName] = value;
        metricsCollected++;
        if (metricsCollected >= totalMetrics) {
          resolve(vitals);
        }
      };

      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');

        if (navigation) {
          handleMetric(
            'TTFB',
            navigation.responseStart - navigation.fetchStart
          );

          const fcpEntry = paintEntries.find(
            (entry) => entry.name === 'first-contentful-paint'
          );
          if (fcpEntry) {
            handleMetric('FCP', fcpEntry.startTime);
          }

          handleMetric('LCP', navigation.loadEventEnd - navigation.fetchStart);
          handleMetric('FID', 0);
          handleMetric('CLS', 0);
        } else {
          resolve({});
        }
      }, 1000);
    });
  });

  return webVitals as Record<string, number>;
}

export async function collectBrowserMetricsFromPage(
  page: Page
): Promise<BrowserMetricsSnapshot> {
  const metrics = await page.evaluate(() => {
    const memory = (
      performance as {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      }
    ).memory;
    const timing = performance.timing;

    return {
      usedJSHeapSize: memory ? memory.usedJSHeapSize / 1024 / 1024 : 0,
      totalJSHeapSize: memory ? memory.totalJSHeapSize / 1024 / 1024 : 0,
      domContentLoaded: timing
        ? timing.domContentLoadedEventEnd - timing.navigationStart
        : 0,
      pageLoad: timing ? timing.loadEventEnd - timing.navigationStart : 0,
    };
  });

  return metrics as BrowserMetricsSnapshot;
}
