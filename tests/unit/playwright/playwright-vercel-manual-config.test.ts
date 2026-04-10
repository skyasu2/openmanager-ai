import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
const SKIP_IN_DOCKER_CI = process.env.CI_DOCKER === 'true';

async function loadManualConfig({
  traceMode,
  htmlReport,
  outputDir,
  reportDir,
}: {
  traceMode?: string;
  htmlReport?: string;
  outputDir?: string;
  reportDir?: string;
} = {}) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };

  if (traceMode === undefined) {
    delete process.env.PLAYWRIGHT_MANUAL_TRACE_MODE;
  } else {
    process.env.PLAYWRIGHT_MANUAL_TRACE_MODE = traceMode;
  }

  if (htmlReport === undefined) {
    delete process.env.PLAYWRIGHT_MANUAL_HTML_REPORT;
  } else {
    process.env.PLAYWRIGHT_MANUAL_HTML_REPORT = htmlReport;
  }

  if (outputDir === undefined) {
    delete process.env.PLAYWRIGHT_MANUAL_OUTPUT_DIR;
  } else {
    process.env.PLAYWRIGHT_MANUAL_OUTPUT_DIR = outputDir;
  }

  if (reportDir === undefined) {
    delete process.env.PLAYWRIGHT_MANUAL_REPORT_DIR;
  } else {
    process.env.PLAYWRIGHT_MANUAL_REPORT_DIR = reportDir;
  }

  const module = await import('../../../playwright.config.vercel.manual');
  return module.default;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe.skipIf(SKIP_IN_DOCKER_CI)(
  'playwright.config.vercel.manual trace/report retention',
  () => {
    it('enables trace and html report by default', async () => {
      const config = await loadManualConfig();

      expect(config.outputDir).toBe(
        'tmp/playwright/manual-vercel/test-results'
      );
      expect(config.use?.trace).toBe('on');
      expect(config.reporter).toEqual([
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: 'tmp/playwright/manual-vercel/report',
          },
        ],
      ]);
    });

    it('honors manual trace override', async () => {
      const config = await loadManualConfig({ traceMode: 'off' });

      expect(config.use?.trace).toBe('off');
    });

    it('allows disabling html report and overriding output dirs', async () => {
      const config = await loadManualConfig({
        htmlReport: '0',
        outputDir: 'test-results/custom-manual',
        reportDir: 'playwright-report/custom-manual',
      });

      expect(config.outputDir).toBe('test-results/custom-manual');
      expect(config.reporter).toBe('list');
    });
  }
);
