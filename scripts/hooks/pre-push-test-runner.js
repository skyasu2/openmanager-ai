/**
 * Pre-push test runner helpers
 * Separates skip/run planning from process execution.
 */

'use strict';

const { classifyChangedTestRun } = require('./pre-push-test-classifier');

function analyzeTestExecutionPlan({
  changedFilesResult,
  isLimitedMode,
  skipTests,
  isKnownNoOpPush,
  domTestManifest,
  isWSL,
  isWindowsFS,
  cloudRunCwd,
  classifyChangedRun = classifyChangedTestRun,
}) {
  if (isLimitedMode) {
    return {
      kind: 'skip',
      reason: 'windows-limited',
      testStatus: 'skipped',
      selectedTestMode: 'quick',
    };
  }

  if (skipTests) {
    return {
      kind: 'skip',
      reason: 'skip-tests-env',
      testStatus: 'skipped',
      selectedTestMode: 'quick',
    };
  }

  if (isKnownNoOpPush(changedFilesResult)) {
    return {
      kind: 'skip',
      reason: 'known-no-op-push',
      testStatus: 'skipped-no-op-push',
      selectedTestMode: 'quick',
    };
  }

  const targetedRun = classifyChangedRun(
    changedFilesResult,
    domTestManifest,
    isWSL,
    isWindowsFS,
    cloudRunCwd
  );

  if (targetedRun) {
    return {
      kind: 'run',
      selectedTestMode: targetedRun.mode,
      targetedRun,
      steps: targetedRun.steps,
    };
  }

  return {
    kind: 'run',
    selectedTestMode: 'quick',
    targetedRun: null,
    steps: [{ label: 'Quick smoke', args: ['run', 'test:super-fast'] }],
  };
}

function executeTestExecutionPlan(plan, deps) {
  if (plan.kind !== 'run') {
    return {
      ok: true,
      skipped: true,
      testStatus: plan.testStatus,
      selectedTestMode: plan.selectedTestMode,
    };
  }

  const { cwd, runNpm, runNpx } = deps;
  const success = plan.steps.every(({ args, label, runner, cwd: stepCwd }) => {
    if (label) console.log(`   → ${label}`);
    const runCwd = stepCwd || cwd;
    return runner === 'npx' ? runNpx(args, runCwd) : runNpm(args, null, runCwd);
  });

  if (success) {
    return {
      ok: true,
      skipped: false,
      testStatus: 'passed',
      selectedTestMode: plan.selectedTestMode,
    };
  }

  return {
    ok: false,
    skipped: false,
    testStatus: 'failed',
    selectedTestMode: plan.selectedTestMode,
    guidance:
      plan.targetedRun?.guidance?.length > 0
        ? plan.targetedRun.guidance
        : ['npm run test:super-fast'],
  };
}

module.exports = {
  analyzeTestExecutionPlan,
  executeTestExecutionPlan,
};
