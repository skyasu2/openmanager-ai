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
        },
      ],
      items: {
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

    expect(snapshot.scopeDistribution).toEqual([
      { scope: 'broad', totalRuns: 1, countedRuns: 1 },
      { scope: 'release-gate', totalRuns: 1, countedRuns: 1 },
      { scope: 'smoke', totalRuns: 1, countedRuns: 0 },
      { scope: 'targeted', totalRuns: 1, countedRuns: 1 },
    ]);

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
    expect(readFileSync(markdownPath, 'utf8')).toContain('Overall Pass Rate');
    expect(readFileSync(jsonPath, 'utf8')).toContain(
      '"overallPassRatePct": 100'
    );
  });
});
