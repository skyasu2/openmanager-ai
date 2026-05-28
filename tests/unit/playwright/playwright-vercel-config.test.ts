import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
const SKIP_IN_DOCKER_CI = process.env.CI_DOCKER === 'true';

async function loadVercelConfig({
  outputDir,
  reportDir,
}: {
  outputDir?: string;
  reportDir?: string;
} = {}) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };

  if (outputDir === undefined) {
    delete process.env.PLAYWRIGHT_VERCEL_OUTPUT_DIR;
    delete process.env.PLAYWRIGHT_OUTPUT_DIR;
  } else {
    process.env.PLAYWRIGHT_VERCEL_OUTPUT_DIR = outputDir;
  }

  if (reportDir === undefined) {
    delete process.env.PLAYWRIGHT_VERCEL_REPORT_DIR;
    delete process.env.PLAYWRIGHT_REPORT_DIR;
  } else {
    process.env.PLAYWRIGHT_VERCEL_REPORT_DIR = reportDir;
  }

  const module = await import('../../../playwright.config.vercel');
  return module.default;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe.skipIf(SKIP_IN_DOCKER_CI)(
  'playwright.config.vercel artifact paths',
  () => {
    it('keeps production Vercel artifacts under tmp by default', async () => {
      const config = await loadVercelConfig();

      expect(config.outputDir).toBe('tmp/playwright/vercel/test-results');
      expect(config.reporter).toEqual([
        [
          'html',
          {
            open: 'never',
            outputFolder: 'tmp/playwright/vercel/report',
          },
        ],
      ]);
    });

    it('honors production Vercel artifact path overrides', async () => {
      const config = await loadVercelConfig({
        outputDir: 'tmp/custom/vercel-results',
        reportDir: 'tmp/custom/vercel-report',
      });

      expect(config.outputDir).toBe('tmp/custom/vercel-results');
      expect(config.reporter).toEqual([
        [
          'html',
          {
            open: 'never',
            outputFolder: 'tmp/custom/vercel-report',
          },
        ],
      ]);
    });
  }
);
