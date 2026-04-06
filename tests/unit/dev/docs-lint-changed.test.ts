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
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'docs', 'lint-changed.sh');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-lint-changed-'));
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

function initGitRepo(tempDir: string) {
  const result = runCommand('git', ['init', '-q'], { cwd: tempDir });
  if (result.status !== 0) {
    throw new Error(`git init failed: ${result.stderr || result.stdout}`);
  }
}

function writeWorkspaceFile(
  tempDir: string,
  relativePath: string,
  content: string
) {
  const filePath = join(tempDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
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

function runDocsLintChanged(tempDir: string, env: NodeJS.ProcessEnv = {}) {
  return runCommand('bash', [SCRIPT_PATH], {
    cwd: tempDir,
    env,
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('docs lint changed script', () => {
  it('lints reports/qa markdown as active docs', () => {
    const tempDir = createTempDir();
    initGitRepo(tempDir);
    const callLog = join(tempDir, 'npx-call.log');
    const fakeBinDir = createFakeNpx(tempDir);
    writeWorkspaceFile(tempDir, 'reports/qa/README.md', '# QA Reports\n');

    const result = runDocsLintChanged(tempDir, {
      NPX_CALL_LOG: callLog,
      PATH: `${fakeBinDir}:${process.env.PATH || ''}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Linting changed active docs (1)...');
    expect(result.stdout).toContain('Changed docs lint passed.');

    const loggedArgs = readFileSync(callLog, 'utf8');
    expect(loggedArgs).toContain('markdownlint-cli2');
    expect(loggedArgs).toContain('active.markdownlint-cli2.jsonc');
    expect(loggedArgs).toContain('reports/qa/README.md');
  });

  it('lints production qa baseline markdown as historical docs', () => {
    const tempDir = createTempDir();
    initGitRepo(tempDir);
    const callLog = join(tempDir, 'npx-call.log');
    const fakeBinDir = createFakeNpx(tempDir);
    writeWorkspaceFile(
      tempDir,
      'reports/qa/production-qa-2026-02-25.md',
      '# Production QA Baseline\n'
    );

    const result = runDocsLintChanged(tempDir, {
      NPX_CALL_LOG: callLog,
      PATH: `${fakeBinDir}:${process.env.PATH || ''}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Linting changed historical docs (1)...');
    expect(result.stdout).toContain('Historical docs lint passed.');

    const loggedArgs = readFileSync(callLog, 'utf8');
    expect(loggedArgs).toContain('markdownlint-cli2');
    expect(loggedArgs).toContain('historical.markdownlint-cli2.jsonc');
    expect(loggedArgs).toContain('reports/qa/production-qa-2026-02-25.md');
  });
});
