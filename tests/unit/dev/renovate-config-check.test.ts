/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'renovate',
  'check-config.sh'
);

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'renovate-config-check-'));
  tempDirs.push(dir);
  return dir;
}

function createFakeDocker(binDir: string, logPath: string) {
  const dockerPath = join(binDir, 'docker');
  writeFileSync(
    dockerPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${logPath}"
if [[ "\${1:-}" == "info" ]]; then
  exit 0
fi
if [[ "\${1:-}" == "run" ]]; then
  printf 'validator ok\\n'
  exit 0
fi
exit 1
`,
    'utf8'
  );
  chmodSync(dockerPath, 0o755);
}

function runCheckConfig(pathPrefix: string) {
  return spawnSync('bash', [SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${pathPrefix}:${process.env.PATH}`,
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('renovate check-config', () => {
  it('uses docker validator with strict renovate.json validation when docker is available', () => {
    const dir = createTempDir();
    const binDir = join(dir, 'bin');
    const logPath = join(dir, 'docker.log');
    mkdirSync(binDir, { recursive: true });
    createFakeDocker(binDir, logPath);

    const result = runCheckConfig(binDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validator ok');

    const log = readFileSync(logPath, 'utf8');
    expect(log).toContain('info');
    expect(log).toContain('run --rm');
    expect(log).toContain('renovate-config-validator --strict renovate.json');
  });
});
