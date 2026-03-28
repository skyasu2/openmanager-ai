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
  CLOUD_RUN_ROOT,
  loadDomTestManifest,
  normalizeFilePath,
  isCloudRunTypeCheckRelevantFile,
} = require('./pre-push-file-classifier');
const { classifyChangedTestRun } = require('./pre-push-test-classifier');
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

function createTypeCheckStatusFile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmanager-typecheck-'));
  return { tempDir, filePath: path.join(tempDir, 'status.txt') };
}

function readTypeCheckStatus(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function cleanupTypeCheckStatus(tempDir) {
  if (!tempDir) return;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore temp cleanup failures in git hook path
  }
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

function isLightweightArtifactFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (!normalized) return false;
  if (normalized.endsWith('.md')) return true;
  if (normalized.endsWith('.json')) {
    return normalized.startsWith('docs/') || normalized.startsWith('reports/');
  }
  return false;
}

function isDocsArtifactOnlyPush(changedFilesResult) {
  if (!changedFilesResult.isKnown || changedFilesResult.files.length === 0) return false;
  return changedFilesResult.files.every((filePath) => isLightweightArtifactFile(filePath));
}

function validateChangedJsonArtifacts(changedFiles) {
  const jsonFiles = changedFiles.filter((filePath) => filePath.endsWith('.json'));
  if (jsonFiles.length === 0) {
    console.log('⚪ JSON artifact validation skipped (no changed JSON files)');
    return;
  }
  for (const relativePath of jsonFiles) {
    const absolutePath = path.join(cwd, relativePath);
    if (!fs.existsSync(absolutePath)) {
      console.log(`❌ JSON artifact missing: ${relativePath}`);
      console.log('');
      console.log('💡 Fix: restore or remove the stale JSON path from the push range');
      process.exit(1);
    }
    try {
      JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    } catch (error) {
      console.log(`❌ Invalid JSON artifact: ${relativePath}`);
      console.log(`   ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✅ JSON artifact validation passed (${jsonFiles.length} files)`);
}

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
      process.exit(1);
    }
  } else {
    console.log('⚪ Markdown docs lint skipped (no changed markdown files)');
  }

  validateChangedJsonArtifacts(changedFilesResult.files);
}

function exitIfGuardFailed(result) {
  if (result?.ok === false) {
    process.exit(1);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────

function runTests(changedFilesResult) {
  selectedTestMode = 'quick';

  if (isLimitedMode) {
    testStatus = 'skipped';
    console.log('⚪ Tests skipped (Windows Limited Mode)');
    console.log('   → Full validation runs in WSL environment');
    return;
  }

  if (SKIP_TESTS) {
    testStatus = 'skipped';
    console.log('⚪ Tests skipped (SKIP_TESTS=true)');
    console.log('⚠️  WARNING: Skipping tests may allow regressions');
    return;
  }

  if (isKnownNoOpPush(changedFilesResult)) {
    testStatus = 'skipped-no-op-push';
    console.log('⚪ Tests skipped (known no-op push)');
    return;
  }

  const targetedRun = classifyChangedTestRun(
    changedFilesResult,
    DOM_TEST_MANIFEST,
    isWSL,
    isWindowsFS,
    cloudRunCwd
  );
  let steps = [{ label: 'Quick smoke', args: ['run', 'test:super-fast'] }];

  if (targetedRun) {
    selectedTestMode = targetedRun.mode;
    steps = targetedRun.steps;
    console.log(`🧪 Running ${targetedRun.mode} checks...`);
  } else {
    console.log('🧪 Running quick tests...');
  }

  const success = steps.every(({ args, label, runner, cwd: stepCwd }) => {
    if (label) console.log(`   → ${label}`);
    const runCwd = stepCwd || cwd;
    return runner === 'npx' ? runNpx(args, runCwd) : runNpm(args, null, runCwd);
  });

  if (success) {
    testStatus = 'passed';
  } else {
    testStatus = 'failed';
    console.log('❌ Tests failed - push blocked');
    console.log('');
    if (targetedRun?.guidance?.length) {
      for (const guidance of targetedRun.guidance) {
        console.log(`💡 Fix: ${guidance}`);
      }
    } else {
      console.log('💡 Fix: npm run test:super-fast');
    }
    console.log('');
    console.log('⚠️  Bypass options:');
    console.log('   • SKIP_TESTS=true git push   (Skip tests only)');
    console.log('   • HUSKY=0 git push           (Skip all hooks)');
    process.exit(1);
  }
}

// ─── Build validation ────────────────────────────────────────────────────

function runBuildValidation(changedFilesResult) {
  console.log('🏗️ Build validation...');

  if (SKIP_BUILD) {
    typeCheckStatus = 'skipped';
    console.log('⚪ Build validation skipped (SKIP_BUILD=true)');
    return;
  }

  if (isKnownNoOpPush(changedFilesResult)) {
    typeCheckStatus = 'skipped-no-op-push';
    console.log('⚪ TypeScript 검증 스킵 (known no-op push)');
    console.log('ℹ️  Full build/type-check는 필요 시 local Docker CI와 Vercel에서 계속 검증됨');
    return;
  }

  if (isLimitedMode) {
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

  if (QUICK_PUSH) {
    const rootTypeCheckRelevantFiles = filterTypeCheckRelevantFiles(
      changedFilesResult.files
    );
    const cloudRunTypeCheckRelevantFiles = changedFilesResult.files.filter((f) =>
      isCloudRunTypeCheckRelevantFile(f)
    );
    const skipRootTypeCheck =
      changedFilesResult.isKnown &&
      changedFilesResult.files.length > 0 &&
      rootTypeCheckRelevantFiles.length === 0;
    const skipCloudRunTypeCheck =
      changedFilesResult.isKnown &&
      changedFilesResult.files.length > 0 &&
      cloudRunTypeCheckRelevantFiles.length === 0;
    const useChangedTypeCheck =
      changedFilesResult.isKnown && rootTypeCheckRelevantFiles.length > 0;

    if (skipRootTypeCheck && skipCloudRunTypeCheck) {
      typeCheckStatus = 'skipped-no-relevant-ts';
      console.log('⚪ TypeScript 검증 스킵 (push 범위에 관련 TS 파일 없음)');
      console.log(
        'ℹ️  Full build/type-check는 필요 시 local Docker CI와 Vercel에서 계속 검증됨'
      );
      return;
    }

    if (!skipRootTypeCheck) {
      console.log(
        useChangedTypeCheck
          ? '⚡ Root TypeScript 증분 검증 (변경 범위)...'
          : '⚡ Root TypeScript 검증 (기본 모드)...'
      );

      // 변경 감지 성공/실패 모두 type-check:changed + soft-timeout 사용
      const changedTypeCheckStatus = createTypeCheckStatusFile();
      const extraEnv = {
        ...process.env,
        ...(useChangedTypeCheck
          ? { PRE_PUSH_CHANGED_FILES: rootTypeCheckRelevantFiles.join('\n') }
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

    if (!skipCloudRunTypeCheck) {
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

  if (!checkNodeModules(cwd, SKIP_NODE_CHECK, isWSL, isWindows, isWindowsFS)) {
    console.log('❌ node_modules check failed - push blocked');
    console.log('');
    console.log('💡 Quick bypass: HUSKY=0 git push');
    process.exit(1);
  }

  const changedFilesResult = getChangedFilesForPush();
  exitIfGuardFailed(
    checkCloudBuildFreeTierGuard(changedFilesResult, cwd, FORCE_CLOUD_BUILD_GUARD)
  );

  if (isDocsArtifactOnlyPush(changedFilesResult)) {
    runDocsArtifactValidation(changedFilesResult);
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
