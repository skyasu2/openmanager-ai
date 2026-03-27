const {
  filterVitestOutput,
  shouldBufferVitestOutput,
} = require('../../../scripts/dev/vitest-main-wrapper.js');

describe('vitest-main-wrapper', () => {
  it('buffers DOM related passWithNoTests runs for post-processing', () => {
    expect(
      shouldBufferVitestOutput([
        'related',
        '--run',
        '--passWithNoTests',
        '--config',
        'config/testing/vitest.config.dom.ts',
      ])
    ).toBe(true);

    expect(
      shouldBufferVitestOutput([
        'run',
        '--config',
        'config/testing/vitest.config.dom.ts',
      ])
    ).toBe(false);
  });

  it('suppresses known dep-scan noise only for zero-test DOM related success', () => {
    const stdout = ` RUN  v4.0.18 /mnt/d/dev/openmanager-ai\n\n${'No test files found, exiting with code 0'}\n`;
    const stderr = `(!) Failed to run dependency scan. Skipping dependency pre-bundling.\n${'The server is being restarted or closed. Request is outdated'}\n`;

    const result = filterVitestOutput(0, stdout, stderr);

    expect(result.suppressed).toBe(true);
    expect(result.stdout).toContain('No test files found');
    expect(result.stderr).toContain('Suppressed benign Vite dep-scan noise');
    expect(result.stderr).not.toContain('Failed to run dependency scan');
  });

  it('preserves non-benign stderr output', () => {
    const result = filterVitestOutput(1, 'RUN\n', 'real failure\n');

    expect(result.suppressed).toBe(false);
    expect(result.stderr).toBe('real failure\n');
  });
});
