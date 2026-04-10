import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfig({
  githubEventName,
  traceMode,
  ci,
  outputDir,
  reportDir,
}: {
  githubEventName?: string;
  traceMode?: string;
  ci?: string;
  outputDir?: string;
  reportDir?: string;
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

  it('forces trace collection for workflow_dispatch runs', async () => {
    const config = await loadConfig({ githubEventName: 'workflow_dispatch' });

    expect(config.use?.trace).toBe('on');
  });

  it('honors PLAYWRIGHT_TRACE_MODE overrides', async () => {
    const config = await loadConfig({ traceMode: 'off' });

    expect(config.use?.trace).toBe('off');
  });
});
