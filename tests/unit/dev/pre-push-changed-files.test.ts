/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const {
  collectChangedFilesFromUpdates,
  determineChangedFilesForPush,
  isKnownNoOpPush,
} = require('../../../scripts/hooks/pre-push-changed-files');

// ─── helpers ──────────────────────────────────────────────────────────────

const ZERO_OID = '0000000000000000000000000000000000000000';
const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SHA_BASE = 'cccccccccccccccccccccccccccccccccccccccc';

function isZeroOid(oid: string) {
  return /^0+$/.test(oid);
}

function parseChangedFiles(output: string) {
  if (!output) return [];
  return output
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean);
}

// ─── collectChangedFilesFromUpdates ───────────────────────────────────────

describe('collectChangedFilesFromUpdates', () => {
  it('returns diff between remoteOid and localOid when remote is non-zero', () => {
    const runGit = vi.fn().mockReturnValue('src/app/page.tsx\nsrc/lib/util.ts');
    const files = collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/main', localOid: SHA_A, remoteOid: SHA_B },
      ],
      resolveCommitRef: (ref: string) => ref,
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });

    expect(runGit).toHaveBeenCalledWith([
      'diff',
      '--name-only',
      `${SHA_B}..${SHA_A}`,
    ]);
    expect(files).toEqual(['src/app/page.tsx', 'src/lib/util.ts']);
  });

  it('falls back to merge-base when remoteOid is zero', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'merge-base') return SHA_BASE;
      return 'src/components/Button.tsx';
    });
    const files = collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/feat', localOid: SHA_A, remoteOid: ZERO_OID },
      ],
      resolveCommitRef: (ref: string) => ref,
      resolveDefaultBaseRef: () => 'origin/main',
      runGit,
      parseChangedFiles,
      isZeroOid,
    });

    expect(runGit).toHaveBeenCalledWith(['merge-base', SHA_A, 'origin/main']);
    expect(runGit).toHaveBeenCalledWith([
      'diff',
      '--name-only',
      `${SHA_BASE}..${SHA_A}`,
    ]);
    expect(files).toEqual(['src/components/Button.tsx']);
  });

  it('uses diff-tree for initial push when no base commit available', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'diff-tree') return 'src/app/layout.tsx';
      return '';
    });
    const files = collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/feat', localOid: SHA_A, remoteOid: ZERO_OID },
      ],
      resolveCommitRef: (ref: string) => ref,
      resolveDefaultBaseRef: () => '',
      runGit,
      parseChangedFiles,
      isZeroOid,
    });

    expect(runGit).toHaveBeenCalledWith([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      SHA_A,
    ]);
    expect(files).toEqual(['src/app/layout.tsx']);
  });

  it('skips deleted refs (localRef === "(delete)")', () => {
    const runGit = vi.fn();
    collectChangedFilesFromUpdates({
      updates: [{ localRef: '(delete)', localOid: SHA_A, remoteOid: SHA_B }],
      resolveCommitRef: vi.fn(),
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it('skips updates with zero localOid', () => {
    const runGit = vi.fn();
    collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/main', localOid: ZERO_OID, remoteOid: SHA_B },
      ],
      resolveCommitRef: vi.fn(),
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it('skips tag refs', () => {
    const runGit = vi.fn();
    collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/tags/v1.0.0', localOid: SHA_A, remoteOid: SHA_B },
      ],
      resolveCommitRef: vi.fn(),
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it('deduplicates files across multiple updates', () => {
    const runGit = vi.fn().mockReturnValue('shared.ts\nunique-a.ts');
    const files = collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/feat-a', localOid: SHA_A, remoteOid: SHA_B },
        { localRef: 'refs/heads/feat-b', localOid: SHA_B, remoteOid: SHA_A },
      ],
      resolveCommitRef: (ref: string) => ref,
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });

    // Both updates return same files — deduplication should keep one
    expect(files).toEqual(['shared.ts', 'unique-a.ts']);
  });

  it('skips update when resolveCommitRef returns empty string', () => {
    const runGit = vi.fn();
    const files = collectChangedFilesFromUpdates({
      updates: [
        { localRef: 'refs/heads/main', localOid: SHA_A, remoteOid: SHA_B },
      ],
      resolveCommitRef: () => '',
      resolveDefaultBaseRef: vi.fn(),
      runGit,
      parseChangedFiles,
      isZeroOid,
    });
    expect(runGit).not.toHaveBeenCalled();
    expect(files).toEqual([]);
  });
});

// ─── determineChangedFilesForPush ─────────────────────────────────────────

describe('determineChangedFilesForPush', () => {
  const base = {
    overrideText: '',
    prePushUpdates: [] as string[],
    upstream: '',
    defaultBaseRef: '',
    runGit: vi.fn(),
    parseChangedFiles,
  };

  it('uses overrideText (comma-separated) as highest priority', () => {
    const result = determineChangedFilesForPush({
      ...base,
      overrideText: 'src/app/page.tsx,src/lib/util.ts',
    });
    expect(result).toEqual({
      files: ['src/app/page.tsx', 'src/lib/util.ts'],
      isKnown: true,
    });
  });

  it('uses overrideText (newline-separated)', () => {
    const result = determineChangedFilesForPush({
      ...base,
      overrideText: 'src/a.ts\nsrc/b.ts',
    });
    expect(result).toEqual({
      files: ['src/a.ts', 'src/b.ts'],
      isKnown: true,
    });
  });

  it('uses prePushUpdates when no override', () => {
    const result = determineChangedFilesForPush({
      ...base,
      prePushUpdates: ['src/components/Card.tsx'],
    });
    expect(result).toEqual({
      files: ['src/components/Card.tsx'],
      isKnown: true,
    });
  });

  it('uses upstream diff when available', () => {
    const runGit = vi.fn().mockReturnValue('src/hooks/useData.ts');
    const result = determineChangedFilesForPush({
      ...base,
      upstream: 'origin/main',
      runGit,
    });
    expect(runGit).toHaveBeenCalledWith([
      'diff',
      '--name-only',
      'origin/main..HEAD',
    ]);
    expect(result).toEqual({ files: ['src/hooks/useData.ts'], isKnown: true });
  });

  it('uses merge-base with defaultBaseRef when upstream is absent', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'merge-base') return SHA_BASE;
      return 'src/lib/api.ts';
    });
    const result = determineChangedFilesForPush({
      ...base,
      defaultBaseRef: 'origin/main',
      runGit,
    });
    expect(runGit).toHaveBeenCalledWith(['merge-base', 'HEAD', 'origin/main']);
    expect(runGit).toHaveBeenCalledWith([
      'diff',
      '--name-only',
      `${SHA_BASE}..HEAD`,
    ]);
    expect(result).toEqual({ files: ['src/lib/api.ts'], isKnown: true });
  });

  it('falls back to direct defaultBaseRef diff when merge-base returns empty', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'merge-base') return '';
      if (args[0] === 'diff' && args[2] === 'origin/main..HEAD')
        return 'src/x.ts';
      return '';
    });
    const result = determineChangedFilesForPush({
      ...base,
      defaultBaseRef: 'origin/main',
      runGit,
    });
    expect(result).toEqual({ files: ['src/x.ts'], isKnown: true });
  });

  it('falls back to HEAD~1 when no upstream or defaultBaseRef', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'rev-parse') return 'HEAD~1-sha';
      return 'src/fallback.ts';
    });
    const result = determineChangedFilesForPush({ ...base, runGit });
    expect(runGit).toHaveBeenCalledWith(['rev-parse', '--verify', 'HEAD~1']);
    expect(result).toEqual({ files: ['src/fallback.ts'], isKnown: true });
  });

  it('returns isKnown:false when all resolution paths fail', () => {
    const runGit = vi.fn().mockReturnValue('');
    const result = determineChangedFilesForPush({ ...base, runGit });
    expect(result).toEqual({ files: [], isKnown: false });
  });
});

// ─── isKnownNoOpPush ──────────────────────────────────────────────────────

describe('isKnownNoOpPush', () => {
  it('returns true when isKnown and files is empty', () => {
    expect(isKnownNoOpPush({ isKnown: true, files: [] })).toBe(true);
  });

  it('returns false when isKnown but files has entries', () => {
    expect(isKnownNoOpPush({ isKnown: true, files: ['src/a.ts'] })).toBe(false);
  });

  it('returns false when isKnown is false', () => {
    expect(isKnownNoOpPush({ isKnown: false, files: [] })).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(isKnownNoOpPush(null)).toBe(false);
    expect(isKnownNoOpPush(undefined)).toBe(false);
  });
});
