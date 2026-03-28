/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const {
  resolveDefaultBaseRefFromGit,
} = require('../../../scripts/hooks/pre-push-base-ref');

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
