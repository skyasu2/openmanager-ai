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
  buildValidationEvidenceSnapshot,
  cloneTrackerForRepair,
  findLatestProofRun,
  findLatestPublicEvidenceRun,
  formatEvidenceDate,
  hasGitHubActionsLink,
  shouldWriteValidationEvidenceSnapshot,
  writeValidationEvidenceSnapshot,
} = require('../../../scripts/qa/build-validation-evidence.js');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'validation-evidence-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('build-validation-evidence', () => {
  it('formats empty and concrete evidence dates predictably', () => {
    expect(formatEvidenceDate('')).toEqual({
      iso: null,
      short: 'latest',
      long: 'Latest',
    });

    expect(formatEvidenceDate('not-a-date')).toEqual({
      iso: null,
      short: 'invalid',
      long: 'Invalid date',
    });

    const formatted = formatEvidenceDate('2026-03-25T00:00:00.000Z');
    expect(formatted.iso).toBe('2026-03-25T00:00:00.000Z');
    expect(formatted.short).toBe('2026-03-25');
    expect(formatted.long).toBe('March 25, 2026');
  });

  it('detects GitHub Actions links defensively', () => {
    expect(
      hasGitHubActionsLink({
        links: [{ type: 'github-actions-run' }],
      })
    ).toBe(true);
    expect(
      hasGitHubActionsLink({
        links: [{ type: 'general' }],
      })
    ).toBe(false);
    expect(hasGitHubActionsLink({ links: null })).toBe(false);
  });

  it('finds latest public evidence run and latest proof run with separate rules', () => {
    const runs = [
      {
        runId: 'QA-20260320-0100',
        environment: { target: 'github-actions' },
        links: [{ type: 'github-actions-run' }],
      },
      {
        runId: 'QA-20260321-0101',
        environment: { target: 'vercel-production' },
        links: [],
      },
    ];

    expect(findLatestPublicEvidenceRun(runs)?.runId).toBe('QA-20260321-0101');
    expect(findLatestProofRun(runs)?.runId).toBe('QA-20260320-0100');
  });

  it('keeps latest public evidence run separate from latest github proof run', () => {
    const snapshot = buildValidationEvidenceSnapshot({
      summary: {
        totalRuns: 2,
        totalChecks: 10,
        completedItems: 3,
        expertDomainsOpenGaps: 0,
        wontFixItems: 1,
        lastRecordedAt: '2026-03-21T00:00:00.000Z',
      },
      runs: [
        {
          runId: 'QA-20260320-0100',
          title: 'GitHub Actions proof',
          scope: 'targeted',
          recordedAt: '2026-03-20T12:00:00.000Z',
          environment: {
            target: 'github-actions',
            commitSha: 'abc123',
          },
          links: [
            {
              type: 'github-actions-run',
              label: 'CI run',
              url: 'https://github.com/example/repo/actions/runs/100',
            },
            {
              type: 'github-actions-artifact',
              label: 'artifact',
              url: 'https://github.com/example/repo/actions/runs/100',
            },
          ],
        },
        {
          runId: 'QA-20260321-0101',
          title: 'Production smoke',
          scope: 'targeted',
          recordedAt: '2026-03-21T12:00:00.000Z',
          environment: {
            target: 'vercel-production',
            commitSha: 'def456',
          },
          links: [],
        },
      ],
    });

    expect(snapshot.source.latestRunId).toBe('QA-20260321-0101');
    expect(snapshot.latestProofRun.runId).toBe('QA-20260320-0100');
    expect(snapshot.latestProofRun.repoPath).toBe(
      'reports/qa/runs/2026/qa-run-QA-20260320-0100.json'
    );
    expect(snapshot.latestProofRun.ciRunLink).toEqual({
      type: 'github-actions-run',
      label: 'CI run',
      url: 'https://github.com/example/repo/actions/runs/100',
    });
  });

  it('repairs stale summary fields from runs before building the snapshot', () => {
    const snapshot = buildValidationEvidenceSnapshot({
      summary: {
        totalRuns: 99,
        totalChecks: 999,
        completedItems: 88,
        expertDomainsOpenGaps: 7,
        wontFixItems: 6,
        lastRecordedAt: '2026-03-01T00:00:00.000Z',
      },
      runs: [
        {
          runId: 'QA-20260320-0100',
          title: 'GitHub Actions proof',
          scope: 'targeted',
          recordedAt: '2026-03-20T12:00:00.000Z',
          checks: { total: 3, passed: 3, failed: 0 },
          environment: {
            target: 'github-actions',
            commitSha: 'abc123',
          },
          links: [
            {
              type: 'github-actions-run',
              label: 'CI run',
              url: 'https://github.com/example/repo/actions/runs/100',
            },
          ],
        },
        {
          runId: 'QA-20260321-0101',
          title: 'Production smoke',
          scope: 'targeted',
          recordedAt: '2026-03-21T12:00:00.000Z',
          checks: { total: 2, passed: 2, failed: 0 },
          environment: {
            target: 'vercel-production',
            commitSha: 'def456',
          },
          links: [],
        },
      ],
      items: {
        completed: { status: 'completed' },
        pending: { status: 'pending' },
        deferred: { status: 'deferred' },
        wontFix: { status: 'wont-fix' },
      },
      experts: {
        qa: { lastImprovementNeeded: false },
        sre: { lastImprovementNeeded: true },
      },
    });

    expect(snapshot.summary).toEqual({
      totalRuns: 2,
      totalChecks: 5,
      completedItems: 1,
      expertDomainsOpenGaps: 1,
      wontFixItems: 1,
      lastRecordedAt: '2026-03-21T12:00:00.000Z',
    });
    expect(snapshot.trackerUpdated).toMatchObject({
      iso: '2026-03-21T12:00:00.000Z',
      short: '2026-03-21',
    });
  });

  it('clones tracker repair input so snapshot building does not mutate caller state', () => {
    const tracker = {
      meta: {
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: 'stale-meta',
      },
      sequence: {
        nextRunNumber: 999,
      },
      summary: {
        totalRuns: 99,
        totalChecks: 999,
        completedItems: 88,
        expertDomainsOpenGaps: 7,
        wontFixItems: 6,
        lastRecordedAt: '2026-03-01T00:00:00.000Z',
      },
      runs: [
        {
          runId: 'QA-20260320-0100',
          title: 'GitHub Actions proof',
          scope: 'targeted',
          recordedAt: '2026-03-20T12:00:00.000Z',
          checks: { total: 3, passed: 3, failed: 0 },
          environment: {
            target: 'github-actions',
            commitSha: 'abc123',
          },
          links: [
            {
              type: 'github-actions-run',
              label: 'CI run',
              url: 'https://github.com/example/repo/actions/runs/100',
            },
          ],
        },
        {
          runId: 'QA-20260321-0101',
          title: 'Production smoke',
          scope: 'targeted',
          recordedAt: '2026-03-21T12:00:00.000Z',
          checks: { total: 2, passed: 2, failed: 0 },
          environment: {
            target: 'vercel-production',
            commitSha: 'def456',
          },
          links: [],
        },
      ],
      items: {
        completed: { status: 'completed' },
      },
      experts: {
        sre: { lastImprovementNeeded: true },
      },
    };

    const cloned = cloneTrackerForRepair(tracker);
    expect(cloned).not.toBe(tracker);
    expect(cloned.meta).not.toBe(tracker.meta);
    expect(cloned.sequence).not.toBe(tracker.sequence);
    expect(cloned.summary).not.toBe(tracker.summary);
    expect(cloned.runs).not.toBe(tracker.runs);

    buildValidationEvidenceSnapshot(tracker);

    expect(tracker.meta.updatedAt).toBe('stale-meta');
    expect(tracker.sequence.nextRunNumber).toBe(999);
    expect(tracker.summary.totalRuns).toBe(99);
  });

  it('writes snapshot to an explicit output path from an explicit tracker path', () => {
    const tempDir = createTempDir();
    const trackerPath = join(tempDir, 'qa-tracker.json');
    const outputPath = join(
      tempDir,
      'public',
      'data',
      'qa',
      'validation-evidence.json'
    );

    writeFileSync(
      trackerPath,
      `${JSON.stringify(
        {
          summary: {
            totalRuns: 1,
            totalChecks: 8,
            completedItems: 4,
            expertDomainsOpenGaps: 0,
            wontFixItems: 0,
            lastRecordedAt: '2026-03-25T00:00:00.000Z',
          },
          runs: [
            {
              runId: 'QA-20260325-0182',
              title: 'Production proof',
              scope: 'targeted',
              recordedAt: '2026-03-25T00:00:00.000Z',
              checks: { total: 8, passed: 8, failed: 0 },
              environment: {
                target: 'vercel-production',
                commitSha: '123456',
              },
              links: [
                {
                  type: 'github-actions-run',
                  label: 'CI run',
                  url: 'https://github.com/example/repo/actions/runs/182',
                },
              ],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const result = writeValidationEvidenceSnapshot({ trackerPath, outputPath });
    const writtenSnapshot = JSON.parse(readFileSync(outputPath, 'utf8'));

    expect(result.outputPath).toBe(outputPath);
    expect(writtenSnapshot.source.latestRunId).toBe('QA-20260325-0182');
    expect(writtenSnapshot.summary.totalChecks).toBe(8);
  });

  it('only writes public validation evidence for the canonical tracker path', () => {
    const tempDir = createTempDir();
    const canonicalTrackerPath =
      require('../../../scripts/qa/build-validation-evidence.js').TRACKER_PATH;
    const tempTrackerPath = join(tempDir, 'reports', 'qa', 'qa-tracker.json');

    expect(shouldWriteValidationEvidenceSnapshot(canonicalTrackerPath)).toBe(
      true
    );
    expect(shouldWriteValidationEvidenceSnapshot(tempTrackerPath)).toBe(false);
  });

  it('throws when tracker lacks the required proof/public evidence contract', () => {
    expect(() =>
      buildValidationEvidenceSnapshot({
        summary: {
          totalRuns: 1,
          totalChecks: 1,
          completedItems: 1,
          expertDomainsOpenGaps: 0,
          wontFixItems: 0,
          lastRecordedAt: '2026-03-25T00:00:00.000Z',
        },
        runs: [
          {
            runId: 'QA-20260325-0182',
            recordedAt: '2026-03-25T00:00:00.000Z',
            environment: {
              target: 'vercel-preview',
              commitSha: '123456',
            },
            links: [],
          },
        ],
      })
    ).toThrow('QA validation evidence summary is unavailable');
  });
});
