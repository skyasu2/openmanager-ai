/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const {
  resolveDefaultBaseRefFromGit,
} = require('../../../scripts/hooks/pre-push-base-ref');
const {
  collectChangedFilesFromUpdates,
  determineChangedFilesForPush,
} = require('../../../scripts/hooks/pre-push-changed-files');

describe('resolveDefaultBaseRefFromGit', () => {
  it('prefers the current branch remote before other remotes', () => {
    const runGit = vi.fn((args: string[]) => {
      const key = args.join(' ');
      switch (key) {
        case 'config --get branch.feature/test.remote':
          return 'gitlab';
        case 'config --get remote.pushDefault':
          return 'origin';
        case 'symbolic-ref --quiet refs/remotes/gitlab/HEAD':
          return 'refs/remotes/gitlab/main';
        default:
          return '';
      }
    });

    expect(resolveDefaultBaseRefFromGit(runGit, 'feature/test')).toBe(
      'gitlab/main'
    );
  });

  it('falls back to remote.pushDefault when branch remote is unavailable', () => {
    const runGit = vi.fn((args: string[]) => {
      const key = args.join(' ');
      switch (key) {
        case 'config --get branch.feature/test.remote':
          return '';
        case 'config --get remote.pushDefault':
          return 'gitlab';
        case 'symbolic-ref --quiet refs/remotes/gitlab/HEAD':
          return '';
        case 'rev-parse --verify gitlab/main':
          return 'abc123';
        default:
          return '';
      }
    });

    expect(resolveDefaultBaseRefFromGit(runGit, 'feature/test')).toBe(
      'gitlab/main'
    );
  });

  it('falls back to local main when no remote refs are available', () => {
    const runGit = vi.fn((args: string[]) => {
      const key = args.join(' ');
      switch (key) {
        case 'config --get branch.feature/test.remote':
          return '';
        case 'config --get remote.pushDefault':
          return '';
        case 'rev-parse --verify main':
          return 'def456';
        default:
          return '';
      }
    });

    expect(resolveDefaultBaseRefFromGit(runGit, 'feature/test')).toBe('main');
  });
});

describe('pre-push changed file helpers', () => {
  it('does not fall back to diff-tree when a remote-tracked push has no diff', () => {
    const runGit = vi.fn((args: string[]) => {
      const key = args.join(' ');
      switch (key) {
        case 'diff --name-only remoteSha..localSha':
          return '';
        default:
          return '';
      }
    });

    const resolveCommitRef = vi.fn((value: string) => {
      if (value === 'localOid') return 'localSha';
      if (value === 'remoteOid') return 'remoteSha';
      return '';
    });

    const result = collectChangedFilesFromUpdates({
      updates: [
        {
          localRef: 'refs/heads/main',
          localOid: 'localOid',
          remoteRef: 'refs/heads/main',
          remoteOid: 'remoteOid',
        },
      ],
      resolveCommitRef,
      resolveDefaultBaseRef: () => '',
      runGit,
      parseChangedFiles: (output: string) =>
        output
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      isZeroOid: (oid: string) => /^0+$/.test(oid),
    });

    expect(result).toEqual([]);
    expect(runGit).toHaveBeenCalledWith([
      'diff',
      '--name-only',
      'remoteSha..localSha',
    ]);
    expect(runGit).not.toHaveBeenCalledWith([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      'localSha',
    ]);
  });

  it('treats an empty upstream diff as a known no-op push', () => {
    const runGit = vi.fn((args: string[]) => {
      const key = args.join(' ');
      switch (key) {
        case 'diff --name-only gitlab/main..HEAD':
          return '';
        default:
          return '';
      }
    });

    const result = determineChangedFilesForPush({
      overrideText: '',
      prePushUpdates: [],
      upstream: 'gitlab/main',
      defaultBaseRef: 'gitlab/main',
      runGit,
      parseChangedFiles: (output: string) =>
        output
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
    });

    expect(result).toEqual({
      files: [],
      isKnown: true,
    });
  });
});
