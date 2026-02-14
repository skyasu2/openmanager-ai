#!/usr/bin/env node

/**
 * Cross-platform Pre-push Hook
 * Windows/macOS/Linux compatible
 * Uses execFileSync for security (no shell injection risk)
 */

const { execFileSync, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const isWindows = os.platform() === 'win32';
const isWSL = !isWindows && fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const gitCmd = isWindows ? 'git.exe' : 'git';
const cwd = process.cwd();
const isWindowsFS = cwd.startsWith('/mnt/');

// Environment flags
// 🎯 2025 Best Practice: Pre-push는 빠르게, Full Build는 CI/Vercel에서
// - QUICK_PUSH=true (기본): TypeScript만 (~20초)
// - QUICK_PUSH=false: Full Build (~3분, 릴리스 전 검증용)
const SKIP_RELEASE_CHECK = process.env.SKIP_RELEASE_CHECK === 'true';
const QUICK_PUSH = process.env.QUICK_PUSH !== 'false'; // 기본값: true (빠른 푸시)
const SKIP_TESTS = process.env.SKIP_TESTS === 'true';
const SKIP_BUILD = process.env.SKIP_BUILD === 'true';
const SKIP_NODE_CHECK = process.env.SKIP_NODE_CHECK === 'true';

// Windows = limited validation mode (TypeScript + Lint only)
// WSL with Linux node_modules = full validation mode
const isLimitedMode = isWindows;

let testStatus = 'pending';

function runNpm(args) {
  const result = spawnSync(npmCmd, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    cwd,
    shell: isWindows,
  });
  return result.status === 0;
}

function runNpmSilent(args) {
  const result = spawnSync(npmCmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd,
    shell: isWindows,
  });
  return { success: result.status === 0, output: result.stdout || '' };
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

function checkCloudBuildFreeTierGuard() {
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
  if (SKIP_RELEASE_CHECK || QUICK_PUSH) return;

  const lastTag = runGit(['describe', '--tags', '--abbrev=0']);
  if (!lastTag) return;

  const commitsSinceTag = runGit(['rev-list', `${lastTag}..HEAD`, '--count']);
  const count = parseInt(commitsSinceTag, 10) || 0;

  if (count > 5) {
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

// Tests
function runTests() {
  console.log('🧪 Running quick tests...');

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

  const success = runNpm(['run', 'test:super-fast']);
  if (success) {
    testStatus = 'passed';
  } else {
    testStatus = 'failed';
    console.log('❌ Tests failed - push blocked');
    console.log('');
    console.log('💡 Fix: npm run test:super-fast');
    console.log('');
    console.log('⚠️  Bypass options:');
    console.log('   • SKIP_TESTS=true git push   (Skip tests only)');
    console.log('   • HUSKY=0 git push           (Skip all hooks)');
    process.exit(1);
  }
}

// Build validation
function runBuildValidation() {
  console.log('🏗️ Build validation...');

  if (SKIP_BUILD) {
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
      console.log('❌ TypeScript check failed - push blocked');
      console.log('');
      console.log('💡 Fix: npm run type-check');
      console.log('');
      console.log('⚠️  Bypass: HUSKY=0 git push');
      process.exit(1);
    }

    // Lint는 pre-commit에서 이미 실행되므로 스킵
    console.log('⚪ Lint skipped (already run in pre-commit)');

    console.log('✅ Windows Limited Mode validation passed');
    return;
  }

  if (QUICK_PUSH) {
    console.log('⚡ TypeScript 검증 (기본 모드)...');
    const success = runNpm(['run', 'hook:validate']);
    if (!success) {
      console.log('❌ TypeScript 에러 - push blocked');
      console.log('');
      console.log('💡 Fix: npm run type-check');
      console.log('');
      console.log('⚠️  Bypass: HUSKY=0 git push');
      process.exit(1);
    }
    console.log('✅ TypeScript 검증 통과');
    console.log('ℹ️  Full build는 GitHub CI + Vercel에서 실행됨');
  } else {
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

// Package.json check
function checkPackageJson() {
  console.log('📦 Checking package.json...');
  try {
    const pkgPath = path.join(cwd, 'package.json');
    JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    console.log('❌ package.json has syntax errors');
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
  if (isLimitedMode) {
    console.log('  🔧 Mode: Windows Limited');
  } else if (QUICK_PUSH) {
    console.log('  ⚡ Mode: Quick (TypeScript only)');
  } else {
    console.log('  🐢 Mode: Full Build');
  }
  console.log(`  ${testStatus === 'passed' ? '✅' : '⚪'} Tests ${testStatus}`);
  console.log('  ✅ TypeScript check passed');
  if (!QUICK_PUSH && !isLimitedMode) {
    console.log('  ✅ Full build passed');
  } else {
    console.log('  ⚪ Full build → GitHub CI + Vercel');
  }
  console.log('  ✅ Environment validated');
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

  checkCloudBuildFreeTierGuard();
  runTests();
  runBuildValidation();
  checkPackageJson();
  checkEnvironment();

  const duration = Math.round((Date.now() - startTime) / 1000);
  printSummary(duration);
}

main();
