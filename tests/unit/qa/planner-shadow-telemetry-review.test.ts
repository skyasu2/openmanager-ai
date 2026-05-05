/**
 * @vitest-environment node
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildPlannerShadowTelemetryReview,
  classifyPlannerShadowText,
  formatReview,
} = require('../../../scripts/qa/planner-shadow-telemetry-review.js');

const tempDirs: string[] = [];

function createTempRunsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'planner-shadow-qa-'));
  const yearDir = join(dir, '2026');
  mkdirSync(yearDir, { recursive: true });
  tempDirs.push(dir);
  return yearDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('planner-shadow-telemetry-review', () => {
  it('classifies planner shadow drift reasons from QA note text', () => {
    expect(
      classifyPlannerShadowText(
        'plannerShadow candidate deterministic metric_lookup matched local stream path with latencyMs=5.'
      )
    ).toBe('matched');

    expect(
      classifyPlannerShadowText(
        'plannerShadow drift execution_mode_mismatch with latencyMs=1.'
      )
    ).toBe('drift');
  });

  it('builds note-derived telemetry and flags the structured export gap', () => {
    const runsDir = createTempRunsDir();
    writeFileSync(
      join(runsDir, 'qa-run-QA-20260504-0405.json'),
      JSON.stringify(
        {
          runId: 'QA-20260504-0405',
          recordedAt: '2026-05-04T09:01:43.674Z',
          notes: [
            'mode audit: CPU top-3 routeDecision executionPath=stream, mode=single, decidedBy=cloud-run; plannerShadow candidate deterministic metric_lookup matched local stream path with latencyMs=5.',
            'formatting rewrite route audit: default prompt hit clarification UI; skip path used /api/ai/supervisor/stream/v2, did not call /api/ai/jobs, and exposed plannerShadow drift execution_mode_mismatch with latencyMs=1.',
          ],
        },
        null,
        2
      )
    );

    const review = buildPlannerShadowTelemetryReview({
      runsDir: join(runsDir, '..'),
    });

    expect(review).toMatchObject({
      runsScanned: 1,
      runsWithPlannerShadowEvidence: 1,
      structuredObservationRuns: 0,
      sampleCount: 2,
      latency: {
        avgMs: 3,
        p95Ms: 5,
        zeroSamples: 0,
        maxMs: 5,
      },
      classificationCounts: {
        matched: 1,
        drift: 1,
      },
      driftRatePct: 50,
      reasonCodeCounts: {
        execution_mode_mismatch: 1,
      },
      evidenceExport: 'note-derived',
      reviewDecision: 'telemetry-adapter-gap',
    });

    expect(formatReview(review)).toContain(
      'review decision: telemetry-adapter-gap'
    );
  });

  it('prefers structured observation runs when the QA schema provides them', () => {
    const runsDir = createTempRunsDir();
    writeFileSync(
      join(runsDir, 'qa-run-QA-20260506-0001.json'),
      JSON.stringify(
        {
          runId: 'QA-20260506-0001',
          recordedAt: '2026-05-06T00:00:00.000Z',
          plannerShadowObservations: [
            {
              route: '/api/ai/supervisor/stream/v2',
              latencyMs: 4,
              driftReasonCodes: [],
              classification: 'matched',
            },
          ],
          notes: ['plannerShadow.latencyMs=4'],
        },
        null,
        2
      )
    );

    const review = buildPlannerShadowTelemetryReview({
      runsDir: join(runsDir, '..'),
    });

    expect(review.structuredObservationRuns).toBe(1);
    expect(review.sampleCount).toBe(1);
    expect(review.classificationCounts).toEqual({ matched: 1 });
    expect(review.latency.p95Ms).toBe(4);
    expect(review.reviewDecision).toBe('production-telemetry-structured');
  });
});
