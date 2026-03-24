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
