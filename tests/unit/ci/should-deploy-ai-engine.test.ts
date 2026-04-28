/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/ci/should-deploy-ai-engine.sh');

const tempDirs: string[] = [];

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function writeFile(cwd: string, relativePath: string, content: string) {
  const filePath = join(cwd, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ai-engine-deploy-guard-'));
  tempDirs.push(dir);

  runGit(dir, ['init']);
  runGit(dir, ['config', 'user.email', 'test@example.com']);
  runGit(dir, ['config', 'user.name', 'Test User']);
  writeFile(dir, 'README.md', '# fixture\n');
  runGit(dir, ['add', '.']);
  runGit(dir, ['commit', '-m', 'initial']);
  const base = runGit(dir, ['rev-parse', 'HEAD']);

  return { dir, base };
}

function commitChange(cwd: string, relativePath: string) {
  writeFile(cwd, relativePath, `${relativePath}\n`);
  runGit(cwd, ['add', '.']);
  runGit(cwd, ['commit', '-m', `change ${relativePath}`]);
  return runGit(cwd, ['rev-parse', 'HEAD']);
}

function runGuard(cwd: string, base: string, head: string) {
  return spawnSync('bash', [SCRIPT_PATH, '--base', base, '--head', head], {
    cwd,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('should-deploy-ai-engine.sh', () => {
  it('skips Cloud Run deploy for frontend-only changes', () => {
    const { dir, base } = createRepo();
    const head = commitChange(dir, 'src/app/page.tsx');

    const result = runGuard(dir, base, head);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('decision=skip');
  });

  it('deploys Cloud Run when ai-engine files changed', () => {
    const { dir, base } = createRepo();
    const head = commitChange(dir, 'cloud-run/ai-engine/src/index.ts');

    const result = runGuard(dir, base, head);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('decision=deploy');
  });
});
