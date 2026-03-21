/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const RECORD_QA_RUN_SCRIPT = fileURLToPath(
  new URL('../../../scripts/qa/record-qa-run.js', import.meta.url)
);
const PRINT_QA_STATUS_SCRIPT = fileURLToPath(
  new URL('../../../scripts/qa/print-qa-status.js', import.meta.url)
);

const tempDirs: string[] = [];

function createTempWorkspace() {
  const tempDir = mkdtempSync(join(tmpdir(), 'qa-scripts-'));
  tempDirs.push(tempDir);
  mkdirSync(join(tempDir, 'reports', 'qa'), { recursive: true });
  return tempDir;
}

function writeInputFile(tempDir: string, payload: unknown) {
  const inputPath = join(tempDir, 'qa-run-input.json');
  writeFileSync(inputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return inputPath;
}

function runNodeScript(
  scriptPath: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  }
) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function findGeneratedRunFile(tempDir: string) {
  const yearDir = join(tempDir, 'reports', 'qa', 'runs', '2026');
  const runFile = readdirSync(yearDir).find((entry) => entry.endsWith('.json'));
  if (!runFile) {
    throw new Error(`Generated run file not found in ${yearDir}`);
  }
  return join(yearDir, runFile);
}

function createValidPayload(overrides?: Record<string, unknown>) {
  return {
    runTitle: 'QA script regression smoke',
    owner: 'codex',
    source: 'playwright-mcp',
    scope: 'broad',
    releaseFacing: true,
    coveragePacks: ['core-routes-smoke', 'dashboard-core', 'ai-core'],
    coveredSurfaces: [
      '/',
      '/login',
      '/api/health',
      '/api/version',
      '404',
      'system-boot → /dashboard redirect',
      'dashboard render',
      'AI sidebar open/chat',
    ],
    skippedSurfaces: ['Reporter flow'],
    environment: {
      target: 'vercel-production',
      frontend: 'Vercel',
      backend: 'Cloud Run',
    },
    checks: {
      total: 8,
      passed: 8,
      failed: 0,
    },
    expertAssessments: [
      {
        domainId: 'test-automation',
        fit: 'appropriate',
        improvementNeeded: false,
        rationale: 'qa script regression smoke',
      },
    ],
    usageChecks: [
      {
        platform: 'vercel',
        method: 'cli',
        status: 'checked',
        result: 'normal',
        summary: 'qa script regression smoke',
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('QA scripts', () => {
  it('autofills release evidence from Vercel env for qa:record', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(tempDir, createValidPayload());

    const result = runNodeScript(RECORD_QA_RUN_SCRIPT, ['--input', inputPath], {
      cwd: tempDir,
      env: {
        VERCEL_DEPLOYMENT_ID: 'dpl_regression123',
        VERCEL_GIT_COMMIT_SHA: '1234567890abcdef1234567890abcdef12345678',
        VERCEL_GIT_COMMIT_REF: 'main',
        VERCEL_TARGET_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
      },
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('QA run recorded');

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));

    expect(runRecord.environment.url).toBe('https://openmanager-ai.vercel.app');
    expect(runRecord.environment.branch).toBe('main');
    expect(runRecord.environment.deploymentId).toBe('dpl_regression123');
    expect(runRecord.environment.commitSha).toBe(
      '1234567890abcdef1234567890abcdef12345678'
    );
    expect(runRecord.coveragePacks).toEqual([
      'core-routes-smoke',
      'dashboard-core',
      'ai-core',
    ]);
  });

  it('fails when release-facing Vercel run has no deployment evidence', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(tempDir, createValidPayload());

    const result = runNodeScript(RECORD_QA_RUN_SCRIPT, ['--input', inputPath], {
      cwd: tempDir,
      env: {
        VERCEL_TARGET_ENV: 'production',
        VERCEL_GIT_COMMIT_SHA: '1234567890abcdef1234567890abcdef12345678',
      },
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'environment.deploymentId가 필요합니다'
    );
  });

  it('prints latest deployment and coverage pack summary in qa:status', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(tempDir, createValidPayload());

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_status123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const statusResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, [], {
      cwd: tempDir,
    });

    expect(statusResult.status).toBe(0);
    expect(statusResult.stdout).toContain(
      '- latest deployment: dpl_status123 / abcdefabcdefabcdefabcdefabcdefabcdefabcd'
    );
    expect(statusResult.stdout).toContain(
      '- latest coverage packs: core-routes-smoke, dashboard-core, ai-core'
    );

    const statusPath = join(tempDir, 'reports', 'qa', 'QA_STATUS.md');
    expect(existsSync(statusPath)).toBe(true);
    expect(readFileSync(statusPath, 'utf8')).toContain(
      'Coverage Packs: core-routes-smoke, dashboard-core, ai-core'
    );
  });
});
