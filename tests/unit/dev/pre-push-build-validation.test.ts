/**
 * @vitest-environment node
 */

import { existsSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const {
  analyzeBuildValidation,
  cleanupTypeCheckStatus,
  createTypeCheckStatusFile,
  readTypeCheckStatus,
} = require('../../../scripts/hooks/pre-push-build-validation');

function runAnalyze(
  changedFilesResult: { isKnown: boolean; files: string[] },
  overrides: Partial<{
    skipBuild: boolean;
    isLimitedMode: boolean;
    quickPush: boolean;
  }> = {}
) {
  return analyzeBuildValidation({
    changedFilesResult,
    skipBuild: overrides.skipBuild ?? false,
    isLimitedMode: overrides.isLimitedMode ?? false,
    quickPush: overrides.quickPush ?? true,
    isKnownNoOpPush: (result: { isKnown: boolean; files: string[] }) =>
      result.isKnown && result.files.length === 0,
    filterTypeCheckRelevantFiles: (files: string[]) =>
      files.filter(
        (file) => file.endsWith('.ts') && !file.startsWith('cloud-run/')
      ),
    isTypeDefinitionFile: (file: string) => file.startsWith('src/types/'),
    isCloudRunTypeCheckRelevantFile: (file: string) =>
      file.startsWith('cloud-run/ai-engine/src/') &&
      file.endsWith('.ts') &&
      !file.endsWith('.test.ts'),
  });
}

describe('analyzeBuildValidation', () => {
  it('returns skip-build when SKIP_BUILD is enabled', () => {
    expect(
      runAnalyze(
        { isKnown: true, files: ['src/app/page.tsx'] },
        { skipBuild: true }
      )
    ).toEqual({ mode: 'skip-build' });
  });

  it('returns known-no-op when the push is known to be empty', () => {
    expect(runAnalyze({ isKnown: true, files: [] })).toEqual({
      mode: 'known-no-op',
    });
  });

  it('returns windows-limited when limited mode is active', () => {
    expect(
      runAnalyze(
        { isKnown: true, files: ['src/app/page.tsx'] },
        { isLimitedMode: true }
      )
    ).toEqual({ mode: 'windows-limited' });
  });

  it('returns full-build when quick push is disabled', () => {
    expect(
      runAnalyze(
        { isKnown: true, files: ['src/app/page.tsx'] },
        { quickPush: false }
      )
    ).toEqual({ mode: 'full-build' });
  });

  it('skips all type-checks when no relevant TS files changed', () => {
    expect(runAnalyze({ isKnown: true, files: ['README.md'] })).toEqual({
      mode: 'quick',
      rootTypeCheckRelevantFiles: [],
      cloudRunTypeCheckRelevantFiles: [],
      rootTypeCheckStrategy: 'skip-no-relevant',
      skipRootTypeCheck: true,
      skipCloudRunTypeCheck: true,
      useChangedTypeCheck: false,
      shouldSkipAll: true,
    });
  });

  it('delegates root type-check when only src/types definitions changed', () => {
    expect(
      runAnalyze({ isKnown: true, files: ['src/types/common.ts'] })
    ).toEqual({
      mode: 'quick',
      rootTypeCheckRelevantFiles: ['src/types/common.ts'],
      cloudRunTypeCheckRelevantFiles: [],
      rootTypeCheckStrategy: 'skip-type-definition-only',
      skipRootTypeCheck: true,
      skipCloudRunTypeCheck: true,
      useChangedTypeCheck: false,
      shouldSkipAll: true,
    });
  });

  it('tracks root TS changes separately from cloud-run changes', () => {
    expect(
      runAnalyze({
        isKnown: true,
        files: ['src/lib/utils.ts', 'cloud-run/ai-engine/src/server.ts'],
      })
    ).toEqual({
      mode: 'quick',
      rootTypeCheckRelevantFiles: ['src/lib/utils.ts'],
      cloudRunTypeCheckRelevantFiles: ['cloud-run/ai-engine/src/server.ts'],
      rootTypeCheckStrategy: 'changed',
      skipRootTypeCheck: false,
      skipCloudRunTypeCheck: false,
      useChangedTypeCheck: true,
      shouldSkipAll: false,
    });
  });
});

describe('type-check status file helpers', () => {
  it('creates, reads, and cleans up the status file directory', () => {
    const statusFile = createTypeCheckStatusFile();

    expect(existsSync(statusFile.tempDir)).toBe(true);
    expect(readTypeCheckStatus(statusFile.filePath)).toBeNull();

    writeFileSync(statusFile.filePath, 'soft-timeout\n', 'utf8');
    expect(readTypeCheckStatus(statusFile.filePath)).toBe('soft-timeout');

    cleanupTypeCheckStatus(statusFile.tempDir);
    expect(existsSync(statusFile.tempDir)).toBe(false);
  });
});
