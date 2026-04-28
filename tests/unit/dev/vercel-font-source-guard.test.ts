/**
 * @vitest-environment node
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = ['src'];

interface GitGrepError extends Error {
  status?: number;
  stdout?: string | Buffer;
}

function findGoogleFontReferences(): string[] {
  try {
    return execFileSync(
      'git',
      ['grep', '-n', '-F', 'next/font/google', '--', ...SCAN_ROOTS],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    )
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    const gitGrepError = error as GitGrepError;
    if (gitGrepError.status === 1) {
      return [];
    }
    throw error;
  }
}

describe('Vercel font source guard', () => {
  it('keeps app source independent from build-time Google font fetches', () => {
    const findings = findGoogleFontReferences();

    expect(findings).toEqual([]);
  });
});
