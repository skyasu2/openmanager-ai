/**
 * @vitest-environment node
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const WRAPPER_PATH = join(process.cwd(), 'scripts', 'dev', 'tsc-wrapper.js');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'tsc-wrapper-'));
  tempDirs.push(dir);
  return dir;
}

function createCompilerScript(source: string) {
  const dir = createTempDir();
  const compilerPath = join(dir, 'fake-tsc.js');
  writeFileSync(compilerPath, source, 'utf8');
  return compilerPath;
}

function runWrapper({
  compilerPath,
  signal,
}: {
  compilerPath: string;
  signal?: NodeJS.Signals;
}) {
  return new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, [WRAPPER_PATH, '--noEmit'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TSC_WRAPPER_BIN: compilerPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (signal && stdout.includes('TypeScript 컴파일러 실행 중')) {
        child.kill(signal);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code, closeSignal) => {
      resolve({
        code,
        signal: closeSignal,
        stdout,
        stderr,
      });
    });
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('tsc-wrapper', () => {
  it('reports success with elapsed time', async () => {
    const compilerPath = createCompilerScript(`
      setTimeout(() => {
        process.exit(0);
      }, 20);
    `);

    const result = await runWrapper({ compilerPath });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('🔧 TypeScript 컴파일러 실행 중...');
    expect(result.stdout).toContain('✅ TypeScript 컴파일 성공');
  });

  it('reports failure with elapsed time', async () => {
    const compilerPath = createCompilerScript(`
      setTimeout(() => {
        process.exit(2);
      }, 20);
    `);

    const result = await runWrapper({ compilerPath });

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('❌ TypeScript 컴파일 실패');
  });

  it('times out and stops the compiler process when timeout is configured', async () => {
    const outputDir = createTempDir();
    const signalFile = join(outputDir, 'signal.txt');
    const compilerPath = createCompilerScript(`
      const fs = require('node:fs');
      const signalFile = process.env.TSC_WRAPPER_SIGNAL_FILE;
      process.on('SIGTERM', () => {
        fs.writeFileSync(signalFile, 'SIGTERM\\n', 'utf8');
        process.exit(0);
      });
      setInterval(() => {}, 1000);
    `);

    const result = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      const child = spawn(process.execPath, [WRAPPER_PATH, '--noEmit'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TSC_WRAPPER_BIN: compilerPath,
          TSC_WRAPPER_SIGNAL_FILE: signalFile,
          TSC_WRAPPER_TIMEOUT_MS: '200',
          TSC_WRAPPER_KILL_GRACE_MS: '200',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code, closeSignal) => {
        resolve({
          code,
          signal: closeSignal,
          stdout,
          stderr,
        });
      });
    });

    expect(result.code).toBe(124);
    expect(result.stderr).toContain('TypeScript 컴파일 timeout (200ms)');
    expect(result.stderr).toContain('❌ TypeScript 컴파일 시간 초과');
    expect(readFileSync(signalFile, 'utf8')).toBe('SIGTERM\n');
  });
});
