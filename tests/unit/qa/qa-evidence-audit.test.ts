/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  summarizeReferencedPrefix,
  summarizeReferencedRuns,
  summarizeSharedReferencedRuns,
  summarizeUniqueReferencedRuns,
  summarizeRunArtifactSizes,
  filterRefsForRuns,
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

  it('filters issue refs to the selected run window', () => {
    const refs = [
      'QA-OLD -> reports/qa/evidence/legacy/old.png',
      'QA-RECENT -> reports/qa/evidence/recent.png',
      'malformed ref',
    ];

    expect(filterRefsForRuns(refs, [{ runId: 'QA-RECENT' }])).toEqual([
      'QA-RECENT -> reports/qa/evidence/recent.png',
    ]);
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

  it('groups shared legacy evidence by run and reports peer counts', () => {
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
        path: 'reports/qa/evidence/legacy/2026/b.png',
      },
      {
        runId: 'QA-2',
        path: 'reports/qa/evidence/legacy/2026/c.png',
      },
      {
        runId: 'QA-3',
        path: 'reports/qa/evidence/legacy/2026/b.png',
      },
    ];

    const runTitleById = new Map([
      ['QA-1', 'Primary release gate'],
      ['QA-2', 'Targeted follow-up'],
      ['QA-3', 'Post-merge parity'],
    ]);

    expect(
      summarizeSharedReferencedRuns(
        fileInfos,
        artifactRefs,
        runTitleById,
        'reports/qa/evidence/legacy/'
      )
    ).toEqual([
      {
        runId: 'QA-1',
        title: 'Primary release gate',
        count: 1,
        bytes: 4096,
        peerCount: 2,
      },
      {
        runId: 'QA-2',
        title: 'Targeted follow-up',
        count: 1,
        bytes: 4096,
        peerCount: 2,
      },
      {
        runId: 'QA-3',
        title: 'Post-merge parity',
        count: 1,
        bytes: 4096,
        peerCount: 2,
      },
    ]);
  });

  it('groups unique legacy evidence by run and excludes shared paths', () => {
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
        path: 'reports/qa/evidence/legacy/2026/b.png',
      },
      {
        runId: 'QA-2',
        path: 'reports/qa/evidence/legacy/2026/c.png',
      },
    ];

    const runTitleById = new Map([
      ['QA-1', 'Primary release gate'],
      ['QA-2', 'Targeted follow-up'],
    ]);

    expect(
      summarizeUniqueReferencedRuns(
        fileInfos,
        artifactRefs,
        runTitleById,
        'reports/qa/evidence/legacy/'
      )
    ).toEqual([
      {
        runId: 'QA-2',
        title: 'Targeted follow-up',
        count: 1,
        bytes: 2048,
      },
      {
        runId: 'QA-1',
        title: 'Primary release gate',
        count: 1,
        bytes: 1024,
      },
    ]);
  });

  it('summarizes run-level artifact sizes and flags soft budget overages', () => {
    const mib = 1024 * 1024;
    const fileInfos = [
      {
        relativePath: 'reports/qa/evidence/qa-20260424-dashboard.png',
        size: 3 * mib,
      },
      {
        relativePath: 'reports/qa/evidence/qa-20260424-modal.png',
        size: 2 * mib,
      },
      {
        relativePath: 'reports/qa/evidence/qa-20260424-console.log',
        size: 512,
      },
    ];
    const artifactRefs = [
      {
        runId: 'QA-20260424-0346',
        path: 'reports/qa/evidence/qa-20260424-dashboard.png',
      },
      {
        runId: 'QA-20260424-0346',
        path: 'reports/qa/evidence/qa-20260424-modal.png',
      },
      {
        runId: 'QA-20260424-0347',
        path: 'reports/qa/evidence/qa-20260424-console.log',
      },
    ];
    const runTitleById = new Map([
      ['QA-20260424-0346', 'Broad UIUX sweep'],
      ['QA-20260424-0347', 'Core route follow-up'],
    ]);

    expect(
      summarizeRunArtifactSizes(fileInfos, artifactRefs, runTitleById, {
        runWarnBytes: 4 * mib,
        fileWarnBytes: 1.5 * mib,
      })
    ).toEqual([
      {
        runId: 'QA-20260424-0346',
        title: 'Broad UIUX sweep',
        count: 2,
        bytes: 5 * mib,
        largestFileBytes: 3 * mib,
        exceedsRunBudget: true,
        oversizedFileCount: 2,
      },
      {
        runId: 'QA-20260424-0347',
        title: 'Core route follow-up',
        count: 1,
        bytes: 512,
        largestFileBytes: 512,
        exceedsRunBudget: false,
        oversizedFileCount: 0,
      },
    ]);
  });
});
