/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = resolve(
  process.cwd(),
  'scripts/dev/root-artifact-cleanup.js'
);
const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'root-artifact-cleanup-'));
  tempDirs.push(dir);
  return dir;
}

function runCleanup(args: string[], cwd: string) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('root-artifact-cleanup strict mode', () => {
  it('allows tolerated framework dirs like .next', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.next'), { recursive: true });
    writeFileSync(join(dir, '.next', 'trace.txt'), 'ok');

    const result = runCleanup(['--strict'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Root tolerated dirs');
    expect(result.stdout).toContain('.next');
  });

  it('fails when non-tolerated root artifact dirs are present', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, 'artifacts', 'playwright'), { recursive: true });
    writeFileSync(join(dir, 'artifacts', 'playwright', 'stale.png'), 'stale');

    const result = runCleanup(['--strict'], dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Root blocking dirs');
    expect(result.stdout).toContain('artifacts');
  });

  it('moves blocking dirs but leaves tolerated dirs in place during cleanup', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.next'), { recursive: true });
    mkdirSync(join(dir, 'playwright-report'), { recursive: true });
    writeFileSync(join(dir, '.next', 'build.txt'), 'keep');
    writeFileSync(join(dir, 'playwright-report', 'index.html'), 'move');

    const result = runCleanup(
      ['--apply', '--apply-dirs', '--dest', 'tmp/root-artifacts/test-run'],
      dir
    );

    expect(result.status).toBe(0);
    expect(existsSync(join(dir, '.next', 'build.txt'))).toBe(true);
    expect(existsSync(join(dir, 'playwright-report'))).toBe(false);
    expect(
      existsSync(
        join(
          dir,
          'tmp',
          'root-artifacts',
          'test-run',
          'dirs',
          'playwright-report',
          'index.html'
        )
      )
    ).toBe(true);
  });
});
