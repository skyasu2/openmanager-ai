/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  filterTypeCheckRelevantFiles,
  isTypeCheckInfraFile,
  isTypeCheckRelevantFile,
} = require('../../../scripts/dev/typecheck-scope.js');

describe('typecheck-scope', () => {
  it('treats type-check infrastructure files as root type-check relevant', () => {
    expect(isTypeCheckInfraFile('scripts/dev/tsc-wrapper.js')).toBe(true);
    expect(isTypeCheckInfraFile('scripts/dev/typecheck-changed.sh')).toBe(true);
    expect(isTypeCheckInfraFile('tsconfig.json')).toBe(true);
    expect(isTypeCheckInfraFile('tsconfig.check.json')).toBe(true);
    expect(isTypeCheckInfraFile('tsconfig.release.json')).toBe(true);
    expect(isTypeCheckInfraFile('scripts/dev/typecheck-report.js')).toBe(true);
    expect(isTypeCheckInfraFile('scripts/dev/tsc-runner.js')).toBe(true);
    expect(isTypeCheckInfraFile('package.json')).toBe(true);
  });

  it('still excludes test and story files from app source classification', () => {
    expect(isTypeCheckRelevantFile('src/hooks/example.ts')).toBe(true);
    expect(isTypeCheckRelevantFile('src/hooks/example.test.ts')).toBe(false);
    expect(isTypeCheckRelevantFile('src/components/example.stories.tsx')).toBe(
      false
    );
  });

  it('keeps infra files in filtered changed-file output', () => {
    expect(
      filterTypeCheckRelevantFiles([
        'scripts/dev/tsc-wrapper.js',
        'scripts/dev/typecheck-report.js',
        'tsconfig.release.json',
        'src/hooks/example.test.ts',
        'docs/guide.md',
      ])
    ).toEqual([
      'scripts/dev/tsc-wrapper.js',
      'scripts/dev/typecheck-report.js',
      'tsconfig.release.json',
    ]);
  });
});
