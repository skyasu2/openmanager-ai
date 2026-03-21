import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfig({
  githubEventName,
  traceMode,
}: {
  githubEventName?: string;
  traceMode?: string;
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

    expect(config.outputDir).toBe('test-results');
    expect(config.use?.trace).toBe('retain-on-failure');
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
