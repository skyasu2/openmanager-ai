/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  filterVitestQuickOutput,
  stripKnownDepScanNoise,
} = require('../../../scripts/dev/vitest-quick-wrapper.js');

describe('vitest-quick-wrapper', () => {
  it('suppresses known dep-scan noise after a successful quick run', () => {
    const stdout = [
      '',
      ' RUN  v4.1.2 /repo',
      ' Test Files  8 passed (8)',
      '(!) Failed to run dependency scan. Skipping dependency pre-bundling.',
      'The server is being restarted or closed. Request is outdated',
    ].join('\n');

    const result = filterVitestQuickOutput(0, stdout, '');

    expect(result.suppressed).toBe(true);
    expect(result.stdout).toContain('Test Files  8 passed (8)');
    expect(result.stdout).not.toContain('Failed to run dependency scan');
    expect(result.stderr).toContain('Suppressed benign Vite dep-scan noise');
  });

  it('does not suppress noise on a failing run', () => {
    const stdout = [
      '',
      ' Test Files  1 failed (1)',
      '(!) Failed to run dependency scan. Skipping dependency pre-bundling.',
      'The server is being restarted or closed. Request is outdated',
    ].join('\n');

    const result = filterVitestQuickOutput(1, stdout, '');

    expect(result.suppressed).toBe(false);
    expect(result.stdout).toContain('Failed to run dependency scan');
  });

  it('removes only the trailing dep-scan section', () => {
    const text = [
      'header',
      'summary',
      '(!) Failed to run dependency scan. Skipping dependency pre-bundling.',
      'details',
    ].join('\n');

    expect(stripKnownDepScanNoise(text)).toBe('header\nsummary');
  });
});
