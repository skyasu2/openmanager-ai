/**
 * @vitest-environment node
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildQaTrendSnapshot,
  qaTrendsMarkdown,
  writeQaTrendArtifacts,
} = require('../../../scripts/qa/qa-trends.js');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'qa-trends-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('qa-trends', () => {
  it('builds window summaries, scope stats, and regression trends from counted runs only', () => {
    const snapshot = buildQaTrendSnapshot({
      summary: {
        totalRuns: 999,
        totalChecks: 999,
        totalPassed: 999,
        totalFailed: 999,
      },
      runs: [
        {
          runId: 'QA-20260401-0200',
          recordedAt: '2026-04-01T01:00:00.000Z',
          scope: 'broad',
          checks: { total: 5, passed: 5, failed: 0 },
          pendingCount: 0,
        },
        {
          runId: 'QA-20260401-0201',
          recordedAt: '2026-04-01T04:00:00.000Z',
          scope: 'targeted',
          checks: { total: 4, passed: 3, failed: 1 },
          pendingCount: 1,
        },
        {
          runId: 'QA-20260402-0202',
          recordedAt: '2026-04-02T02:00:00.000Z',
          scope: 'smoke',
          checks: { total: 2, passed: 2, failed: 0 },
          pendingCount: 0,
          countsTowardSummary: false,
        },
        {
          runId: 'QA-20260403-0203',
          recordedAt: '2026-04-03T03:00:00.000Z',
          scope: 'release-gate',
          checks: { total: 6, passed: 6, failed: 0 },
          pendingCount: 0,
          releaseFacing: true,
          environment: {
            deploymentId: 'dpl_gate_1',
            target: 'vercel-production',
            commitSha: '1234567890abcdef1234567890abcdef12345678',
          },
        },
      ],
      items: {
        'critical-completed': {
          title: 'Critical fix shipped',
          status: 'completed',
          priority: 'P0',
          seenCount: 2,
          lastSeenRunId: 'QA-20260403-0203',
        },
        'recurring-open': {
          title: 'Recurring open gap',
          status: 'pending',
          priority: 'P1',
          seenCount: 4,
          lastSeenRunId: 'QA-20260401-0201',
        },
        'recurring-completed': {
          title: 'Recurring completed fix',
          status: 'completed',
          priority: 'P1',
          seenCount: 5,
          completedCount: 3,
          lastSeenRunId: 'QA-20260403-0203',
        },
      },
    });

    expect(snapshot.totals.recordedRuns).toBe(4);
    expect(snapshot.totals.countedRuns).toBe(3);
    expect(snapshot.totals.totalChecks).toBe(15);
    expect(snapshot.totals.totalPassed).toBe(14);
    expect(snapshot.totals.totalFailed).toBe(1);
    expect(snapshot.totals.overallPassRatePct).toBeCloseTo(93.33, 2);

    expect(snapshot.windows[0]).toMatchObject({
      label: 'All Counted Runs',
      countedRuns: 3,
      failingRunCount: 1,
      regressionRunCount: 1,
    });
    expect(snapshot.gateWindows[0]).toMatchObject({
      label: 'All Gate Runs',
      countedRuns: 2,
      totalChecks: 11,
      regressionRunCount: 0,
    });
    expect(snapshot.releaseGateWindows[0]).toMatchObject({
      label: 'All Release-Gate Runs',
      countedRuns: 1,
      totalChecks: 6,
      releaseFacingRuns: 1,
    });

    expect(snapshot.scopeDistribution).toEqual([
      { scope: 'broad', totalRuns: 1, countedRuns: 1 },
      { scope: 'release-gate', totalRuns: 1, countedRuns: 1 },
      { scope: 'smoke', totalRuns: 1, countedRuns: 0 },
      { scope: 'targeted', totalRuns: 1, countedRuns: 1 },
    ]);
    expect(snapshot.priorityRecurrence).toEqual([
      {
        priority: 'P0',
        totalItems: 1,
        recurringItems: 1,
        openItems: 0,
        openRecurringItems: 0,
        completedItems: 1,
        wontFixItems: 0,
        recurrenceRatePct: 100,
        openRecurrenceRatePct: 0,
      },
      {
        priority: 'P1',
        totalItems: 2,
        recurringItems: 2,
        openItems: 1,
        openRecurringItems: 1,
        completedItems: 1,
        wontFixItems: 0,
        recurrenceRatePct: 100,
        openRecurrenceRatePct: 100,
      },
    ]);
    expect(snapshot.deploymentCorrelation[0]).toMatchObject({
      deploymentId: 'dpl_gate_1',
      target: 'vercel-production',
      runCount: 1,
      totalChecks: 6,
      passRatePct: 100,
      regressionRunRatePct: 0,
      latestRunId: 'QA-20260403-0203',
    });
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'release-gate-sample-too-small',
          severity: 'warning',
        }),
      ])
    );

    expect(snapshot.recentDailyTrend).toHaveLength(2);
    expect(snapshot.recentDailyTrend[0]).toMatchObject({
      date: '2026-04-01',
      runCount: 2,
      regressionRuns: 1,
    });
    expect(snapshot.recentRegressionRuns[0]).toMatchObject({
      runId: 'QA-20260401-0201',
      failedChecks: 1,
      pendingCount: 1,
    });
    expect(snapshot.recurringItems.open[0]).toMatchObject({
      id: 'recurring-open',
      seenCount: 4,
    });
    expect(snapshot.recurringItems.completed[0]).toMatchObject({
      id: 'recurring-completed',
      completedCount: 3,
    });

    const markdown = qaTrendsMarkdown(snapshot);
    expect(markdown).toContain('## Gate Run Windows');
    expect(markdown).toContain('## Release-Gate Only Windows');
    expect(markdown).toContain('## Priority Recurrence');
    expect(markdown).toContain('## Deployment Regression Correlation');
    expect(markdown).toContain('## Warnings');
    expect(markdown).toContain('release-gate-sample-too-small');
  });

  it('flags missing release-gate coverage and open gate regressions', () => {
    const snapshot = buildQaTrendSnapshot({
      summary: {},
      items: {},
      experts: {},
      runs: [
        {
          runId: 'QA-20260405-0300',
          recordedAt: '2026-04-05T02:00:00.000Z',
          scope: 'broad',
          checks: { total: 4, passed: 3, failed: 1 },
          pendingCount: 1,
          releaseFacing: true,
        },
      ],
    });

    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'release-gate-missing',
          severity: 'critical',
        }),
        expect.objectContaining({
          code: 'gate-window-regression-open',
          severity: 'warning',
        }),
      ])
    );
  });

  it('explains when gate regression warning is driven by an older broad run while release-gate stays clean', () => {
    const snapshot = buildQaTrendSnapshot({
      summary: {},
      items: {},
      experts: {},
      runs: [
        {
          runId: 'QA-20260404-0222',
          recordedAt: '2026-04-04T09:17:33.588Z',
          scope: 'broad',
          checks: { total: 13, passed: 12, failed: 1 },
          pendingCount: 1,
          releaseFacing: false,
        },
        {
          runId: 'QA-20260404-0229',
          recordedAt: '2026-04-04T14:29:25.205Z',
          scope: 'release-gate',
          checks: { total: 17, passed: 17, failed: 0 },
          pendingCount: 0,
          releaseFacing: true,
        },
        {
          runId: 'QA-20260405-0235',
          recordedAt: '2026-04-05T05:28:30.284Z',
          scope: 'release-gate',
          checks: { total: 17, passed: 17, failed: 0 },
          pendingCount: 0,
          releaseFacing: true,
        },
        {
          runId: 'QA-20260405-0236',
          recordedAt: '2026-04-05T05:47:50.876Z',
          scope: 'release-gate',
          checks: { total: 12, passed: 12, failed: 0 },
          pendingCount: 0,
          releaseFacing: true,
        },
      ],
    });

    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'gate-window-regression-open',
          detail: expect.stringContaining(
            'current release-gate-only window is clean'
          ),
          recommendedAction: expect.stringContaining('historical gate context'),
        }),
      ])
    );
  });

  it('writes markdown and json artifacts for the current tracker snapshot', () => {
    const tempDir = createTempDir();
    const trackerPath = join(tempDir, 'qa-tracker.json');
    const markdownPath = join(tempDir, 'QA_TRENDS.md');
    const jsonPath = join(tempDir, 'latest-qa-trends.json');

    writeFileSync(
      trackerPath,
      `${JSON.stringify(
        {
          version: '1.0.0',
          meta: {
            createdAt: '2026-04-05T00:00:00.000Z',
            updatedAt: '2026-04-05T00:00:00.000Z',
          },
          sequence: {
            nextRunNumber: 2,
          },
          summary: {},
          items: {},
          experts: {},
          runs: [
            {
              runId: 'QA-20260405-0234',
              title: 'Trend artifact smoke',
              recordedAt: '2026-04-05T00:00:00.000Z',
              scope: 'broad',
              checks: { total: 3, passed: 3, failed: 0 },
              pendingCount: 0,
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const { snapshot } = writeQaTrendArtifacts({
      trackerPath,
      markdownPath,
      jsonPath,
    });

    expect(snapshot.totals.countedRuns).toBe(1);
    expect(readFileSync(markdownPath, 'utf8')).toContain('## Rolling Windows');
    expect(readFileSync(markdownPath, 'utf8')).toContain('## Gate Run Windows');
    expect(readFileSync(markdownPath, 'utf8')).toContain('Overall Pass Rate');
    expect(readFileSync(jsonPath, 'utf8')).toContain(
      '"overallPassRatePct": 100'
    );
    expect(readFileSync(jsonPath, 'utf8')).toContain('"gateWindows"');
  });
});
