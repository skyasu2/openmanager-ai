/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  summarizeReferencedPrefix,
  summarizeReferencedRuns,
  formatBytes,
} = require('../../../scripts/qa/audit-qa-evidence.js');

describe('qa-evidence-audit', () => {
  it('summarizes only referenced evidence under the requested prefix', () => {
    const fileInfos = [
      {
        relativePath: 'reports/qa/evidence/legacy/2026/a.png',
        size: 1024,
      },
      {
        relativePath: 'reports/qa/evidence/legacy/2026/b.png',
        size: 2048,
      },
      {
        relativePath: 'reports/qa/evidence/qa-20260418-dashboard.png',
        size: 4096,
      },
    ];

    const referenced = new Set([
      'reports/qa/evidence/legacy/2026/a.png',
      'reports/qa/evidence/qa-20260418-dashboard.png',
    ]);

    expect(
      summarizeReferencedPrefix(
        fileInfos,
        referenced,
        'reports/qa/evidence/legacy/'
      )
    ).toEqual({
      count: 1,
      bytes: 1024,
    });
  });

  it('formats MiB values for audit output', () => {
    expect(formatBytes(56.45 * 1024 * 1024)).toBe('56.45 MiB');
  });

  it('groups referenced legacy evidence by run and sorts by total bytes', () => {
    const fileInfos = [
      {
        relativePath: 'reports/qa/evidence/legacy/2026/a.png',
        size: 1024,
      },
      {
        relativePath: 'reports/qa/evidence/legacy/2026/b.png',
        size: 4096,
      },
      {
        relativePath: 'reports/qa/evidence/legacy/2026/c.png',
        size: 2048,
      },
    ];

    const artifactRefs = [
      {
        runId: 'QA-1',
        path: 'reports/qa/evidence/legacy/2026/a.png',
      },
      {
        runId: 'QA-1',
        path: 'reports/qa/evidence/legacy/2026/b.png',
      },
      {
        runId: 'QA-2',
        path: 'reports/qa/evidence/legacy/2026/c.png',
      },
      {
        runId: 'QA-1',
        path: 'reports/qa/evidence/legacy/2026/b.png',
      },
    ];

    const runTitleById = new Map([
      ['QA-1', 'Primary release gate'],
      ['QA-2', 'Targeted follow-up'],
    ]);

    expect(
      summarizeReferencedRuns(
        fileInfos,
        artifactRefs,
        runTitleById,
        'reports/qa/evidence/legacy/'
      )
    ).toEqual([
      {
        runId: 'QA-1',
        title: 'Primary release gate',
        count: 2,
        bytes: 5120,
      },
      {
        runId: 'QA-2',
        title: 'Targeted follow-up',
        count: 1,
        bytes: 2048,
      },
    ]);
  });
});
