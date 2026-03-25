/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'dev',
  'typecheck-changed.sh'
);

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'typecheck-changed-'));
  tempDirs.push(dir);
  return dir;
}

function createCompilerScript(source: string) {
  const dir = createTempDir();
  const compilerPath = join(dir, 'fake-tsc.js');
  writeFileSync(compilerPath, source, 'utf8');
  return compilerPath;
}

function runTypecheckChanged(envOverrides: Record<string, string>) {
  return spawnSync('bash', [SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('typecheck-changed', () => {
  it('writes passed status when the changed project type-check succeeds', () => {
    const compilerPath = createCompilerScript(`
      setTimeout(() => {
        process.exit(0);
      }, 20);
    `);
    const statusDir = createTempDir();
    const statusFile = join(statusDir, 'status.txt');

    const result = runTypecheckChanged({
      PRE_PUSH_CHANGED_FILES: 'scripts/dev/tsc-wrapper.js',
      TYPECHECK_CHANGED_STATUS_FILE: statusFile,
      TSC_WRAPPER_BIN: compilerPath,
    });

    expect(result.status).toBe(0);
    expect(readFileSync(statusFile, 'utf8').trim()).toBe('passed');
    expect(result.stdout).toContain('✅ Type-check passed!');
  });

  it('writes soft-timeout status and exits successfully when soft timeout is enabled', () => {
    const signalDir = createTempDir();
    const signalFile = join(signalDir, 'signal.txt');
    const compilerPath = createCompilerScript(`
      const fs = require('node:fs');
      process.on('SIGTERM', () => {
        fs.writeFileSync(process.env.TSC_WRAPPER_SIGNAL_FILE, 'SIGTERM\\n', 'utf8');
        process.exit(0);
      });
      setInterval(() => {}, 1000);
    `);
    const statusDir = createTempDir();
    const statusFile = join(statusDir, 'status.txt');

    const result = runTypecheckChanged({
      PRE_PUSH_CHANGED_FILES: 'scripts/dev/tsc-wrapper.js',
      TYPECHECK_CHANGED_STATUS_FILE: statusFile,
      TYPECHECK_CHANGED_SOFT_TIMEOUT: 'true',
      TYPECHECK_CHANGED_TIMEOUT_SECONDS: '1',
      TSC_WRAPPER_BIN: compilerPath,
      TSC_WRAPPER_SIGNAL_FILE: signalFile,
      TSC_WRAPPER_KILL_GRACE_MS: '200',
    });

    expect(result.status).toBe(0);
    expect(readFileSync(statusFile, 'utf8').trim()).toBe('soft-timeout');
    expect(result.stdout).toContain(
      'ℹ️ Pre-push에서는 해당 검증을 soft-skip하고 CI/Vercel 전체 타입체크에 위임합니다.'
    );
  });
});
