/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
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
  writeFileSync(
    join(repoDir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.2.3' }, null, 2),
    'utf8'
  );
  writeFileSync(
    join(repoDir, 'package-lock.json'),
    JSON.stringify(
      {
        name: 'fixture',
        version: '1.2.3',
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture', version: '1.2.3' },
        },
      },
      null,
      2
    ),
    'utf8'
  );
  mkdirSync(join(repoDir, 'cloud-run', 'ai-engine'), { recursive: true });
  writeFileSync(
    join(repoDir, 'cloud-run', 'ai-engine', 'package.json'),
    JSON.stringify({ name: 'ai-engine', version: '1.2.3' }, null, 2),
    'utf8'
  );
  writeFileSync(
    join(repoDir, 'cloud-run', 'ai-engine', 'package-lock.json'),
    JSON.stringify(
      {
        name: 'ai-engine',
        version: '1.2.3',
        lockfileVersion: 3,
        packages: {
          '': { name: 'ai-engine', version: '1.2.3' },
        },
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    join(repoDir, 'CHANGELOG.md'),
    '# Changelog\n\nAll notable changes to this project will be documented in this file.\n',
    'utf8'
  );
  writeFileSync(
    join(repoDir, '.versionrc.json'),
    JSON.stringify(
      {
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'chore', hidden: true },
        ],
      },
      null,
      2
    ),
    'utf8'
  );
  runCommand('git', ['-C', repoDir, 'add', 'README.md'], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'add', '.'], { cwd: process.cwd() });
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

function writeSmokeScript(repoDir: string, bodyLines: string[]) {
  const scriptDir = join(repoDir, 'scripts', 'test');
  mkdirSync(scriptDir, { recursive: true });
  writeFileSync(
    join(scriptDir, 'vercel-post-deploy-smoke.mjs'),
    bodyLines.join('\n'),
    'utf8'
  );
}

function writeReleaseConsistencyScript(repoDir: string) {
  const scriptDir = join(repoDir, 'scripts', 'release');
  mkdirSync(scriptDir, { recursive: true });
  writeFileSync(
    join(scriptDir, 'check-release-consistency.js'),
    'process.exit(0);\n',
    'utf8'
  );
}

function commitRepoChanges(repoDir: string, message: string) {
  runCommand('git', ['-C', repoDir, 'add', '.'], {
    cwd: process.cwd(),
  });
  runCommand('git', ['-C', repoDir, 'commit', '-m', message], {
    cwd: process.cwd(),
  });
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
  it('prints canonical gitlab push hint in dry-run mode without mutating files', () => {
    const repoDir = initReleaseRepo();
    writeFileSync(join(repoDir, 'feature.txt'), 'feature\n', 'utf8');
    runCommand('git', ['-C', repoDir, 'add', 'feature.txt'], {
      cwd: process.cwd(),
    });
    runCommand('git', ['-C', repoDir, 'commit', '-m', 'feat: add fixture'], {
      cwd: process.cwd(),
    });

    const result = runPublish(repoDir, ['minor'], {
      DRY_RUN: '1',
      CANONICAL_REMOTE: 'gitlab',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('🔍 Dry-run 모드');
    expect(result.stdout).toContain('Release dry-run');
    expect(result.stdout).toContain('next: 1.3.0');
    expect(result.stdout).toContain(
      'Actual canonical publish path in this repository is: git push --follow-tags gitlab main'
    );
    expect(readFileSync(join(repoDir, 'package.json'), 'utf8')).toContain(
      '"version": "1.2.3"'
    );
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

  it('fails preflight when canonical remote is missing', () => {
    const repoDir = initReleaseRepo();
    runCommand('git', ['-C', repoDir, 'remote', 'remove', 'gitlab'], {
      cwd: process.cwd(),
    });

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "❌ Canonical remote 'gitlab'가 없습니다."
    );
  });

  it('fails preflight when the worktree is dirty', () => {
    const repoDir = initReleaseRepo();
    writeFileSync(join(repoDir, 'README.md'), '# fixture updated\n', 'utf8');

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain('M README.md');
  });

  it('fails preflight when current branch is not main', () => {
    const repoDir = initReleaseRepo();
    runCommand('git', ['-C', repoDir, 'switch', '-c', 'release-prep'], {
      cwd: process.cwd(),
    });

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ 릴리즈는 main 브랜치에서만 허용됩니다.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'current: release-prep'
    );
  });

  it('fails preflight when main upstream is unset', () => {
    const repoDir = initReleaseRepo();
    runCommand('git', ['-C', repoDir, 'branch', '--unset-upstream'], {
      cwd: process.cwd(),
    });

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ main upstream이 gitlab/main 이어야 합니다.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain('current: none');
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Fix: git branch --set-upstream-to=gitlab/main main'
    );
  });

  it('fails preflight when main upstream is not gitlab/main', () => {
    const repoDir = initReleaseRepo();
    const bareRemoteDir = createTempDir('release-publish-alt-remote-');
    const altRemoteGitDir = join(bareRemoteDir, 'origin.git');

    runCommand('git', ['init', '--bare', '-q', altRemoteGitDir], {
      cwd: process.cwd(),
    });
    runCommand(
      'git',
      ['-C', repoDir, 'remote', 'add', 'origin', altRemoteGitDir],
      {
        cwd: process.cwd(),
      }
    );
    runCommand('git', ['-C', repoDir, 'push', '-u', 'origin', 'main'], {
      cwd: process.cwd(),
    });
    runCommand(
      'git',
      ['-C', repoDir, 'branch', '--set-upstream-to=origin/main', 'main'],
      {
        cwd: process.cwd(),
      }
    );

    const result = runPublish(repoDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ main upstream이 gitlab/main 이어야 합니다.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'current: origin/main'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Fix: git branch --set-upstream-to=gitlab/main main'
    );
  });

  it('fails preflight when current production version gate detects drift', () => {
    const repoDir = initReleaseRepo();
    writeSmokeScript(repoDir, [
      '#!/usr/bin/env node',
      "console.error('expected deployed version 1.2.3, got 1.2.2');",
      'process.exit(1);',
      '',
    ]);
    commitRepoChanges(repoDir, 'add smoke fixture');

    const result = runPublish(repoDir, ['patch']);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '❌ Refusing to create a new release while production drift remains.'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Expected current production version: 1.2.3'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'RELEASE_REQUIRE_DEPLOYED_BASE=false'
    );
  });

  it('allows bypassing the current production version gate explicitly', () => {
    const repoDir = initReleaseRepo();
    writeSmokeScript(repoDir, [
      '#!/usr/bin/env node',
      "console.error('expected deployed version 1.2.3, got 1.2.2');",
      'process.exit(1);',
      '',
    ]);
    writeReleaseConsistencyScript(repoDir);
    commitRepoChanges(repoDir, 'add release fixtures');

    const result = runPublish(repoDir, ['patch'], {
      RELEASE_REQUIRE_DEPLOYED_BASE: 'false',
      RELEASE_VERIFY_PRODUCTION: 'false',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '⚪ Base release drift gate skipped (RELEASE_REQUIRE_DEPLOYED_BASE=false)'
    );
    expect(result.stdout).toContain(
      '⚪ Production verification skipped (RELEASE_VERIFY_PRODUCTION=false)'
    );
    expect(result.stdout).toContain('Release commit and tag created: v1.2.4');
    expect(
      runCommand('git', ['-C', repoDir, 'tag', '--list', 'v1.2.4'], {
        cwd: process.cwd(),
      }).stdout.trim()
    ).toBe('v1.2.4');
    expect(
      JSON.parse(readFileSync(join(repoDir, 'package.json'), 'utf8')).version
    ).toBe('1.2.4');
    expect(
      JSON.parse(
        readFileSync(
          join(repoDir, 'cloud-run', 'ai-engine', 'package.json'),
          'utf8'
        )
      ).version
    ).toBe('1.2.4');
    expect(readFileSync(join(repoDir, 'CHANGELOG.md'), 'utf8')).toContain(
      '## [1.2.4]'
    );
  });
});
