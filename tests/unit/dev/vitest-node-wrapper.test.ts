/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  DEFAULT_NODE_CONFIG,
  DEV_NODE_CONFIG,
  buildVitestArgs,
  extractTargetFiles,
  shouldUseDevNodeConfig,
} = require('../../../scripts/dev/vitest-node-wrapper.js');

describe('vitest-node-wrapper', () => {
  it('extracts explicit target files while skipping flags and config values', () => {
    expect(
      extractTargetFiles([
        '--runInBand',
        '--config',
        'config/testing/custom.ts',
        'tests/unit/dev/github-sync.test.ts',
      ])
    ).toEqual(['tests/unit/dev/github-sync.test.ts']);
  });

  it('selects dev node config when every target file is under tests/unit/dev', () => {
    expect(
      shouldUseDevNodeConfig([
        'tests/unit/dev/github-sync.test.ts',
        'tests/unit/dev/pre-push-guards.test.ts',
      ])
    ).toBe(true);
  });

  it('falls back to the default node config for mixed or non-dev targets', () => {
    expect(
      shouldUseDevNodeConfig([
        'tests/unit/dev/github-sync.test.ts',
        'src/lib/util.test.ts',
      ])
    ).toBe(false);
    expect(shouldUseDevNodeConfig(['src/lib/util.test.ts'])).toBe(false);
  });

  it('builds vitest args with the dev config for targeted dev tests', () => {
    expect(
      buildVitestArgs('run', ['tests/unit/dev/github-sync.test.ts'])
    ).toEqual([
      'run',
      '--config',
      DEV_NODE_CONFIG,
      'tests/unit/dev/github-sync.test.ts',
    ]);
  });

  it('builds vitest args with the default config for non-dev targets', () => {
    expect(buildVitestArgs('run', ['src/lib/util.test.ts'])).toEqual([
      'run',
      '--config',
      DEFAULT_NODE_CONFIG,
      'src/lib/util.test.ts',
    ]);
  });
});
