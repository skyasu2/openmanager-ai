/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const {
  analyzeTestExecutionPlan,
  executeTestExecutionPlan,
} = require('../../../scripts/hooks/pre-push-test-runner');

describe('analyzeTestExecutionPlan', () => {
  const baseArgs = {
    changedFilesResult: { isKnown: true, files: ['src/lib/util.ts'] },
    isLimitedMode: false,
    skipTests: false,
    isKnownNoOpPush: (result: { isKnown: boolean; files: string[] }) =>
      result.isKnown && result.files.length === 0,
    domTestManifest: { pathPrefixes: [], exactFiles: new Set<string>() },
    isWSL: false,
    isWindowsFS: false,
    cloudRunCwd: '/repo/cloud-run/ai-engine',
  };

  it('returns windows-limited skip plan', () => {
    expect(
      analyzeTestExecutionPlan({
        ...baseArgs,
        isLimitedMode: true,
      })
    ).toEqual({
      kind: 'skip',
      reason: 'windows-limited',
      testStatus: 'skipped',
      selectedTestMode: 'quick',
    });
  });

  it('returns SKIP_TESTS skip plan', () => {
    expect(
      analyzeTestExecutionPlan({
        ...baseArgs,
        skipTests: true,
      })
    ).toEqual({
      kind: 'skip',
      reason: 'skip-tests-env',
      testStatus: 'skipped',
      selectedTestMode: 'quick',
    });
  });

  it('returns no-op skip plan', () => {
    expect(
      analyzeTestExecutionPlan({
        ...baseArgs,
        changedFilesResult: { isKnown: true, files: [] },
      })
    ).toEqual({
      kind: 'skip',
      reason: 'known-no-op-push',
      testStatus: 'skipped-no-op-push',
      selectedTestMode: 'quick',
    });
  });

  it('returns targeted run plan when classifier matches', () => {
    const targetedRun = {
      mode: 'targeted node',
      steps: [
        {
          label: 'Targeted node suite (1 file)',
          args: ['run', 'test:node'],
        },
      ],
      guidance: ['npm run test:node -- <changed test files>'],
    };

    const result = analyzeTestExecutionPlan({
      ...baseArgs,
      classifyChangedRun: vi.fn(() => targetedRun),
    });

    expect(result).toEqual({
      kind: 'run',
      selectedTestMode: 'targeted node',
      targetedRun,
      steps: targetedRun.steps,
    });
  });

  it('falls back to quick smoke when classifier returns null', () => {
    const result = analyzeTestExecutionPlan({
      ...baseArgs,
      classifyChangedRun: vi.fn(() => null),
    });

    expect(result).toEqual({
      kind: 'run',
      selectedTestMode: 'quick',
      targetedRun: null,
      steps: [{ label: 'Quick smoke', args: ['run', 'test:super-fast'] }],
    });
  });
});

describe('executeTestExecutionPlan', () => {
  it('returns skipped result without invoking runners', () => {
    const runNpm = vi.fn();
    const runNpx = vi.fn();

    expect(
      executeTestExecutionPlan(
        {
          kind: 'skip',
          testStatus: 'skipped-no-op-push',
          selectedTestMode: 'quick',
        },
        { cwd: '/repo', runNpm, runNpx }
      )
    ).toEqual({
      ok: true,
      skipped: true,
      testStatus: 'skipped-no-op-push',
      selectedTestMode: 'quick',
    });
    expect(runNpm).not.toHaveBeenCalled();
    expect(runNpx).not.toHaveBeenCalled();
  });

  it('runs npm and npx steps with per-step cwd', () => {
    const runNpm = vi.fn(() => true);
    const runNpx = vi.fn(() => true);

    const result = executeTestExecutionPlan(
      {
        kind: 'run',
        selectedTestMode: 'targeted node',
        targetedRun: null,
        steps: [
          { label: 'Quick smoke', args: ['run', 'test:super-fast'] },
          {
            label: 'Targeted node suite',
            runner: 'npx',
            cwd: '/repo/cloud-run/ai-engine',
            args: ['vitest', 'run', 'src/server.test.ts'],
          },
        ],
      },
      { cwd: '/repo', runNpm, runNpx }
    );

    expect(runNpm).toHaveBeenCalledWith(
      ['run', 'test:super-fast'],
      null,
      '/repo'
    );
    expect(runNpx).toHaveBeenCalledWith(
      ['vitest', 'run', 'src/server.test.ts'],
      '/repo/cloud-run/ai-engine'
    );
    expect(result).toEqual({
      ok: true,
      skipped: false,
      testStatus: 'passed',
      selectedTestMode: 'targeted node',
    });
  });

  it('returns targeted guidance on failure', () => {
    const runNpm = vi.fn(() => false);
    const runNpx = vi.fn(() => true);

    const result = executeTestExecutionPlan(
      {
        kind: 'run',
        selectedTestMode: 'source-related node + DOM',
        targetedRun: {
          guidance: [
            'npm run test:related:node -- <changed source files>',
            'npm run test:related:dom -- <changed source files>',
          ],
        },
        steps: [
          {
            label: 'Related node suite',
            args: ['run', 'test:related:node'],
          },
        ],
      },
      { cwd: '/repo', runNpm, runNpx }
    );

    expect(result).toEqual({
      ok: false,
      skipped: false,
      testStatus: 'failed',
      selectedTestMode: 'source-related node + DOM',
      guidance: [
        'npm run test:related:node -- <changed source files>',
        'npm run test:related:dom -- <changed source files>',
      ],
    });
  });

  it('falls back to quick smoke guidance when targeted run metadata is absent', () => {
    const runNpm = vi.fn(() => false);
    const runNpx = vi.fn(() => true);

    const result = executeTestExecutionPlan(
      {
        kind: 'run',
        selectedTestMode: 'quick',
        targetedRun: null,
        steps: [{ label: 'Quick smoke', args: ['run', 'test:super-fast'] }],
      },
      { cwd: '/repo', runNpm, runNpx }
    );

    expect(result).toEqual({
      ok: false,
      skipped: false,
      testStatus: 'failed',
      selectedTestMode: 'quick',
      guidance: ['npm run test:super-fast'],
    });
  });
});
