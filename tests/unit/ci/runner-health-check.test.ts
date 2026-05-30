/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'ci',
  'runner-health-check.sh'
);

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeExecutable(path: string, lines: string[]) {
  writeFileSync(path, lines.join('\n'), 'utf8');
  chmodSync(path, 0o755);
}

function createFakeHealthCommands(binDir: string, maxBuilds: number) {
  writeExecutable(join(binDir, 'systemctl'), [
    '#!/usr/bin/env bash',
    '[[ "$1" == "is-active" ]] && exit 0',
    'exit 1',
    '',
  ]);
  writeExecutable(join(binDir, 'docker'), [
    '#!/usr/bin/env bash',
    '[[ "$1" == "info" ]] && exit 0',
    'exit 1',
    '',
  ]);
  writeExecutable(join(binDir, 'journalctl'), [
    '#!/usr/bin/env bash',
    `echo "Removed job from processing list builds=0 max_builds=${maxBuilds} queue_size=1"`,
    '',
  ]);
}

function runHealthCheck(maxBuilds: number) {
  const tempDir = createTempDir('runner-health-check-');
  const binDir = join(tempDir, 'bin');
  mkdirSync(binDir, { recursive: true });
  createFakeHealthCommands(binDir, maxBuilds);

  return spawnSync('bash', [SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    },
  });
}

describe('runner-health-check script', () => {
  it('reports limited release parallelism when the runner handles one build', () => {
    const result = runHealthCheck(1);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      'runner=true docker=true scope=local runner_max_builds=1 release_parallelism=runner_capacity_limited'
    );
  });

  it('reports available release parallelism when runner capacity exceeds one build', () => {
    const result = runHealthCheck(2);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      'runner=true docker=true scope=local runner_max_builds=2 release_parallelism=runner_capacity_available'
    );
  });
});
