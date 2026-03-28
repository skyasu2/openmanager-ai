#!/usr/bin/env node

/**
 * Cross-platform Pre-push Hook
 * Windows/macOS/Linux compatible
 * Uses execFileSync for security (no shell injection risk)
 */

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const isWindows = os.platform() === 'win32';
const isWSL =
  !isWindows &&
  fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

const { filterTypeCheckRelevantFiles } = require('../dev/typecheck-scope');
const { resolveDefaultBaseRefFromGit } = require('./pre-push-base-ref');
const {
  collectChangedFilesFromUpdates,
  determineChangedFilesForPush,
  isKnownNoOpPush,
} = require('./pre-push-changed-files');
const {
  isDocsArtifactOnlyPush,
  validateChangedJsonArtifacts,
} = require('./pre-push-docs-artifacts');
const {
  createTypeCheckStatusFile,
  readTypeCheckStatus,
  cleanupTypeCheckStatus,
  analyzeBuildValidation,
} = require('./pre-push-build-validation');
const {
  CLOUD_RUN_ROOT,
  loadDomTestManifest,
  normalizeFilePath,
  isCloudRunTypeCheckRelevantFile,
} = require('./pre-push-file-classifier');
const {
  analyzeTestExecutionPlan,
  executeTestExecutionPlan,
} = require('./pre-push-test-runner');
const {
  checkCloudBuildFreeTierGuard,
  checkNodeModules,
  checkRelease,
  checkWSLPerformance,
  checkEnvironment,
} = require('./pre-push-guards');

const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const gitCmd = isWindows ? 'git.exe' : 'git';
const cwd = process.cwd();
const isWindowsFS = cwd.startsWith('/mnt/');
const cloudRunCwd = path.join(cwd, CLOUD_RUN_ROOT);

// Environment flags
// 🎯 2025 Best Practice: Pre-push는 빠르게, Full Build는 CI/Vercel에서
// - QUICK_PUSH=true (기본): TypeScript만 (~20초)
// - QUICK_PUSH=false: Full Build (~3분, 릴리스 전 검증용)
// - STRICT_PUSH_ENV=true: env:check를 pre-push에서 강제
// - FORCE_CLOUD_BUILD_GUARD=true: Cloud Build 가드를 항상 실행
const SKIP_RELEASE_CHECK = process.env.SKIP_RELEASE_CHECK === 'true';
const QUICK_PUSH = process.env.QUICK_PUSH !== 'false'; // 기본값: true
const SKIP_TESTS = process.env.SKIP_TESTS === 'true';
const SKIP_BUILD = process.env.SKIP_BUILD === 'true';
const SKIP_NODE_CHECK = process.env.SKIP_NODE_CHECK === 'true';
const STRICT_PUSH_ENV = process.env.STRICT_PUSH_ENV === 'true';
const FORCE_CLOUD_BUILD_GUARD = process.env.FORCE_CLOUD_BUILD_GUARD === 'true';
const PRE_PUSH_CHANGED_FILES_OVERRIDE = process.env.PRE_PUSH_CHANGED_FILES || '';

// Windows = limited validation mode (TypeScript + Lint only)
const isLimitedMode = isWindows;

let testStatus = 'pending';
let typeCheckStatus = 'pending';
let validationMode = 'standard';
let selectedTestMode = 'quick';

const DOM_TEST_MANIFEST = loadDomTestManifest(cwd);

// ─── Process runners ──────────────────────────────────────────────────────

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    cwd: options.cwd || cwd,
    shell: options.shell ?? isWindows,
    env: options.env || process.env,
  });
  return result.status === 0;
}

function runNpm(args, envOverrides = null, runCwd = cwd) {
  return runCommand(npmCmd, args, { cwd: runCwd, env: envOverrides || process.env });
}

function runNpx(args, runCwd = cwd, envOverrides = null) {
  return runCommand(npxCmd, args, { cwd: runCwd, env: envOverrides || process.env });
}

function runGit(args) {
  try {
    const result = spawnSync(gitCmd, args, { encoding: 'utf8', stdio: 'pipe', cwd });
    return result.stdout ? result.stdout.trim() : '';
  } catch {
    return '';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseChangedFiles(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isZeroOid(oid) {
  return /^0+$/.test(oid);
}

function parsePrePushUpdateLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const [localRef, localOid, remoteRef, remoteOid] = parts;
  return { localRef, localOid, remoteRef, remoteOid };
}

function readPrePushUpdatesFromStdin() {
  if (process.stdin.isTTY) return [];
  try {
    const rawInput = fs.readFileSync(0, 'utf8');
    if (!rawInput.trim()) return [];
    return rawInput
      .split('\n')
      .map((line) => parsePrePushUpdateLine(line))
      .filter(Boolean);
  } catch (error) {
    console.warn('⚠️  Failed to read pre-push stdin updates:', error);
    return [];
  }
}

function resolveDefaultBaseRef() {
  const branchName = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return resolveDefaultBaseRefFromGit(runGit, branchName);
}

function resolveCommitRef(refOrOid) {
  if (!refOrOid) return '';
  return (
    runGit(['rev-parse', '--verify', `${refOrOid}^{commit}`]) ||
    runGit(['rev-parse', '--verify', refOrOid])
  );
}

function collectChangedFilesFromPrePushUpdates(updates) {
  return collectChangedFilesFromUpdates({
    updates,
    resolveCommitRef,
    resolveDefaultBaseRef,
    runGit,
    parseChangedFiles,
    isZeroOid,
  });
}

function getChangedFilesForPush() {
  const prePushUpdates = readPrePushUpdatesFromStdin();
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const defaultBaseRef = resolveDefaultBaseRef();
  const prePushFiles =
    prePushUpdates.length > 0
      ? collectChangedFilesFromPrePushUpdates(prePushUpdates)
      : [];

  const result = determineChangedFilesForPush({
    overrideText: PRE_PUSH_CHANGED_FILES_OVERRIDE,
    prePushUpdates: prePushFiles,
    upstream,
    defaultBaseRef,
    runGit,
    parseChangedFiles,
  });

  if (!result.isKnown) {
    console.warn(
      '⚠️  Could not determine changed files (git commands failed). Running guard in fail-closed mode.'
    );
  }

  return result;
}

// ─── Docs-only path ──────────────────────────────────────────────────────

function runDocsArtifactValidation(changedFilesResult) {
  validationMode = 'docs-artifacts';
  testStatus = 'skipped-docs-only';
  typeCheckStatus = 'skipped-docs-only';

  console.log('📝 Docs/report-only push detected');
  console.log('   Skipping test:quick and type-check');

  const hasMarkdown = changedFilesResult.files.some((filePath) => filePath.endsWith('.md'));
  if (hasMarkdown) {
    const success = runNpm(['run', 'docs:lint:changed']);
    if (!success) {
      console.log('❌ Markdown docs lint failed - push blocked');
      console.log('');
      console.log('💡 Fix: npm run docs:lint:changed');
      return { ok: false, reason: 'markdown-lint-failed' };
    }
  } else {
    console.log('⚪ Markdown docs lint skipped (no changed markdown files)');
  }

  const jsonValidation = validateChangedJsonArtifacts(changedFilesResult.files, cwd);
  if (!jsonValidation.ok) {
    if (jsonValidation.reason === 'missing-json-artifact') {
      console.log(`❌ JSON artifact missing: ${jsonValidation.file}`);
      console.log('');
      console.log('💡 Fix: restore or remove the stale JSON path from the push range');
      return { ok: false, reason: 'missing-json-artifact', file: jsonValidation.file };
    }

    if (jsonValidation.reason === 'invalid-json-artifact') {
      console.log(`❌ Invalid JSON artifact: ${jsonValidation.file}`);
      console.log(`   ${jsonValidation.message}`);
      return {
        ok: false,
        reason: 'invalid-json-artifact',
        file: jsonValidation.file,
        message: jsonValidation.message,
      };
    }
  }

  if (jsonValidation.skipped) {
    console.log('⚪ JSON artifact validation skipped (no changed JSON files)');
    return { ok: true };
  }

  console.log(
    `✅ JSON artifact validation passed (${jsonValidation.jsonFiles.length} files)`
  );
  return { ok: true };
}

function exitIfGuardFailed(result) {
  if (result?.ok === false) {
    process.exit(1);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────

function runTests(changedFilesResult) {
  const plan = analyzeTestExecutionPlan({
    changedFilesResult,
    isLimitedMode,
    skipTests: SKIP_TESTS,
    isKnownNoOpPush,
    domTestManifest: DOM_TEST_MANIFEST,
    isWSL,
    isWindowsFS,
    cloudRunCwd,
  });

  selectedTestMode = plan.selectedTestMode;

  if (plan.kind === 'skip') {
    testStatus = plan.testStatus;

    if (plan.reason === 'windows-limited') {
      console.log('⚪ Tests skipped (Windows Limited Mode)');
      console.log('   → Full validation runs in WSL environment');
      return;
    }

    if (plan.reason === 'skip-tests-env') {
      console.log('⚪ Tests skipped (SKIP_TESTS=true)');
      console.log('⚠️  WARNING: Skipping tests may allow regressions');
      return;
    }

    if (plan.reason === 'known-no-op-push') {
      console.log('⚪ Tests skipped (known no-op push)');
      return;
    }
  }

  if (plan.targetedRun) {
    console.log(`🧪 Running ${plan.selectedTestMode} checks...`);
  } else {
    console.log('🧪 Running quick tests...');
  }

  const result = executeTestExecutionPlan(plan, { cwd, runNpm, runNpx });

  if (result.ok) {
    testStatus = result.testStatus;
    return;
  }

  testStatus = result.testStatus;
  console.log('❌ Tests failed - push blocked');
  console.log('');
  for (const guidance of result.guidance) {
    console.log(`💡 Fix: ${guidance}`);
  }
  console.log('');
  console.log('⚠️  Bypass options:');
  console.log('   • SKIP_TESTS=true git push   (Skip tests only)');
  console.log('   • HUSKY=0 git push           (Skip all hooks)');
  process.exit(1);
}

// ─── Build validation ────────────────────────────────────────────────────

function runBuildValidation(changedFilesResult) {
  console.log('🏗️ Build validation...');

  const buildValidation = analyzeBuildValidation({
    changedFilesResult,
    skipBuild: SKIP_BUILD,
    isLimitedMode,
    quickPush: QUICK_PUSH,
    isKnownNoOpPush,
    filterTypeCheckRelevantFiles,
    isCloudRunTypeCheckRelevantFile,
  });

  if (buildValidation.mode === 'skip-build') {
    typeCheckStatus = 'skipped';
    console.log('⚪ Build validation skipped (SKIP_BUILD=true)');
    return;
  }

  if (buildValidation.mode === 'known-no-op') {
    typeCheckStatus = 'skipped-no-op-push';
    console.log('⚪ TypeScript 검증 스킵 (known no-op push)');
    console.log('ℹ️  Full build/type-check는 필요 시 local Docker CI와 Vercel에서 계속 검증됨');
    return;
  }

  if (buildValidation.mode === 'windows-limited') {
    console.log('🔧 Windows Limited Mode: TypeScript only...');
    console.log('   → Lint already done in pre-commit');
    console.log('');
    console.log('📝 TypeScript checking...');
    const tsSuccess = runNpm(['run', 'type-check']);
    if (!tsSuccess) {
      typeCheckStatus = 'failed';
      console.log('❌ TypeScript check failed - push blocked');
      console.log('');
      console.log('💡 Fix: npm run type-check');
      console.log('');
      console.log('⚠️  Bypass: HUSKY=0 git push');
      process.exit(1);
    }
    typeCheckStatus = 'passed';
    console.log('⚪ Lint skipped (already run in pre-commit)');
    console.log('✅ Windows Limited Mode validation passed');
    return;
  }

  if (buildValidation.mode === 'quick') {
    if (buildValidation.shouldSkipAll) {
      typeCheckStatus = 'skipped-no-relevant-ts';
      console.log('⚪ TypeScript 검증 스킵 (push 범위에 관련 TS 파일 없음)');
      console.log(
        'ℹ️  Full build/type-check는 필요 시 local Docker CI와 Vercel에서 계속 검증됨'
      );
      return;
    }

    if (!buildValidation.skipRootTypeCheck) {
      console.log(
        buildValidation.useChangedTypeCheck
          ? '⚡ Root TypeScript 증분 검증 (변경 범위)...'
          : '⚡ Root TypeScript 검증 (기본 모드)...'
      );

      // 변경 감지 성공/실패 모두 type-check:changed + soft-timeout 사용
      const changedTypeCheckStatus = createTypeCheckStatusFile();
      const extraEnv = {
        ...process.env,
        ...(buildValidation.useChangedTypeCheck
          ? {
              PRE_PUSH_CHANGED_FILES:
                buildValidation.rootTypeCheckRelevantFiles.join('\n'),
            }
          : {}),
        TYPECHECK_CHANGED_SOFT_TIMEOUT: 'true',
        TYPECHECK_CHANGED_TIMEOUT_SECONDS:
          process.env.TYPECHECK_CHANGED_TIMEOUT_SECONDS || '60',
        TYPECHECK_CHANGED_STATUS_FILE: changedTypeCheckStatus.filePath,
      };

      const rootSuccess = runNpm(['run', 'type-check:changed'], extraEnv);
      const changedStatus = readTypeCheckStatus(changedTypeCheckStatus.filePath);
      cleanupTypeCheckStatus(changedTypeCheckStatus?.tempDir);

      if (!rootSuccess) {
        typeCheckStatus = 'failed';
        console.log('❌ Root TypeScript 에러 - push blocked');
        console.log('');
        console.log('💡 Fix: npm run type-check:changed');
        console.log('');
        console.log('⚠️  Bypass: HUSKY=0 git push');
        process.exit(1);
      }

      if (changedStatus === 'soft-timeout') {
        typeCheckStatus = 'delegated-soft-timeout';
        console.log(
          '⚪ Root TypeScript 증분 검증 soft-timeout, local Docker CI/Vercel 전체 타입체크로 위임'
        );
      } else {
        console.log('✅ Root TypeScript 검증 통과');
      }
    }

    if (!buildValidation.skipCloudRunTypeCheck) {
      console.log('⚡ Cloud Run TypeScript 검증...');
      const cloudRunSuccess = runNpm(['run', 'type-check'], null, cloudRunCwd);
      if (!cloudRunSuccess) {
        typeCheckStatus = 'failed';
        console.log('❌ Cloud Run TypeScript 에러 - push blocked');
        console.log('');
        console.log('💡 Fix: cd cloud-run/ai-engine && npm run type-check');
        console.log('');
        console.log('⚠️  Bypass: HUSKY=0 git push');
        process.exit(1);
      }
      console.log('✅ Cloud Run TypeScript 검증 통과');
    }

    if (typeCheckStatus !== 'delegated-soft-timeout') {
      typeCheckStatus = 'passed';
    }
    console.log('ℹ️  Full build는 필요 시 local Docker CI와 Vercel에서 실행됨');
  } else {
    typeCheckStatus = 'delegated';
    console.log('🐢 Full Build 검증 (QUICK_PUSH=false)...');
    console.log('   일반적으로 불필요 - Vercel이 빌드 담당');
    const success = runNpm(['run', 'build']);
    if (!success) {
      console.log('❌ Build failed - push blocked');
      console.log('');
      console.log('💡 Fix: npm run build');
      console.log('');
      console.log('⚠️  Bypass: HUSKY=0 git push');
      process.exit(1);
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────

function printSummary(duration) {
  console.log('');
  console.log(`✅ Pre-push validation passed in ${duration}s`);
  console.log('🚀 Ready to push!');
  console.log('');
  console.log('📊 Summary:');
  if (validationMode === 'docs-artifacts') {
    console.log('  📝 Mode: Docs/Reports artifacts only');
  } else if (isLimitedMode) {
    console.log('  🔧 Mode: Windows Limited');
  } else if (QUICK_PUSH) {
    console.log('  ⚡ Mode: Quick (TypeScript only)');
  } else {
    console.log('  🐢 Mode: Full Build');
  }
  if (testStatus === 'passed') {
    if (selectedTestMode !== 'quick') {
      console.log(`  ✅ Tests passed (${selectedTestMode})`);
    } else {
      console.log('  ✅ Tests passed');
    }
  } else if (testStatus === 'skipped-docs-only') {
    console.log('  ⚪ Tests skipped (docs/report-only push)');
  } else if (testStatus === 'skipped-no-op-push') {
    console.log('  ⚪ Tests skipped (known no-op push)');
  } else {
    console.log(`  ⚪ Tests ${testStatus}`);
  }
  if (typeCheckStatus === 'passed') {
    console.log('  ✅ TypeScript check passed');
  } else if (typeCheckStatus === 'delegated-soft-timeout') {
    console.log('  ⚪ TypeScript delegated after soft-timeout (local Docker CI/Vercel)');
  } else if (typeCheckStatus === 'skipped-docs-only') {
    console.log('  ⚪ TypeScript skipped (docs/report-only push)');
  } else if (typeCheckStatus === 'skipped-no-relevant-ts') {
    console.log('  ⚪ TypeScript skipped (no relevant TS files in push range)');
  } else if (typeCheckStatus === 'skipped-no-op-push') {
    console.log('  ⚪ TypeScript skipped (known no-op push)');
  } else if (typeCheckStatus === 'skipped') {
    console.log('  ⚪ TypeScript skipped (SKIP_BUILD=true)');
  } else if (typeCheckStatus === 'delegated') {
    console.log('  ⚪ TypeScript covered by full build');
  }
  if (!QUICK_PUSH && !isLimitedMode) {
    console.log('  ✅ Full build passed');
  } else {
    console.log('  ⚪ Full build → local Docker CI / Vercel');
  }
  if (STRICT_PUSH_ENV) {
    console.log('  ✅ Environment validated');
  } else {
    console.log('  ⚪ Environment check skipped (set STRICT_PUSH_ENV=true)');
  }
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────

function main() {
  const startTime = Date.now();

  console.log('🔍 Pre-push validation starting...');

  if (isLimitedMode) {
    console.log('');
    console.log('🔧 Windows Limited Mode detected');
    console.log('   Running: TypeScript only');
    console.log('   Skipped: Lint (pre-commit), Tests, Full build');
    console.log('');
  }

  checkRelease(runGit, SKIP_RELEASE_CHECK);
  if (!isLimitedMode) {
    checkWSLPerformance(isWSL, isWindowsFS);
  }

  exitIfGuardFailed(
    checkNodeModules(cwd, SKIP_NODE_CHECK, isWSL, isWindows, isWindowsFS)
  );

  const changedFilesResult = getChangedFilesForPush();
  exitIfGuardFailed(
    checkCloudBuildFreeTierGuard(changedFilesResult, cwd, FORCE_CLOUD_BUILD_GUARD)
  );

  if (isDocsArtifactOnlyPush(changedFilesResult)) {
    exitIfGuardFailed(runDocsArtifactValidation(changedFilesResult));
  } else {
    runTests(changedFilesResult);
    runBuildValidation(changedFilesResult);
    if (STRICT_PUSH_ENV) {
      exitIfGuardFailed(checkEnvironment(cwd, runNpm));
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  printSummary(duration);
}

main();
