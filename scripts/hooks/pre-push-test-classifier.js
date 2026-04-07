/**
 * Pre-push test run classifier
 * Determines which test suite to run based on changed files.
 * Pure function — no side effects, no process.exit
 */

'use strict';

const {
  DOM_INFRA_SMOKE_SENTINEL,
  CLOUD_RUN_ROOT,
  isVitestTestFile,
  isPlaywrightTestFile,
  isCloudRunVitestTestFile,
  isCloudRunRelatedSourceFile,
  isRelatedSourceFile,
  isTypeDefinitionSourceFile,
  isDomTestInfraFile,
  isNodeTestInfraFile,
  isHookTestInfraFile,
  isFrontendSmokeFile,
  isDomTestFile,
  normalizeFilePath,
  toCloudRunRelativePath,
} = require('./pre-push-file-classifier');

/**
 * Classify changed files and return the minimal set of test steps to run.
 *
 * @param {object} changedFilesResult - { isKnown: boolean, files: string[] }
 * @param {object} domTestManifest    - { pathPrefixes: string[], exactFiles: Set<string> }
 * @param {boolean} isWSL             - running inside WSL
 * @param {boolean} isWindowsFS       - CWD is under /mnt/ (Windows-mounted FS)
 * @param {string}  cloudRunCwd       - absolute path to cloud-run/ai-engine
 * @returns {{ mode: string, files: string[], steps: object[], guidance: string[] } | null}
 */
function classifyChangedTestRun(
  changedFilesResult,
  domTestManifest,
  isWSL,
  isWindowsFS,
  cloudRunCwd
) {
  if (!changedFilesResult?.isKnown || changedFilesResult.files.length === 0) {
    return null;
  }

  const normalizedFiles = changedFilesResult.files.map(normalizeFilePath);

  // --- Frontend smoke (WSL on Windows FS pays high jsdom startup cost) ------
  const frontendSmokeFiles = normalizedFiles.filter(isFrontendSmokeFile);
  const consumeFrontendSmokeFiles = frontendSmokeFiles.length > 0 && isWSL && isWindowsFS;
  const frontendSmokeFileSet = new Set(consumeFrontendSmokeFiles ? frontendSmokeFiles : []);
  const afterFrontendSmokeFiles = normalizedFiles.filter(
    (f) => !frontendSmokeFileSet.has(f)
  );

  // --- AI workspace quick -----------------------------------------------
  const aiWorkspaceQuickFiles = afterFrontendSmokeFiles.filter(isFrontendSmokeFile);
  const aiWorkspaceQuickFileSet = new Set(aiWorkspaceQuickFiles);
  const afterAiWorkspaceQuickFiles = afterFrontendSmokeFiles.filter(
    (f) => !aiWorkspaceQuickFileSet.has(f)
  );

  // --- Playwright (E2E) -------------------------------------------------------
  const playwrightTestFiles = afterAiWorkspaceQuickFiles.filter(isPlaywrightTestFile);
  const playwrightTestFileSet = new Set(playwrightTestFiles);
  const afterPlaywrightTestFiles = afterAiWorkspaceQuickFiles.filter(
    (f) => !playwrightTestFileSet.has(f)
  );

  // --- Cloud Run test files --------------------------------------------------
  const cloudRunTestFiles = afterPlaywrightTestFiles.filter(isCloudRunVitestTestFile);
  const cloudRunTestFileSet = new Set(cloudRunTestFiles);
  const afterCloudRunTestFiles = afterPlaywrightTestFiles.filter(
    (f) => !cloudRunTestFileSet.has(f)
  );

  // --- Cloud Run source files ------------------------------------------------
  const cloudRunSourceFiles = afterCloudRunTestFiles.filter(isCloudRunRelatedSourceFile);
  const cloudRunSourceFileSet = new Set(cloudRunSourceFiles);
  const remainingFiles = afterCloudRunTestFiles.filter(
    (f) => !cloudRunSourceFileSet.has(f)
  );

  // --- Main repo test / source files ----------------------------------------
  const testFiles = remainingFiles.filter(isVitestTestFile);
  const allRelatedSourceFiles = remainingFiles.filter(isRelatedSourceFile);
  const typeDefinitionFiles = allRelatedSourceFiles.filter(isTypeDefinitionSourceFile);
  const typeDefinitionFileSet = new Set(typeDefinitionFiles);
  const nodeInfraFiles = remainingFiles.filter(isNodeTestInfraFile);
  const nodeInfraFileSet = new Set(nodeInfraFiles);
  const relatedSourceFiles = allRelatedSourceFiles.filter(
    (f) => !typeDefinitionFileSet.has(f) && !nodeInfraFileSet.has(f)
  );
  const domInfraFiles = remainingFiles.filter(isDomTestInfraFile);
  const hookInfraFiles = remainingFiles.filter(isHookTestInfraFile);

  const steps = [];
  const summaryParts = [];
  const guidance = [];
  const scopeFiles = [];

  if (consumeFrontendSmokeFiles) {
    steps.push({
      label: `AI assistant quick smoke (${frontendSmokeFiles.length} file${frontendSmokeFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:quick'],
    });
    summaryParts.push('AI assistant quick smoke');
    guidance.push('npm run test:quick');
    scopeFiles.push(...frontendSmokeFiles);
  }

  if (aiWorkspaceQuickFiles.length > 0) {
    steps.push({
      label: `AI workspace quick smoke (${aiWorkspaceQuickFiles.length} file${aiWorkspaceQuickFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:quick'],
    });
    summaryParts.push('AI workspace quick smoke');
    guidance.push('npm run test:quick');
    scopeFiles.push(...aiWorkspaceQuickFiles);
  }

  if (playwrightTestFiles.length > 0) {
    steps.push({
      label: `Playwright spec quick smoke (${playwrightTestFiles.length} file${playwrightTestFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:quick'],
    });
    summaryParts.push('playwright spec quick smoke');
    guidance.push('npm run test:quick');
    scopeFiles.push(...playwrightTestFiles);
  }

  if (cloudRunTestFiles.length > 0) {
    steps.push({
      label: `Cloud Run targeted node suite (${cloudRunTestFiles.length} file${cloudRunTestFiles.length > 1 ? 's' : ''})`,
      runner: 'npx',
      cwd: cloudRunCwd,
      args: ['vitest', 'run', ...cloudRunTestFiles.map(toCloudRunRelativePath)],
    });
    summaryParts.push('cloud-run targeted node');
    guidance.push('cd cloud-run/ai-engine && npx vitest run <changed test files>');
    scopeFiles.push(...cloudRunTestFiles);
  }

  if (cloudRunSourceFiles.length > 0) {
    steps.push({
      label: `Cloud Run related node suite (${cloudRunSourceFiles.length} source file${cloudRunSourceFiles.length > 1 ? 's' : ''})`,
      runner: 'npx',
      cwd: cloudRunCwd,
      args: ['vitest', 'related', '--run', '--passWithNoTests', ...cloudRunSourceFiles.map(toCloudRunRelativePath)],
    });
    summaryParts.push('cloud-run related node');
    guidance.push(
      'cd cloud-run/ai-engine && npx vitest related --run --passWithNoTests <changed source files>'
    );
    scopeFiles.push(...cloudRunSourceFiles);
  }

  if (testFiles.length > 0) {
    const domTestFiles = testFiles.filter((f) => isDomTestFile(f, domTestManifest));
    const nodeTestFiles = testFiles.filter((f) => !isDomTestFile(f, domTestManifest));

    if (domTestFiles.length === testFiles.length) {
      steps.push({
        label: `Targeted DOM suite (${domTestFiles.length} file${domTestFiles.length > 1 ? 's' : ''})`,
        args: ['run', 'test:dom', '--', ...domTestFiles],
      });
      summaryParts.push('targeted DOM');
      guidance.push('npm run test:dom -- <changed test files>');
      scopeFiles.push(...domTestFiles);
    } else if (nodeTestFiles.length === testFiles.length) {
      steps.push({
        label: `Targeted node suite (${nodeTestFiles.length} file${nodeTestFiles.length > 1 ? 's' : ''})`,
        args: ['run', 'test:node', '--', ...nodeTestFiles],
      });
      summaryParts.push('targeted node');
      guidance.push('npm run test:node -- <changed test files>');
      scopeFiles.push(...nodeTestFiles);
    } else {
      steps.push({
        label: 'Quick smoke for mixed DOM/node test changes',
        args: ['run', 'test:super-fast'],
      });
      summaryParts.push('mixed test quick smoke');
      guidance.push('npm run test:super-fast');
      scopeFiles.push(...testFiles);
    }
  }

  if (relatedSourceFiles.length > 0) {
    steps.push({
      label: `Related node suite (${relatedSourceFiles.length} source file${relatedSourceFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:related:node', '--', ...relatedSourceFiles],
    });
    steps.push({
      label: `Related DOM suite (${relatedSourceFiles.length} source file${relatedSourceFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:related:dom', '--', ...relatedSourceFiles],
    });
    summaryParts.push('source-related node + DOM');
    guidance.push('npm run test:related:node -- <changed source files>');
    guidance.push('npm run test:related:dom -- <changed source files>');
    scopeFiles.push(...relatedSourceFiles);
  } else if (typeDefinitionFiles.length > 0) {
    steps.push({
      label: `Type definition quick smoke (${typeDefinitionFiles.length} file${typeDefinitionFiles.length > 1 ? 's' : ''})`,
      args: ['run', 'test:super-fast'],
    });
    summaryParts.push('type definition quick smoke');
    guidance.push('npm run test:super-fast');
    scopeFiles.push(...typeDefinitionFiles);
  } else if (domInfraFiles.length > 0 && !scopeFiles.includes(DOM_INFRA_SMOKE_SENTINEL)) {
    steps.push({
      label: 'DOM infrastructure smoke',
      args: ['run', 'test:related:dom', '--', DOM_INFRA_SMOKE_SENTINEL],
    });
    summaryParts.push('DOM infra smoke');
    guidance.push(`npm run test:related:dom -- ${DOM_INFRA_SMOKE_SENTINEL}`);
    scopeFiles.push(...domInfraFiles);
  }

  if (nodeInfraFiles.length > 0) {
    steps.push({
      label: 'Node infrastructure smoke',
      args: ['run', 'test:node:infra:smoke'],
    });
    summaryParts.push('node infra smoke');
    guidance.push('npm run test:node:infra:smoke');
    scopeFiles.push(...nodeInfraFiles);
  }

  if (hookInfraFiles.length > 0 && steps.length === 0) {
    steps.push({
      label: 'Quick smoke for hook infrastructure changes',
      args: ['run', 'test:quick'],
    });
    summaryParts.push('hook infra quick smoke');
    guidance.push('npm run test:quick');
    scopeFiles.push(...hookInfraFiles);
  }

  if (steps.length === 0) return null;

  return {
    mode: summaryParts.join(' + '),
    files: Array.from(new Set(scopeFiles)),
    steps,
    guidance: Array.from(new Set(guidance)),
  };
}

module.exports = { classifyChangedTestRun };
