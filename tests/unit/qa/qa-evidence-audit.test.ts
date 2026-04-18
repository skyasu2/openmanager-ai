/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  summarizeReferencedPrefix,
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
});
