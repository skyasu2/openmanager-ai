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
const { statusMarkdown } = require('../../../scripts/qa/qa-status-markdown.js');

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

  it('renders wont-fix improvements by reason category in status markdown', () => {
    const markdown = statusMarkdown({
      summary: {
        totalRecordedRuns: 0,
        totalRuns: 0,
        excludedRuns: 0,
        totalChecks: 0,
        totalPassed: 0,
        totalFailed: 0,
        completedItems: 0,
        pendingItems: 0,
        deferredItems: 0,
        wontFixItems: 3,
        completionRate: 100,
      },
      runs: [],
      experts: {},
      items: {
        'obs-fp-fn-weekly-report': {
          id: 'obs-fp-fn-weekly-report',
          title: '오탐/미탐 주간 리포트 자동 생성',
          status: 'wont-fix',
          priority: 'P1',
          seenCount: 3,
          lastSeenRunId: 'QA-20260227-0013',
        },
        'ai-server-timing-header-production': {
          id: 'ai-server-timing-header-production',
          title: 'Server-Timing header visibility in production',
          status: 'wont-fix',
          priority: 'P1',
          seenCount: 2,
          lastSeenRunId: 'QA-20260310-0081',
          lastPolicyNote: '플랫폼 제약으로 인한 비차단 항목',
        },
        'mobile-header-density': {
          id: 'mobile-header-density',
          title: 'Review dashboard mobile header density',
          status: 'wont-fix',
          priority: 'P2',
          seenCount: 1,
          lastSeenRunId: 'QA-20260418-0303',
          lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
        },
      },
    });

    expect(markdown).toContain(
      'Reason categories: Policy Missing 1, Platform Constraint 1, Portfolio Deferral 1'
    );
    expect(markdown).toContain('### Policy Missing');
    expect(markdown).toContain('- [P1] obs-fp-fn-weekly-report');
    expect(markdown).toContain('### Platform Constraint');
    expect(markdown).toContain('- [P1] ai-server-timing-header-production');
    expect(markdown).toContain('### Portfolio Deferral');
    expect(markdown).toContain('- [P2] mobile-header-density');
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

  it('classifies historical gate warnings separately from active release blockers', () => {
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

    expect(snapshot.activeGateWarnings).toEqual([]);
    expect(snapshot.historicalTrendWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'gate-window-regression-open',
          classification: 'historical',
        }),
      ])
    );
  });

  it('renders active and historical warning sections in QA status markdown', () => {
    const markdown = statusMarkdown({
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

    expect(markdown).toContain('## Active Gate Warnings');
    expect(markdown).toContain('## Historical Trend Warnings');
    expect(markdown).toContain('gate-window-regression-open');
  });

  it('builds a 24h AI latency rollup by agent/provider and renders it in markdown', () => {
    const snapshot = buildQaTrendSnapshot({
      summary: {},
      items: {},
      experts: {},
      runs: [
        {
          runId: 'QA-20260417-0200',
          recordedAt: '2026-04-17T02:00:00.000Z',
          scope: 'broad',
          checks: { total: 3, passed: 3, failed: 0 },
          pendingCount: 0,
          aiLatencyObservations: [
            {
              surface: 'sidebar analyst',
              agent: 'Analyst Agent',
              provider: 'mistral',
              latencyMs: 12000,
              ttfbMs: 1800,
              processingTimeMs: 10200,
            },
          ],
        },
        {
          runId: 'QA-20260418-0300',
          recordedAt: '2026-04-18T05:00:00.000Z',
          scope: 'broad',
          checks: { total: 4, passed: 4, failed: 0 },
          pendingCount: 0,
          aiLatencyObservations: [
            {
              surface: 'sidebar analyst',
              agent: 'Analyst Agent',
              provider: 'mistral',
              latencyMs: 3000,
              ttfbMs: 900,
              processingTimeMs: 2400,
            },
            {
              surface: 'fullscreen analyst',
              agent: 'Analyst Agent',
              provider: 'mistral',
              latencyMs: 9000,
              ttfbMs: 1500,
              processingTimeMs: 8200,
            },
          ],
        },
        {
          runId: 'QA-20260419-0300',
          recordedAt: '2026-04-19T04:00:00.000Z',
          scope: 'targeted',
          checks: { total: 2, passed: 2, failed: 0 },
          pendingCount: 0,
          countsTowardSummary: false,
          aiLatencyObservations: [
            {
              surface: 'sidebar analyst',
              agent: 'Analyst Agent',
              provider: 'mistral',
              latencyMs: 6000,
              ttfbMs: 1200,
              processingTimeMs: 5200,
            },
            {
              surface: 'reporter sheet',
              agent: 'Reporter Agent',
              provider: 'groq',
              latencyMs: 900,
              ttfbMs: 200,
              processingTimeMs: 700,
            },
          ],
        },
      ],
    });

    expect(snapshot.aiLatencyRollup24h).toMatchObject({
      windowHours: 24,
      recordedRunCount: 2,
      countedRunCount: 1,
      sampleCount: 4,
    });
    expect(snapshot.aiLatencyRollup24h.windowStart).toBe(
      '2026-04-18T04:00:00.000Z'
    );
    expect(snapshot.aiLatencyRollup24h.windowEnd).toBe(
      '2026-04-19T04:00:00.000Z'
    );
    expect(snapshot.aiLatencyRollup24h.buckets).toEqual([
      {
        agent: 'Analyst Agent',
        provider: 'mistral',
        sampleCount: 3,
        runCount: 2,
        countedRunCount: 1,
        avgLatencyMs: 6000,
        p95LatencyMs: 9000,
        avgTtfbMs: 1200,
        p95TtfbMs: 1500,
        avgProcessingTimeMs: 5267,
        p95ProcessingTimeMs: 8200,
        latestRunId: 'QA-20260419-0300',
        latestRecordedAt: '2026-04-19T04:00:00.000Z',
      },
      {
        agent: 'Reporter Agent',
        provider: 'groq',
        sampleCount: 1,
        runCount: 1,
        countedRunCount: 0,
        avgLatencyMs: 900,
        p95LatencyMs: 900,
        avgTtfbMs: 200,
        p95TtfbMs: 200,
        avgProcessingTimeMs: 700,
        p95ProcessingTimeMs: 700,
        latestRunId: 'QA-20260419-0300',
        latestRecordedAt: '2026-04-19T04:00:00.000Z',
      },
    ]);

    const markdown = qaTrendsMarkdown(snapshot);
    expect(markdown).toContain('## AI Latency Rollup (Last 24h)');
    expect(markdown).toContain(
      '| Analyst Agent | mistral | 3 | 6000ms | 9000ms |'
    );
    expect(markdown).toContain('| Reporter Agent | groq | 1 | 900ms | 900ms |');
  });

  it('builds a 24h planner shadow rollup and renders it in trend dashboards', () => {
    const tracker = {
      summary: {},
      items: {},
      experts: {},
      runs: [
        {
          runId: 'QA-20260417-0200',
          recordedAt: '2026-04-17T02:00:00.000Z',
          scope: 'broad',
          checks: { total: 3, passed: 3, failed: 0 },
          pendingCount: 0,
          plannerShadowObservations: [
            {
              surface: 'old shadow sample',
              route: '/api/ai/supervisor/stream/v2',
              executionMode: 'deterministic',
              latencyMs: 99,
              classification: 'drift',
              driftReasonCodes: ['execution_path_mismatch'],
            },
          ],
        },
        {
          runId: 'QA-20260418-0300',
          recordedAt: '2026-04-18T05:00:00.000Z',
          scope: 'broad',
          checks: { total: 4, passed: 4, failed: 0 },
          pendingCount: 0,
          plannerShadowObservations: [
            {
              surface: 'CPU top-3',
              route: '/api/ai/supervisor/stream/v2',
              executionMode: 'deterministic',
              latencyMs: 5,
              classification: 'matched',
              driftReasonCodes: [],
            },
            {
              surface: 'rewrite follow-up',
              route: '/api/ai/supervisor/stream/v2',
              executionMode: 'single-agent',
              latencyMs: 1,
              classification: 'drift',
              driftReasonCodes: ['execution_mode_mismatch'],
            },
          ],
        },
        {
          runId: 'QA-20260419-0300',
          recordedAt: '2026-04-19T04:00:00.000Z',
          scope: 'targeted',
          checks: { total: 2, passed: 2, failed: 0 },
          pendingCount: 0,
          countsTowardSummary: false,
          plannerShadowObservations: [
            {
              surface: 'RAG lookup',
              route: '/api/ai/jobs',
              executionMode: 'multi-agent',
              latencyMs: 8,
              classification: 'matched',
              driftReasonCodes: [],
            },
          ],
        },
      ],
    };
    const snapshot = buildQaTrendSnapshot(tracker);

    expect(snapshot.plannerShadowRollup24h).toMatchObject({
      windowHours: 24,
      recordedRunCount: 2,
      countedRunCount: 1,
      sampleCount: 3,
      driftCount: 1,
      driftRatePct: 33.33,
      avgLatencyMs: 5,
      p95LatencyMs: 8,
      classificationCounts: {
        matched: 2,
        drift: 1,
      },
      reasonCodeCounts: {
        execution_mode_mismatch: 1,
      },
    });
    expect(snapshot.plannerShadowRollup24h.buckets).toEqual([
      {
        route: '/api/ai/jobs',
        executionMode: 'multi-agent',
        sampleCount: 1,
        runCount: 1,
        countedRunCount: 0,
        driftCount: 0,
        driftRatePct: 0,
        avgLatencyMs: 8,
        p95LatencyMs: 8,
        latestRunId: 'QA-20260419-0300',
        latestRecordedAt: '2026-04-19T04:00:00.000Z',
      },
      {
        route: '/api/ai/supervisor/stream/v2',
        executionMode: 'deterministic',
        sampleCount: 1,
        runCount: 1,
        countedRunCount: 1,
        driftCount: 0,
        driftRatePct: 0,
        avgLatencyMs: 5,
        p95LatencyMs: 5,
        latestRunId: 'QA-20260418-0300',
        latestRecordedAt: '2026-04-18T05:00:00.000Z',
      },
      {
        route: '/api/ai/supervisor/stream/v2',
        executionMode: 'single-agent',
        sampleCount: 1,
        runCount: 1,
        countedRunCount: 1,
        driftCount: 1,
        driftRatePct: 100,
        avgLatencyMs: 1,
        p95LatencyMs: 1,
        latestRunId: 'QA-20260418-0300',
        latestRecordedAt: '2026-04-18T05:00:00.000Z',
      },
    ]);

    const markdown = qaTrendsMarkdown(snapshot);
    expect(markdown).toContain('## Planner Shadow Rollup (Last 24h)');
    expect(markdown).toContain('- Drift rate: 33.33%');
    expect(markdown).toContain(
      '| /api/ai/supervisor/stream/v2 | single-agent | 1 | 100% | 1ms | 1ms | QA-20260418-0300 |'
    );
    expect(statusMarkdown(tracker)).toContain(
      '## Planner Shadow Rollup (Last 24h)'
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
