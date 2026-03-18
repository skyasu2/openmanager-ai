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
const isWSL = !isWindows && fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
const { filterTypeCheckRelevantFiles } = require('../dev/typecheck-scope');
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const gitCmd = isWindows ? 'git.exe' : 'git';
const cwd = process.cwd();
const isWindowsFS = cwd.startsWith('/mnt/');

// Environment flags
// 🎯 2025 Best Practice: Pre-push는 빠르게, Full Build는 CI/Vercel에서
// - QUICK_PUSH=true (기본): TypeScript만 (~20초)
// - QUICK_PUSH=false: Full Build (~3분, 릴리스 전 검증용)
// - STRICT_PUSH_ENV=true: env:check를 pre-push에서 강제
// - FORCE_CLOUD_BUILD_GUARD=true: Cloud Build 가드를 항상 실행
const SKIP_RELEASE_CHECK = process.env.SKIP_RELEASE_CHECK === 'true';
const QUICK_PUSH = process.env.QUICK_PUSH !== 'false'; // 기본값: true (빠른 푸시)
const SKIP_TESTS = process.env.SKIP_TESTS === 'true';
const SKIP_BUILD = process.env.SKIP_BUILD === 'true';
const SKIP_NODE_CHECK = process.env.SKIP_NODE_CHECK === 'true';
const STRICT_PUSH_ENV = process.env.STRICT_PUSH_ENV === 'true'; // 기본값: false (env 검증은 CI/Vercel에서 수행, 로컬은 opt-in)
const FORCE_CLOUD_BUILD_GUARD = process.env.FORCE_CLOUD_BUILD_GUARD === 'true';
const PRE_PUSH_CHANGED_FILES_OVERRIDE = process.env.PRE_PUSH_CHANGED_FILES || '';

// Windows = limited validation mode (TypeScript + Lint only)
// WSL with Linux node_modules = full validation mode
const isLimitedMode = isWindows;

let testStatus = 'pending';
let typeCheckStatus = 'pending';
let validationMode = 'standard';
let selectedTestMode = 'quick';
const DOM_INFRA_SMOKE_SENTINEL = 'src/test/setup.ts';

const DOM_TEST_INFRA_PREFIXES = [
  'config/testing/',
];

const DOM_TEST_INFRA_EXACT = new Set([
  'package.json',
  'scripts/dev/vitest-main-wrapper.js',
  DOM_INFRA_SMOKE_SENTINEL,
]);

const HOOK_TEST_INFRA_EXACT = new Set([
  'scripts/hooks/pre-push.js',
]);

const FRONTEND_SMOKE_PREFIXES = [
  'src/components/ai/',
  'src/components/ai-sidebar/',
  'src/app/dashboard/ai-assistant/',
];

const FRONTEND_SMOKE_EXACT = new Set([
  'src/app/dashboard/DashboardClient.tsx',
  'src/app/dashboard/dashboard-client-helpers.tsx',
  'src/components/dashboard/AIAssistantButton.tsx',
  'src/components/dashboard/AIAssistantButton.test.tsx',
]);

function loadDomTestManifest() {
  const manifestPath = path.join(cwd, 'config/testing/dom-test-manifest.json');

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const pathPrefixes = Array.isArray(parsed.pathPrefixes)
      ? parsed.pathPrefixes.map((entry) => normalizeFilePath(entry))
      : [];
    const exactFiles = Array.isArray(parsed.exactFiles)
      ? parsed.exactFiles.map((entry) => normalizeFilePath(entry))
      : [];

    return {
      pathPrefixes,
      exactFiles: new Set(exactFiles),
    };
  } catch (error) {
    console.warn(
      '⚠️  Failed to load DOM test manifest, falling back to quick tests:',
      error.message
    );
    return {
      pathPrefixes: [],
      exactFiles: new Set(),
    };
  }
}

const DOM_TEST_MANIFEST = loadDomTestManifest();

function runNpm(args, envOverrides = null) {
  const result = spawnSync(npmCmd, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    cwd,
    shell: isWindows,
    env: envOverrides || process.env,
  });
  return result.status === 0;
}

function runGit(args) {
  try {
    const result = spawnSync(gitCmd, args, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd,
    });
    return result.stdout ? result.stdout.trim() : '';
  } catch {
    return '';
  }
}

function stripHashComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function parseChangedFiles(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeFilePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isVitestTestFile(filePath) {
  return /\.(test|spec)\.(js|ts|tsx)$/u.test(normalizeFilePath(filePath));
}

function isJavaScriptSourceFile(filePath) {
  return /\.(js|jsx|ts|tsx)$/u.test(normalizeFilePath(filePath));
}

function isDomTestFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!isVitestTestFile(normalized)) return false;
  if (DOM_TEST_MANIFEST.exactFiles.has(normalized)) return true;
  return DOM_TEST_MANIFEST.pathPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function isRelatedSourceFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith('src/')) return false;
  if (!isJavaScriptSourceFile(normalized)) return false;
  return !isVitestTestFile(normalized);
}

function isDomTestInfraFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (DOM_TEST_INFRA_EXACT.has(normalized)) return true;
  return DOM_TEST_INFRA_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isHookTestInfraFile(filePath) {
  return HOOK_TEST_INFRA_EXACT.has(normalizeFilePath(filePath));
}

function isFrontendSmokeFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (FRONTEND_SMOKE_EXACT.has(normalized)) return true;
  return FRONTEND_SMOKE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isAIWorkspaceQuickFile(filePath) {
  return isFrontendSmokeFile(filePath);
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
  const remoteHead = runGit([
    'symbolic-ref',
    '--quiet',
    'refs/remotes/origin/HEAD',
  ]);
  if (remoteHead) {
    const normalized = remoteHead.replace(/^refs\/remotes\//, '');
    if (normalized) return normalized;
  }

  const candidates = ['origin/main', 'origin/master', 'main', 'master'];
  for (const candidate of candidates) {
    const exists = runGit(['rev-parse', '--verify', candidate]);
    if (exists) return candidate;
  }

  return '';
}

function resolveCommitRef(refOrOid) {
  if (!refOrOid) return '';
  return (
    runGit(['rev-parse', '--verify', `${refOrOid}^{commit}`]) ||
    runGit(['rev-parse', '--verify', refOrOid])
  );
}

function collectChangedFilesFromPrePushUpdates(updates) {
  const changedFiles = new Set();

  for (const update of updates) {
    const { localRef, localOid, remoteOid } = update;

    // delete push, tag push는 Cloud Build 가드 대상이 아님
    if (
      localRef === '(delete)' ||
      isZeroOid(localOid) ||
      localRef.startsWith('refs/tags/')
    ) {
      continue;
    }

    const localCommit = resolveCommitRef(localOid);
    if (!localCommit) continue;

    let baseCommit = '';
    if (!isZeroOid(remoteOid)) {
      baseCommit = resolveCommitRef(remoteOid);
    } else {
      // 신규 원격 ref 생성 시 기본 브랜치와 merge-base를 기준으로 계산
      const defaultBaseRef = resolveDefaultBaseRef();
      if (defaultBaseRef) {
        baseCommit = runGit(['merge-base', localCommit, defaultBaseRef]);
        if (!baseCommit) {
          baseCommit = resolveCommitRef(defaultBaseRef);
        }
      }
    }

    let diffOutput = '';
    if (baseCommit) {
      diffOutput = runGit(['diff', '--name-only', `${baseCommit}..${localCommit}`]);
    }
    if (!diffOutput) {
      diffOutput = runGit([
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        localCommit,
      ]);
    }

    for (const file of parseChangedFiles(diffOutput)) {
      changedFiles.add(file);
    }
  }

  return Array.from(changedFiles);
}

function getChangedFilesForPush() {
  if (PRE_PUSH_CHANGED_FILES_OVERRIDE.trim()) {
    const files = PRE_PUSH_CHANGED_FILES_OVERRIDE
      .split(/[,\n]/)
      .map((file) => file.trim())
      .filter(Boolean);
    return { files, isKnown: files.length > 0 };
  }

  const prePushUpdates = readPrePushUpdatesFromStdin();
  if (prePushUpdates.length > 0) {
    const filesFromUpdates = collectChangedFilesFromPrePushUpdates(prePushUpdates);
    return { files: filesFromUpdates, isKnown: true };
  }

  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream) {
    const pushedFiles = runGit(['diff', '--name-only', `${upstream}..HEAD`]);
    if (pushedFiles) {
      return { files: parseChangedFiles(pushedFiles), isKnown: true };
    }
  }

  // Upstream이 없을 때(첫 push 등) 원격 기본 브랜치와의 merge-base 기준으로 범위 계산
  const defaultBaseRef = resolveDefaultBaseRef();
  if (defaultBaseRef) {
    const mergeBase = runGit(['merge-base', 'HEAD', defaultBaseRef]);
    if (mergeBase) {
      const branchFiles = runGit(['diff', '--name-only', `${mergeBase}..HEAD`]);
      if (branchFiles) {
        return { files: parseChangedFiles(branchFiles), isKnown: true };
      }
    }

    const baseDiffFiles = runGit(['diff', '--name-only', `${defaultBaseRef}..HEAD`]);
    if (baseDiffFiles) {
      return { files: parseChangedFiles(baseDiffFiles), isKnown: true };
    }
  }

  // 마지막 fallback: 최근 커밋 기준 최소 범위 검사
  const hasPreviousCommit = runGit(['rev-parse', '--verify', 'HEAD~1']);
  if (hasPreviousCommit) {
    const recentFiles = runGit(['diff', '--name-only', 'HEAD~1..HEAD']);
    if (recentFiles) {
      return { files: parseChangedFiles(recentFiles), isKnown: true };
    }
  }

  console.warn(
    '⚠️  Could not determine changed files (git commands failed). Running guard in fail-closed mode.'
  );
  return { files: [], isKnown: false };
}

function checkCloudBuildFreeTierGuard(changedFilesResult) {
  const changedFiles = changedFilesResult.files;
  const watchedFiles = [
    'cloud-run/ai-engine/cloudbuild.yaml',
    'cloud-run/ai-engine/deploy.sh',
  ];
  const hasChangedFiles = changedFiles.length > 0;
  const hasRelevantChanges = changedFiles.some((file) => watchedFiles.includes(file));

  if (!hasRelevantChanges && !FORCE_CLOUD_BUILD_GUARD) {
    if (hasChangedFiles || changedFilesResult.isKnown) {
      console.log('⚪ Cloud Build guard skipped (ai-engine deploy files unchanged)');
      return;
    }
    console.warn(
      '⚠️  Cloud Build guard running in fail-closed mode (changed files unknown)'
    );
  }

  const cloudbuildPath = path.join(cwd, 'cloud-run/ai-engine/cloudbuild.yaml');
  const deployPath = path.join(cwd, 'cloud-run/ai-engine/deploy.sh');

  if (!fs.existsSync(cloudbuildPath) || !fs.existsSync(deployPath)) {
    return;
  }

  console.log('🛡️ Cloud Build free-tier guard check...');

  const cloudbuildRaw = fs.readFileSync(cloudbuildPath, 'utf8');
  const cloudbuildBody = stripHashComments(cloudbuildRaw);
  const deployRaw = fs.readFileSync(deployPath, 'utf8');
  const failures = [];

  if (/\bmachineType\b/.test(cloudbuildBody)) {
    failures.push('cloud-run/ai-engine/cloudbuild.yaml contains machineType in active config');
  }

  if (/\b(E2_HIGHCPU_8|N1_HIGHCPU_8|e2-highcpu-8|n1-highcpu-8)\b/.test(cloudbuildBody)) {
    failures.push('cloud-run/ai-engine/cloudbuild.yaml contains highcpu machine type in active config');
  }

  if (!deployRaw.includes('assert_no_forbidden_args "${BUILD_CMD[@]}"')) {
    failures.push('cloud-run/ai-engine/deploy.sh missing BUILD_CMD forbidden-arg guard');
  }

  if (!deployRaw.includes('assert_no_forbidden_args "${DEPLOY_CMD[@]}"')) {
    failures.push('cloud-run/ai-engine/deploy.sh missing DEPLOY_CMD forbidden-arg guard');
  }

  if (!deployRaw.includes('enforce_free_tier_guards')) {
    failures.push('cloud-run/ai-engine/deploy.sh missing free-tier guard enforcement');
  }

  if (failures.length > 0) {
    console.log('❌ Free-tier guard check failed - push blocked');
    for (const failure of failures) {
      console.log(`   - ${failure}`);
    }
    console.log('');
    console.log('💡 Fix: restore free-tier guardrails in cloudbuild/deploy scripts');
    console.log('⚠️  Bypass: HUSKY=0 git push');
    process.exit(1);
  }
}

// node_modules health check
function checkNodeModules() {
  if (SKIP_NODE_CHECK) {
    console.log('⚪ node_modules check skipped (SKIP_NODE_CHECK=true)');
    return true;
  }

  const criticalPackages = [
    'node_modules/typescript',
    'node_modules/react',
    'node_modules/@types/react',
    'node_modules/@types/node',
    'node_modules/next',
  ];

  const missing = criticalPackages.filter(pkg => !fs.existsSync(path.join(cwd, pkg)));

  if (missing.length > 0) {
    console.log('');
    console.log('⚠️  node_modules appears to be corrupted or incomplete');
    console.log('   Missing packages:', missing.map(p => p.replace('node_modules/', '')).join(', '));
    console.log('');
    console.log('💡 Fix options:');
    console.log('   1. Run: rm -rf node_modules package-lock.json && npm install');
    console.log('   2. Bypass: HUSKY=0 git push');
    console.log('');
    return false;
  }

  // Check for platform mismatch (WSL using Windows node_modules)
  if (isWSL && isWindowsFS) {
    const rollupPath = path.join(cwd, 'node_modules/@rollup');
    if (fs.existsSync(rollupPath)) {
      const rollupContents = fs.readdirSync(rollupPath);
      const hasWin32 = rollupContents.some(f => f.includes('win32'));
      const hasLinux = rollupContents.some(f => f.includes('linux'));

      if (hasWin32 && !hasLinux) {
        // In WSL with Windows node_modules, this is a problem
        // But if running on Windows itself, this is expected
        if (isWindows) {
          // Windows with Windows binaries = OK
          return true;
        }
        console.log('');
        console.log('⚠️  node_modules was installed on Windows, not compatible with WSL');
        console.log('');
        console.log('💡 Options:');
        console.log('   1. Push from Windows: Use PowerShell/CMD to run git push');
        console.log('   2. Reinstall: rm -rf node_modules && npm install');
        console.log('   3. Bypass: HUSKY=0 git push');
        console.log('');
        return false;
      }
    }
  }

  return true;
}

// Release check
function checkRelease() {
  if (SKIP_RELEASE_CHECK) return;

  const lastTag = runGit(['describe', '--tags', '--abbrev=0']);
  if (!lastTag) return;

  const commitsSinceTag = runGit(['rev-list', `${lastTag}..HEAD`, '--count']);
  const count = parseInt(commitsSinceTag, 10) || 0;

  if (count > 20) {
    console.log('');
    console.log(`📦 Release Check: ${count} commits since ${lastTag}`);
    console.log('   Consider running: npm run release:patch (or :minor)');
    console.log('   Skip this check: SKIP_RELEASE_CHECK=true git push');
    console.log('');
  }
}

// WSL warning
function checkWSLPerformance() {
  if (isWSL && isWindowsFS) {
    console.log('');
    console.log('ℹ️  WSL + Windows filesystem detected');
    console.log('   기본: TypeScript 검증만 (~20초)');
    console.log('   Full Build 필요 시: QUICK_PUSH=false git push');
    console.log('');
  }
}

function isLightweightArtifactFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (!normalized) return false;

  if (normalized.endsWith('.md')) {
    return true;
  }

  if (normalized.endsWith('.json')) {
    return normalized.startsWith('docs/') || normalized.startsWith('reports/');
  }

  return false;
}

function isDocsArtifactOnlyPush(changedFilesResult) {
  if (!changedFilesResult.isKnown || changedFilesResult.files.length === 0) {
    return false;
  }

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

function classifyChangedTestRun(changedFilesResult) {
  if (!changedFilesResult?.isKnown || changedFilesResult.files.length === 0) {
    return null;
  }

  const normalizedFiles = changedFilesResult.files.map(normalizeFilePath);
  const frontendSmokeFiles = normalizedFiles.filter((filePath) =>
    isFrontendSmokeFile(filePath)
  );
  const consumeFrontendSmokeFiles = frontendSmokeFiles.length > 0 && isWSL && isWindowsFS;
  const frontendSmokeFileSet = new Set(
    consumeFrontendSmokeFiles ? frontendSmokeFiles : []
  );
  const afterFrontendSmokeFiles = normalizedFiles.filter(
    (filePath) => !frontendSmokeFileSet.has(filePath)
  );
  const aiWorkspaceQuickFiles = afterFrontendSmokeFiles.filter((filePath) =>
    isAIWorkspaceQuickFile(filePath)
  );
  const aiWorkspaceQuickFileSet = new Set(aiWorkspaceQuickFiles);
  const remainingFiles = afterFrontendSmokeFiles.filter(
    (filePath) => !aiWorkspaceQuickFileSet.has(filePath)
  );
  const testFiles = remainingFiles.filter((filePath) => isVitestTestFile(filePath));
  const relatedSourceFiles = remainingFiles.filter((filePath) =>
    isRelatedSourceFile(filePath)
  );
  const domInfraFiles = remainingFiles.filter((filePath) => isDomTestInfraFile(filePath));
  const hookInfraFiles = remainingFiles.filter((filePath) => isHookTestInfraFile(filePath));
  const steps = [];
  const summaryParts = [];
  const guidance = [];
  const scopeFiles = [];

  if (consumeFrontendSmokeFiles) {
    // Mounted WSL workspaces pay a very large jsdom startup cost for AI assistant
    // surface tests. Prefer the stable quick gate over targeted DOM smoke here.
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

  if (testFiles.length > 0) {
    const domTestFiles = testFiles.filter((filePath) => isDomTestFile(filePath));
    const nodeTestFiles = testFiles.filter((filePath) => !isDomTestFile(filePath));

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
  } else if (
    domInfraFiles.length > 0 &&
    !scopeFiles.includes(DOM_INFRA_SMOKE_SENTINEL)
  ) {
    steps.push({
      label: 'DOM infrastructure smoke',
      args: ['run', 'test:related:dom', '--', DOM_INFRA_SMOKE_SENTINEL],
    });
    summaryParts.push('DOM infra smoke');
    guidance.push(`npm run test:related:dom -- ${DOM_INFRA_SMOKE_SENTINEL}`);
    scopeFiles.push(...domInfraFiles);
  }

  if (
    hookInfraFiles.length > 0 &&
    steps.length === 0
  ) {
    steps.push({
      label: 'Quick smoke for hook infrastructure changes',
      args: ['run', 'test:quick'],
    });
    summaryParts.push('hook infra quick smoke');
    guidance.push('npm run test:quick');
    scopeFiles.push(...hookInfraFiles);
  }

  if (steps.length === 0) {
    return null;
  }

  return {
    mode: summaryParts.join(' + '),
    files: Array.from(new Set(scopeFiles)),
    steps,
    guidance: Array.from(new Set(guidance)),
  };
}

// Tests
function runTests(changedFilesResult) {
  selectedTestMode = 'quick';

  // Windows: skip tests (run full validation in WSL)
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

  const targetedRun = classifyChangedTestRun(changedFilesResult);
  let steps = [
    {
      label: 'Quick smoke',
      args: ['run', 'test:super-fast'],
    },
  ];

  if (targetedRun) {
    selectedTestMode = targetedRun.mode;
    steps = targetedRun.steps;
    console.log(`🧪 Running ${targetedRun.mode} checks...`);
  } else {
    console.log('🧪 Running quick tests...');
  }

  const success = steps.every(({ args, label }) => {
    if (label) {
      console.log(`   → ${label}`);
    }
    return runNpm(args);
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

// Build validation
function runBuildValidation(changedFilesResult) {
  console.log('🏗️ Build validation...');

  if (SKIP_BUILD) {
    typeCheckStatus = 'skipped';
    console.log('⚪ Build validation skipped (SKIP_BUILD=true)');
    return;
  }

  // Windows: TypeScript only (lint already done in pre-commit)
  if (isLimitedMode) {
    console.log('🔧 Windows Limited Mode: TypeScript only...');
    console.log('   → Lint already done in pre-commit');
    console.log('');

    // Run TypeScript check
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

    // Lint는 pre-commit에서 이미 실행되므로 스킵
    console.log('⚪ Lint skipped (already run in pre-commit)');

    console.log('✅ Windows Limited Mode validation passed');
    return;
  }

  if (QUICK_PUSH) {
    const typeCheckRelevantFiles = filterTypeCheckRelevantFiles(changedFilesResult.files);
    const skipTypeCheck =
      changedFilesResult.isKnown && changedFilesResult.files.length > 0 && typeCheckRelevantFiles.length === 0;
    const useChangedTypeCheck =
      changedFilesResult.isKnown && typeCheckRelevantFiles.length > 0;

    if (skipTypeCheck) {
      typeCheckStatus = 'skipped-no-relevant-ts';
      console.log('⚪ TypeScript 검증 스킵 (push 범위에 관련 TS 파일 없음)');
      console.log('ℹ️  Full build/type-check는 GitHub CI + Vercel에서 계속 검증됨');
      return;
    }

    console.log(
      useChangedTypeCheck
        ? '⚡ TypeScript 증분 검증 (변경 범위)...'
        : '⚡ TypeScript 검증 (기본 모드)...'
    );

    const extraEnv = useChangedTypeCheck
      ? {
          ...process.env,
          PRE_PUSH_CHANGED_FILES: typeCheckRelevantFiles.join('\n'),
        }
      : null;

    const success = runNpm(
      useChangedTypeCheck ? ['run', 'type-check:changed'] : ['run', 'type-check'],
      extraEnv
    );
    if (!success) {
      typeCheckStatus = 'failed';
      console.log('❌ TypeScript 에러 - push blocked');
      console.log('');
      console.log(
        `💡 Fix: ${useChangedTypeCheck ? 'npm run type-check:changed' : 'npm run type-check'}`
      );
      console.log('');
      console.log('⚠️  Bypass: HUSKY=0 git push');
      process.exit(1);
    }
    typeCheckStatus = 'passed';
    console.log('✅ TypeScript 검증 통과');
    console.log('ℹ️  Full build는 GitHub CI + Vercel에서 실행됨');
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

// Environment check
function checkEnvironment() {
  // Skip env check if not available
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts || !pkg.scripts['env:check']) {
      return; // Skip if script not defined
    }
  } catch {
    return;
  }

  console.log('🔐 Environment variables check...');
  const success = runNpm(['run', 'env:check']);
  if (!success) {
    console.log('❌ Environment variables check failed');
    console.log('');
    console.log('💡 Fix: Add missing env vars to .env.local');
    console.log('');
    console.log('⚠️  Bypass: HUSKY=0 git push');
    process.exit(1);
  }
}

// Summary
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
  } else {
    console.log(`  ⚪ Tests ${testStatus}`);
  }
  if (typeCheckStatus === 'passed') {
    console.log('  ✅ TypeScript check passed');
  } else if (typeCheckStatus === 'skipped-docs-only') {
    console.log('  ⚪ TypeScript skipped (docs/report-only push)');
  } else if (typeCheckStatus === 'skipped-no-relevant-ts') {
    console.log('  ⚪ TypeScript skipped (no relevant TS files in push range)');
  } else if (typeCheckStatus === 'skipped') {
    console.log('  ⚪ TypeScript skipped (SKIP_BUILD=true)');
  } else if (typeCheckStatus === 'delegated') {
    console.log('  ⚪ TypeScript covered by full build');
  }
  if (!QUICK_PUSH && !isLimitedMode) {
    console.log('  ✅ Full build passed');
  } else {
    console.log('  ⚪ Full build → GitHub CI + Vercel');
  }
  if (STRICT_PUSH_ENV) {
    console.log('  ✅ Environment validated');
  } else {
    console.log('  ⚪ Environment check skipped (set STRICT_PUSH_ENV=true)');
  }
  console.log('');
}

// Main
function main() {
  const startTime = Date.now();

  console.log('🔍 Pre-push validation starting...');

  // Show mode at the start
  if (isLimitedMode) {
    console.log('');
    console.log('🔧 Windows Limited Mode detected');
    console.log('   Running: TypeScript only');
    console.log('   Skipped: Lint (pre-commit), Tests, Full build');
    console.log('');
  }

  // Early checks
  checkRelease();
  if (!isLimitedMode) {
    checkWSLPerformance();
  }

  // node_modules health check (fail early if corrupted)
  if (!checkNodeModules()) {
    console.log('❌ node_modules check failed - push blocked');
    console.log('');
    console.log('💡 Quick bypass: HUSKY=0 git push');
    process.exit(1);
  }

  const changedFilesResult = getChangedFilesForPush();
  checkCloudBuildFreeTierGuard(changedFilesResult);

  if (isDocsArtifactOnlyPush(changedFilesResult)) {
    runDocsArtifactValidation(changedFilesResult);
  } else {
    runTests(changedFilesResult);
    runBuildValidation(changedFilesResult);
    if (STRICT_PUSH_ENV) {
      checkEnvironment();
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  printSummary(duration);
}

main();
