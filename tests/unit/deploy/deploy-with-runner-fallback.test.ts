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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT_PATH = join(
  REPO_ROOT,
  'scripts/deploy/deploy-with-runner-fallback.sh'
);

const tempDirs: string[] = [];

function runCommand(cwd: string, command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function runGit(cwd: string, args: string[]) {
  const result = runCommand(cwd, 'git', args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeExecutable(
  rootDir: string,
  relativePath: string,
  content: string
) {
  const filePath = join(rootDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  chmodSync(filePath, 0o755);
}

function writeFile(rootDir: string, relativePath: string, content: string) {
  const filePath = join(rootDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function createFixtureWorkspace() {
  const rootDir = mkdtempSync(join(tmpdir(), 'deploy-with-runner-'));
  const remoteDir = mkdtempSync(join(tmpdir(), 'deploy-with-runner-remote-'));
  tempDirs.push(rootDir, remoteDir);

  writeExecutable(
    rootDir,
    'scripts/deploy/deploy-with-runner-fallback.sh',
    readFileSync(SCRIPT_PATH, 'utf8')
  );
  writeExecutable(
    rootDir,
    'scripts/ci/runner-health-check.sh',
    '#!/usr/bin/env bash\nexit 0\n'
  );
  writeExecutable(
    rootDir,
    'scripts/gitlab/check-head-pipeline.sh',
    [
      '#!/usr/bin/env bash',
      'echo "id=123 status=waiting_for_resource sha=abc ref=main updated_at=2026-05-13T00:00:00Z url=https://gitlab.example/pipelines/123 note=pipeline_not_terminal_after_wait"',
      '',
    ].join('\n')
  );
  writeExecutable(
    rootDir,
    'scripts/gitlab/inspect-pipeline.sh',
    [
      '#!/usr/bin/env bash',
      'echo "Pipeline"',
      'echo "id=123 status=waiting_for_resource ref=main sha=abc url=https://gitlab.example/pipelines/123"',
      'echo "Diagnosis"',
      'echo "- waiting_for_resource: job=deploy resource_group=production action=inspect_or_clear_resource_group_queue"',
      '',
    ].join('\n')
  );
  writeExecutable(
    rootDir,
    'scripts/deploy/guard-canonical-deploy.sh',
    '#!/usr/bin/env bash\nexit 0\n'
  );
  writeFile(
    rootDir,
    'package.json',
    JSON.stringify(
      {
        scripts: {
          'gitlab:pipeline:head': 'bash scripts/gitlab/check-head-pipeline.sh',
          'gitlab:pipeline:inspect': 'bash scripts/gitlab/inspect-pipeline.sh',
        },
      },
      null,
      2
    )
  );

  runGit(remoteDir, ['init', '--bare', '--initial-branch=main']);
  runGit(rootDir, ['init', '--initial-branch=main']);
  runGit(rootDir, ['config', 'user.email', 'test@example.com']);
  runGit(rootDir, ['config', 'user.name', 'Test User']);
  writeFile(rootDir, 'README.md', '# fixture\n');
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', 'initial']);
  runGit(rootDir, ['remote', 'add', 'gitlab', remoteDir]);

  return rootDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('deploy-with-runner-fallback.sh', () => {
  it('inspects nonterminal GitLab pipelines after a CI-path push', () => {
    const rootDir = createFixtureWorkspace();

    const result = spawnSync(
      'bash',
      ['scripts/deploy/deploy-with-runner-fallback.sh'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          CANONICAL_REMOTE: 'gitlab',
          CANONICAL_BRANCH: 'main',
        },
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('pipeline_not_terminal_after_wait');
    expect(result.stdout).toContain(
      'waiting_for_resource: job=deploy resource_group=production'
    );
    expect(result.stderr).not.toContain('vercel --prod');
  });
});
