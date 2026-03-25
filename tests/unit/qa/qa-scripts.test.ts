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
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

function writeWorkspaceFile(
  tempDir: string,
  relativePath: string,
  content = 'artifact'
) {
  const filePath = join(tempDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return filePath;
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
    artifacts: [],
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
    expect(statusResult.stdout).toContain(
      '- dashboard file: reports/qa/QA_STATUS.md (read-only)'
    );

    const statusPath = join(tempDir, 'reports', 'qa', 'QA_STATUS.md');
    expect(existsSync(statusPath)).toBe(true);
    expect(readFileSync(statusPath, 'utf8')).toContain(
      'Coverage Packs: core-routes-smoke, dashboard-core, ai-core'
    );
  });

  it('syncs QA_STATUS.md and public validation evidence when qa:status runs with --write', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        ciEvidence: {
          provider: 'github-actions',
          owner: 'skyasu2',
          repo: 'openmanager-ai',
          workflowName: 'CI/CD Core Gates',
          runId: '23381598925',
          branch: 'main',
          commitSha: '03fa41be562ff2cacffe58c5c0b45ad476e7e184',
        },
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_sync123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const statusPath = join(tempDir, 'reports', 'qa', 'QA_STATUS.md');
    const validationEvidencePath = join(
      tempDir,
      'public',
      'data',
      'qa',
      'validation-evidence.json'
    );
    writeFileSync(statusPath, 'stale dashboard\n', 'utf8');
    const staleMtime = statSync(statusPath).mtimeMs;

    const readOnlyResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, [], {
      cwd: tempDir,
    });

    expect(readOnlyResult.status).toBe(0);
    expect(readOnlyResult.stdout).toContain(
      '- dashboard file: reports/qa/QA_STATUS.md (read-only)'
    );
    expect(readFileSync(statusPath, 'utf8')).toBe('stale dashboard\n');
    expect(statSync(statusPath).mtimeMs).toBe(staleMtime);
    expect(existsSync(validationEvidencePath)).toBe(false);

    const syncResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, ['--write'], {
      cwd: tempDir,
    });

    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain(
      '- dashboard synced: reports/qa/QA_STATUS.md'
    );
    expect(syncResult.stdout).toContain(
      '- public evidence synced: public/data/qa/validation-evidence.json'
    );
    expect(readFileSync(statusPath, 'utf8')).toContain(
      'Coverage Packs: core-routes-smoke, dashboard-core, ai-core'
    );
    expect(existsSync(validationEvidencePath)).toBe(true);
    expect(readFileSync(validationEvidencePath, 'utf8')).toContain(
      '"latestRunId": "QA-'
    );
  });

  it('repairs stale tracker summary and sequence when qa:status runs with --write', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(tempDir, createValidPayload());

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_repair123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const trackerPath = join(tempDir, 'reports', 'qa', 'qa-tracker.json');
    const validationEvidencePath = join(
      tempDir,
      'public',
      'data',
      'qa',
      'validation-evidence.json'
    );
    const staleTracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
    staleTracker.summary = {
      totalRuns: 0,
      totalChecks: 0,
      totalPassed: 0,
      totalFailed: 0,
      completionRate: 0,
      completedItems: 0,
      pendingItems: 0,
      deferredItems: 0,
      wontFixItems: 0,
      expertDomainsTracked: 0,
      expertDomainsOpenGaps: 0,
      lastRunId: null,
      lastRecordedAt: null,
    };
    staleTracker.sequence = { nextRunNumber: 1 };
    staleTracker.meta = {
      createdAt: staleTracker.meta.createdAt,
      updatedAt: 'stale',
    };
    writeFileSync(
      trackerPath,
      `${JSON.stringify(staleTracker, null, 2)}\n`,
      'utf8'
    );
    writeWorkspaceFile(
      tempDir,
      'public/data/qa/validation-evidence.json',
      '{"stale":true}\n'
    );

    const syncResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, ['--write'], {
      cwd: tempDir,
    });

    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain(
      '- public evidence skipped: QA validation evidence summary is unavailable (stale snapshot removed)'
    );
    const repairedTracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
    expect(repairedTracker.summary.totalRuns).toBe(1);
    expect(repairedTracker.summary.totalChecks).toBe(8);
    expect(repairedTracker.summary.lastRunId).toMatch(/^QA-\d{8}-\d+$/);
    expect(repairedTracker.sequence.nextRunNumber).toBeGreaterThan(1);
    expect(repairedTracker.meta.updatedAt).not.toBe('stale');
    expect(existsSync(validationEvidencePath)).toBe(false);
  });

  it('prints malformed recent runs defensively in qa:status', () => {
    const tempDir = createTempWorkspace();
    const trackerPath = join(tempDir, 'reports', 'qa', 'qa-tracker.json');

    writeFileSync(
      trackerPath,
      `${JSON.stringify(
        {
          version: '1.0.0',
          meta: {
            createdAt: '2026-03-25T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
          },
          sequence: {
            nextRunNumber: 2,
          },
          summary: {
            totalRuns: 1,
            totalChecks: 0,
            totalPassed: 0,
            totalFailed: 0,
            completionRate: 0,
            completedItems: 0,
            pendingItems: 0,
            deferredItems: 0,
            wontFixItems: 0,
            expertDomainsTracked: 0,
            expertDomainsOpenGaps: 0,
            lastRunId: 'QA-20260325-0182',
            lastRecordedAt: '2026-03-25T00:00:00.000Z',
          },
          items: {},
          experts: {},
          runs: [
            {
              runId: 'QA-20260325-0182',
              title: 'Malformed run',
              scope: 'targeted',
              recordedAt: '2026-03-25T00:00:00.000Z',
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const statusResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, [], {
      cwd: tempDir,
    });

    expect(statusResult.status).toBe(0);
    expect(statusResult.stdout).toContain(
      '- QA-20260325-0182: Malformed run (scope targeted, checks 0, completed 0, pending 0, wont-fix 0)'
    );
  });

  it('records structured Playwright artifacts and prints artifact summary', () => {
    const tempDir = createTempWorkspace();
    const traceUrl = 'https://storage.example.com/playwright/trace.zip';
    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        artifacts: [
          {
            type: 'playwright-trace',
            label: 'Broad smoke trace',
            url: traceUrl,
          },
          {
            type: 'playwright-report',
            label: 'HTML report',
            url: 'https://storage.example.com/playwright/index.html',
          },
          {
            type: 'playwright-screenshot',
            label: 'Dashboard screenshot',
            path: 'artifacts/dashboard.png',
          },
        ],
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_artifact123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));
    expect(runRecord.artifacts).toHaveLength(3);
    expect(runRecord.artifacts[0]).toEqual({
      type: 'playwright-trace',
      label: 'Broad smoke trace',
      url: traceUrl,
      viewerUrl: `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`,
    });

    const statusResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, [], {
      cwd: tempDir,
    });

    expect(statusResult.status).toBe(0);
    expect(statusResult.stdout).toContain(
      '- latest artifacts: 3 (playwright-trace, playwright-report, playwright-screenshot)'
    );

    const statusPath = join(tempDir, 'reports', 'qa', 'QA_STATUS.md');
    const statusMarkdown = readFileSync(statusPath, 'utf8');
    expect(statusMarkdown).toContain('## Artifacts (Latest Run)');
    expect(statusMarkdown).toContain('trace.playwright.dev/?trace=');
    expect(statusMarkdown).toContain('artifacts/dashboard.png');
  });

  it('expands GitHub Actions CI evidence into structured links', () => {
    const tempDir = createTempWorkspace();
    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        ciEvidence: {
          provider: 'github-actions',
          owner: 'skyasu2',
          repo: 'openmanager-ai',
          workflowName: 'CI/CD Core Gates',
          runId: '23381598925',
          branch: 'main',
          commitSha: '03fa41be562ff2cacffe58c5c0b45ad476e7e184',
          artifacts: [
            'playwright-results-23381598925',
            {
              name: 'playwright-report-23381598925',
              url: 'https://example.com/playwright-report.zip',
            },
          ],
        },
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_ci123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));
    expect(runRecord.links).toEqual([
      {
        type: 'github-actions-artifact',
        label: 'GitHub Artifact: playwright-report-23381598925',
        url: 'https://example.com/playwright-report.zip',
      },
      {
        type: 'github-actions-artifact',
        label: 'GitHub Artifact: playwright-results-23381598925',
        url: 'https://github.com/skyasu2/openmanager-ai/actions/runs/23381598925',
        note: 'artifact=playwright-results-23381598925; download/open from the workflow run page',
      },
      {
        type: 'github-actions-run',
        label: 'GitHub Actions: CI/CD Core Gates #23381598925',
        url: 'https://github.com/skyasu2/openmanager-ai/actions/runs/23381598925',
        note: 'branch=main, sha=03fa41be562ff2cacffe58c5c0b45ad476e7e184',
      },
    ]);

    const statusResult = runNodeScript(PRINT_QA_STATUS_SCRIPT, [], {
      cwd: tempDir,
    });

    expect(statusResult.status).toBe(0);
    expect(statusResult.stdout).toContain(
      '- latest links: 3 (github-actions-artifact, github-actions-run)'
    );

    const statusPath = join(tempDir, 'reports', 'qa', 'QA_STATUS.md');
    const statusMarkdown = readFileSync(statusPath, 'utf8');
    expect(statusMarkdown).toContain('## Links (Latest Run)');
    expect(statusMarkdown).toContain(
      'https://github.com/skyasu2/openmanager-ai/actions/runs/23381598925'
    );
    expect(statusMarkdown).toContain('playwright-results-23381598925');
  });

  it('auto-detects recent Playwright report/test-results artifacts', () => {
    const tempDir = createTempWorkspace();
    writeWorkspaceFile(
      tempDir,
      'playwright-report/index.html',
      '<html>report</html>'
    );
    writeWorkspaceFile(
      tempDir,
      'test-results/smoke-chromium/trace.zip',
      'trace'
    );
    writeWorkspaceFile(
      tempDir,
      'test-results/smoke-chromium/dashboard.png',
      'png'
    );

    const oldTracePath = writeWorkspaceFile(
      tempDir,
      'test-results/old-run/trace.zip',
      'old-trace'
    );
    const oldDate = new Date(Date.now() - 5 * 60 * 60 * 1000);
    utimesSync(oldTracePath, oldDate, oldDate);

    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        source: 'playwright',
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_autocollect123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));

    expect(runRecord.artifacts).toEqual([
      {
        type: 'playwright-report',
        label: 'Playwright HTML report',
        path: 'playwright-report/index.html',
      },
      {
        type: 'playwright-screenshot',
        label: 'dashboard.png',
        path: 'test-results/smoke-chromium/dashboard.png',
      },
      {
        type: 'playwright-trace',
        label: 'smoke-chromium',
        path: 'test-results/smoke-chromium/trace.zip',
      },
    ]);
  });

  it('auto-detects recent Playwright MCP screenshots', () => {
    const tempDir = createTempWorkspace();
    writeWorkspaceFile(
      tempDir,
      '.playwright-mcp/screenshots/dashboard-overview.png',
      'png'
    );

    const oldScreenshotPath = writeWorkspaceFile(
      tempDir,
      '.playwright-mcp/screenshots/old-run.png',
      'old-png'
    );
    const oldDate = new Date(Date.now() - 5 * 60 * 60 * 1000);
    utimesSync(oldScreenshotPath, oldDate, oldDate);

    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        source: 'playwright-mcp',
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_mcpartifact123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));

    expect(runRecord.artifacts).toEqual([
      {
        type: 'playwright-screenshot',
        label: 'dashboard-overview.png',
        path: '.playwright-mcp/screenshots/dashboard-overview.png',
      },
    ]);
  });

  it('filters recent Playwright artifacts by pathIncludes', () => {
    const tempDir = createTempWorkspace();
    writeWorkspaceFile(
      tempDir,
      'test-results/qa-20260321-ai-free-text/trace.zip',
      'trace'
    );
    writeWorkspaceFile(
      tempDir,
      'test-results/unrelated-run/trace.zip',
      'trace'
    );
    writeWorkspaceFile(
      tempDir,
      '.playwright-mcp/screenshots/qa-20260321-ai-free-text.png',
      'png'
    );
    writeWorkspaceFile(
      tempDir,
      '.playwright-mcp/screenshots/another-recent-run.png',
      'png'
    );

    const inputPath = writeInputFile(
      tempDir,
      createValidPayload({
        source: 'playwright-mcp',
        playwrightArtifacts: {
          resultsDir: 'test-results',
          screenshotsDir: '.playwright-mcp/screenshots',
          recentMinutes: 180,
          pathIncludes: ['qa-20260321-ai-free-text'],
        },
      })
    );

    const recordResult = runNodeScript(
      RECORD_QA_RUN_SCRIPT,
      ['--input', inputPath],
      {
        cwd: tempDir,
        env: {
          VERCEL_DEPLOYMENT_ID: 'dpl_pathfilter123',
          VERCEL_GIT_COMMIT_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          VERCEL_GIT_COMMIT_REF: 'main',
          VERCEL_TARGET_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'openmanager-ai.vercel.app',
        },
      }
    );

    expect(recordResult.status).toBe(0);

    const runFilePath = findGeneratedRunFile(tempDir);
    const runRecord = JSON.parse(readFileSync(runFilePath, 'utf8'));

    expect(runRecord.artifacts).toEqual([
      {
        type: 'playwright-screenshot',
        label: 'qa-20260321-ai-free-text.png',
        path: '.playwright-mcp/screenshots/qa-20260321-ai-free-text.png',
      },
      {
        type: 'playwright-trace',
        label: 'qa-20260321-ai-free-text',
        path: 'test-results/qa-20260321-ai-free-text/trace.zip',
      },
    ]);
  });
});
