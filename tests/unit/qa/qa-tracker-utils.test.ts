/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  recalculateSummary,
  repairTrackerDerivedFields,
} = require('../../../scripts/qa/qa-tracker-utils.js');

describe('qa-tracker-utils', () => {
  it('repairs malformed tracker defaults before recalculating summary', () => {
    const tracker = {
      runs: null,
      items: null,
      experts: null,
      meta: null,
      sequence: null,
    };

    const repaired = repairTrackerDerivedFields(tracker);

    expect(repaired.runs).toEqual([]);
    expect(repaired.items).toEqual({});
    expect(repaired.experts).toEqual({});
    expect(repaired.sequence.nextRunNumber).toBe(1);
    expect(repaired.summary).toMatchObject({
      totalRuns: 0,
      totalChecks: 0,
      completedItems: 0,
      pendingItems: 0,
      deferredItems: 0,
      wontFixItems: 0,
      expertDomainsTracked: 0,
      expertDomainsOpenGaps: 0,
      lastRunId: null,
      lastRecordedAt: null,
    });
    expect(typeof repaired.meta.createdAt).toBe('string');
    expect(typeof repaired.meta.updatedAt).toBe('string');
  });

  it('recalculates summary counts from runs, items, and expert gaps', () => {
    const tracker = {
      runs: [
        {
          runId: 'QA-20260325-0182',
          recordedAt: '2026-03-25T00:00:00.000Z',
          checks: { total: 3, passed: 2, failed: 1 },
        },
        {
          runId: 'QA-20260325-0183',
          recordedAt: '2026-03-25T01:00:00.000Z',
          checks: { total: 4, passed: 4, failed: 0 },
        },
      ],
      items: {
        a: { status: 'completed' },
        b: { status: 'pending' },
        c: { status: 'deferred' },
        d: { status: 'wont-fix' },
      },
      experts: {
        qa: { lastImprovementNeeded: false },
        sre: { lastImprovementNeeded: true },
      },
    };

    recalculateSummary(tracker);

    expect(tracker.summary).toEqual({
      totalRuns: 2,
      totalChecks: 7,
      totalPassed: 6,
      totalFailed: 1,
      completionRate: 33.33,
      completedItems: 1,
      pendingItems: 1,
      deferredItems: 1,
      wontFixItems: 1,
      expertDomainsTracked: 2,
      expertDomainsOpenGaps: 1,
      lastRunId: 'QA-20260325-0183',
      lastRecordedAt: '2026-03-25T01:00:00.000Z',
    });
  });
});
