/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  isComponentMapRelevantFile,
  shouldVerifyComponentDependencyMap,
} = require('../../../scripts/hooks/pre-push-component-map');

describe('pre-push component map helpers', () => {
  it('recognizes component source and generated map artifacts as relevant', () => {
    expect(
      isComponentMapRelevantFile('src/components/dashboard/ServerDashboard.tsx')
    ).toBe(true);
    expect(
      isComponentMapRelevantFile(
        'docs/reference/architecture/system/component-dependency-map.md'
      )
    ).toBe(true);
    expect(
      isComponentMapRelevantFile('reports/docs/component-dependency-map.json')
    ).toBe(true);
    expect(isComponentMapRelevantFile('src/app/dashboard/page.tsx')).toBe(
      false
    );
  });

  it('normalizes windows-style paths', () => {
    expect(
      isComponentMapRelevantFile(
        'src\\components\\dashboard\\ServerDashboard.tsx'
      )
    ).toBe(true);
    expect(
      isComponentMapRelevantFile(
        'docs\\reference\\architecture\\system\\component-dependency-map.md'
      )
    ).toBe(true);
  });

  it('skips verification when changed files are unknown', () => {
    expect(
      shouldVerifyComponentDependencyMap({
        changedFilesResult: { isKnown: false, files: [] },
      })
    ).toEqual({
      shouldRun: false,
      reason: 'unknown-changed-files',
    });
  });

  it('runs verification when relevant files changed', () => {
    expect(
      shouldVerifyComponentDependencyMap({
        changedFilesResult: {
          isKnown: true,
          files: ['src/components/ai/AIWorkspace.tsx'],
        },
      })
    ).toEqual({
      shouldRun: true,
      reason: 'relevant-changes',
    });
  });

  it('skips verification on known no-op pushes', () => {
    expect(
      shouldVerifyComponentDependencyMap({
        changedFilesResult: {
          isKnown: true,
          files: [],
        },
      })
    ).toEqual({
      shouldRun: false,
      reason: 'known-no-op-push',
    });
  });

  it('skips verification on unrelated changes', () => {
    expect(
      shouldVerifyComponentDependencyMap({
        changedFilesResult: {
          isKnown: true,
          files: [
            'src/app/page.tsx',
            'scripts/dev/check-next-dev-readiness.sh',
          ],
        },
      })
    ).toEqual({
      shouldRun: false,
      reason: 'not-relevant',
    });
  });

  it('supports forced verification', () => {
    expect(
      shouldVerifyComponentDependencyMap({
        changedFilesResult: { isKnown: false, files: [] },
        force: true,
      })
    ).toEqual({
      shouldRun: true,
      reason: 'forced',
    });
  });
});
