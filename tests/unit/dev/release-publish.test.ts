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

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'release', 'publish.sh');

const tempDirs: string[] = [];

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  }
) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function initReleaseRepo() {
  const repoDir = createTempDir('release-publish-repo-');
  const bareRemoteDir = createTempDir('release-publish-remote-');
  const remoteGitDir = join(bareRemoteDir, 'canonical.git');

  runCommand('git', ['init', '-q', repoDir], { cwd: process.cwd() });
  runCommand('git', ['-C', repoDir, 'config', 'user.name', 'Codex Test'], {
    cwd: process.cwd(),
  });
  runCommand(
    'git',
    ['-C', repoDir, 'config', 'user.email', 'codex@example.com'],
    {
      cwd: process.cwd(),
    }
  );
  writeFileSync(join(repoDir, 'README.md'), '# fixture\n', 'utf8');
  runCommand('git', ['-C', repoDir, 'add', 'README.md'], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'commit', '-m', 'init'], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'branch', '-M', 'main'], {
    cwd: process.cwd(),
  });

  runCommand('git', ['init', '--bare', '-q', remoteGitDir], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'remote', 'add', 'gitlab', remoteGitDir], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'push', '-u', 'gitlab', 'main'], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'config', 'remote.pushDefault', 'gitlab'], {
    cwd: process.cwd(),
  });

  return repoDir;
}

function createFakeNpx(tempDir: string) {
  const binDir = join(tempDir, 'bin');
  mkdirSync(binDir, { recursive: true });
  const fakeNpxPath = join(binDir, 'npx');

  writeFileSync(
    fakeNpxPath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'printf \'%s\\n\' "$@" >> "$NPX_CALL_LOG"',
      'exit 0',
      '',
    ].join('\n'),
    'utf8'
  );
  chmodSync(fakeNpxPath, 0o755);
  return binDir;
}

function runPublish(
  cwd: string,
  args: string[] = [],
  envOverrides: NodeJS.ProcessEnv = {}
) {
  return runCommand('bash', [SCRIPT_PATH, ...args], {
    cwd,
    env: envOverrides,
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('release publish script', () => {
  it('prints canonical gitlab push hint in dry-run mode', () => {
    const tempDir = createTempDir('release-publish-dry-run-');
    const callLog = join(tempDir, 'npx-call.log');
    const fakeBinDir = createFakeNpx(tempDir);

    const result = runPublish(tempDir, ['minor'], {
      DRY_RUN: '1',
      CANONICAL_REMOTE: 'gitlab',
      NPX_CALL_LOG: callLog,
      PATH: `${fakeBinDir}:${process.env.PATH || ''}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('🔍 Dry-run 모드');
    expect(result.stdout).toContain(
      'Actual canonical publish path in this repository is: git push --follow-tags gitlab main'
    );

    const loggedArgs = readFileSync(callLog, 'utf8');
    expect(loggedArgs).toContain('commit-and-tag-version');
    expect(loggedArgs).toContain('--dry-run');
    expect(loggedArgs).toContain('--release-as');
    expect(loggedArgs).toContain('minor');
  });

  it('fails preflight when remote.pushDefault is not gitlab', () => {
    const repoDir = initReleaseRepo();
    runCommand(
      'git',
      ['-C', repoDir, 'config', 'remote.pushDefault', 'origin'],
      {
        cwd: process.cwd(),
      }
    );

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ remote.pushDefault가 gitlab 이어야 합니다.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain('current: origin');
  });
});
