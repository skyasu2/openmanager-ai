import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfig({
  githubEventName,
  traceMode,
  ci,
  outputDir,
  reportDir,
  testDir,
  fullyParallel,
  workers,
  timeout,
}: {
  githubEventName?: string;
  traceMode?: string;
  ci?: string;
  outputDir?: string;
  reportDir?: string;
  testDir?: string;
  fullyParallel?: string;
  workers?: string;
  timeout?: string;
} = {}) {
  vi.resetModules();

  process.env = { ...ORIGINAL_ENV };

  if (githubEventName === undefined) {
    delete process.env.GITHUB_EVENT_NAME;
  } else {
    process.env.GITHUB_EVENT_NAME = githubEventName;
  }

  if (traceMode === undefined) {
    delete process.env.PLAYWRIGHT_TRACE_MODE;
  } else {
    process.env.PLAYWRIGHT_TRACE_MODE = traceMode;
  }

  if (outputDir === undefined) {
    delete process.env.PLAYWRIGHT_OUTPUT_DIR;
  } else {
    process.env.PLAYWRIGHT_OUTPUT_DIR = outputDir;
  }
  if (reportDir === undefined) {
    delete process.env.PLAYWRIGHT_REPORT_DIR;
  } else {
    process.env.PLAYWRIGHT_REPORT_DIR = reportDir;
  }
  if (testDir === undefined) {
    delete process.env.PLAYWRIGHT_TEST_DIR;
  } else {
    process.env.PLAYWRIGHT_TEST_DIR = testDir;
  }
  if (fullyParallel === undefined) {
    delete process.env.PLAYWRIGHT_FULLY_PARALLEL;
  } else {
    process.env.PLAYWRIGHT_FULLY_PARALLEL = fullyParallel;
  }
  if (workers === undefined) {
    delete process.env.PLAYWRIGHT_WORKERS;
  } else {
    process.env.PLAYWRIGHT_WORKERS = workers;
  }
  if (timeout === undefined) {
    delete process.env.PLAYWRIGHT_TIMEOUT;
  } else {
    process.env.PLAYWRIGHT_TIMEOUT = timeout;
  }
  delete process.env.PLAYWRIGHT_HTML_REPORT;

  if (ci === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = ci;
  }

  const module = await import('../../../playwright.config');

  return module.default;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('playwright.config trace retention', () => {
  it('uses retain-on-failure by default', async () => {
    const config = await loadConfig();

    expect(config.outputDir).toBe('tmp/playwright/e2e/test-results');
    expect(config.use?.trace).toBe('retain-on-failure');
  }, 120000);

  it('keeps tmp output directories even when CI=true', async () => {
    const config = await loadConfig({ ci: 'true' });
    expect(config.outputDir).toBe('tmp/playwright/e2e/test-results');
  });

  it('honors explicit output/report directory overrides', async () => {
    const config = await loadConfig({
      outputDir: 'tmp/custom/e2e-results',
      reportDir: 'tmp/custom/e2e-report',
    });

    expect(config.outputDir).toBe('tmp/custom/e2e-results');
    expect(config.reporter).toEqual([
      [
        'html',
        {
          open: 'never',
          outputFolder: 'tmp/custom/e2e-report',
        },
      ],
    ]);
  });

  it('supports manual-suite overrides via environment variables', async () => {
    const config = await loadConfig({
      testDir: './tests/manual',
      fullyParallel: '0',
      workers: '1',
      timeout: '240000',
    });

    expect(config.testDir).toBe('./tests/manual');
    expect(config.fullyParallel).toBe(false);
    expect(config.workers).toBe(1);
    expect(config.timeout).toBe(240000);
  });

  it('falls back to defaults when numeric overrides are invalid', async () => {
    const config = await loadConfig({
      workers: 'bad',
      timeout: '0',
    });

    expect(config.workers).toBeUndefined();
    expect(config.timeout).toBe(120000);
  });

  it('forces trace collection for workflow_dispatch runs', async () => {
    const config = await loadConfig({ githubEventName: 'workflow_dispatch' });

    expect(config.use?.trace).toBe('on');
  });

  it('honors PLAYWRIGHT_TRACE_MODE overrides', async () => {
    const config = await loadConfig({ traceMode: 'off' });

    expect(config.use?.trace).toBe('off');
  });
});
