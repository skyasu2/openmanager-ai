/**
 * Pre-push guard checks
 * Cloud Build free-tier guard, node_modules health, release reminder, env check.
 * Guard functions return structured status and leave exit handling to the caller.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// ─── Helpers ──────────────────────────────────────────────────────────────

function stripHashComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function createGuardResult(ok, extra = {}) {
  return { ok, ...extra };
}

function normalizeRemoteValue(value) {
  return String(value || '').trim();
}

function isZeroOid(oid) {
  return /^0+$/.test(String(oid || '').trim());
}

function countIndent(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function findGitLabCiSemanticIssues(content) {
  const lines = content.split('\n');
  const issues = [];
  let activeScriptKey = null;
  let activeScriptIndent = -1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (!trimmed) {
      continue;
    }

    if (activeScriptKey && indent <= activeScriptIndent && !trimmed.startsWith('-')) {
      activeScriptKey = null;
      activeScriptIndent = -1;
    }

    const scriptKeyMatch = line.match(/^(\s*)(before_script|script|after_script):\s*(.*)$/);
    if (scriptKeyMatch) {
      const [, leadingWhitespace, scriptKey, trailing] = scriptKeyMatch;
      const hasInlineValue =
        trailing.trim().length > 0 &&
        !trailing.trim().startsWith('#') &&
        trailing.trim() !== '|' &&
        trailing.trim() !== '>';

      if (hasInlineValue) {
        activeScriptKey = null;
        activeScriptIndent = -1;
      } else {
        activeScriptKey = scriptKey;
        activeScriptIndent = leadingWhitespace.length;
      }
      continue;
    }

    if (!activeScriptKey) {
      continue;
    }

    if (/^\s*-\s*(#.*)?$/.test(line)) {
      issues.push({
        line: index + 1,
        scriptKey: activeScriptKey,
        message: 'Null list item inside GitLab CI script block',
        snippet: line,
      });
    }
  }

  return issues;
}

// ─── Canonical remote push guard ─────────────────────────────────────────

function resolveCanonicalRemote(runGit) {
  const pushDefault = normalizeRemoteValue(runGit(['config', '--get', 'remote.pushDefault']));
  if (pushDefault) return pushDefault;

  const branchName = normalizeRemoteValue(runGit(['rev-parse', '--abbrev-ref', 'HEAD']));
  if (branchName && branchName !== 'HEAD') {
    const branchRemote = normalizeRemoteValue(
      runGit(['config', '--get', `branch.${branchName}.remote`])
    );
    if (branchRemote) return branchRemote;
  }

  return 'gitlab';
}

/**
 * @param {string} remoteName
 * @param {string} remoteUrl
 * @param {Function} runGit - (args: string[]) => string
 */
function checkCanonicalRemotePush(remoteName, remoteUrl, runGit) {
  const targetRemoteName = normalizeRemoteValue(remoteName);
  const targetRemoteUrl = normalizeRemoteValue(remoteUrl);

  if (!targetRemoteName && !targetRemoteUrl) {
    return createGuardResult(true, { skipped: true });
  }

  if (process.env.ALLOW_NON_CANONICAL_PUSH === 'true') {
    console.log(
      '⚠️  Non-canonical remote push allowed (ALLOW_NON_CANONICAL_PUSH=true)'
    );
    return createGuardResult(true, { skipped: true });
  }

  const canonicalRemote = resolveCanonicalRemote(runGit);
  const canonicalRemoteUrl = normalizeRemoteValue(
    runGit(['remote', 'get-url', canonicalRemote])
  );
  const targetLabel = targetRemoteName || targetRemoteUrl;

  const sameRemoteName =
    targetRemoteName &&
    canonicalRemote &&
    targetRemoteName.toLowerCase() === canonicalRemote.toLowerCase();
  const sameRemoteUrl =
    targetRemoteUrl &&
    canonicalRemoteUrl &&
    targetRemoteUrl.toLowerCase() === canonicalRemoteUrl.toLowerCase();

  if (sameRemoteName || sameRemoteUrl) {
    return createGuardResult(true);
  }

  console.log('❌ Non-canonical remote push blocked by policy');
  console.log(`   target remote: ${targetLabel}`);
  console.log(
    `   canonical remote: ${canonicalRemote}${canonicalRemoteUrl ? ` (${canonicalRemoteUrl})` : ''}`
  );
  console.log('');
  console.log('💡 Use: git push gitlab <branch>');
  console.log('💡 Public snapshot sync: npm run sync:github');
  console.log('⚠️  Temporary bypass: ALLOW_NON_CANONICAL_PUSH=true git push <remote> <ref>');
  return createGuardResult(false, {
    reason: 'non-canonical-remote-push',
    targetRemote: targetLabel,
    canonicalRemote,
  });
}

// ─── Direct main push guard ──────────────────────────────────────────────

/**
 * @param {string} remoteName
 * @param {Array<{ localRef: string, localOid: string, remoteRef: string, remoteOid: string }>} prePushUpdates
 * @param {Function} runGit - (args: string[]) => string
 */
function checkDirectMainPush(remoteName, prePushUpdates, runGit) {
  const enforce =
    process.env.BLOCK_MAIN_DIRECT_PUSH === 'true' ||
    process.env.ENFORCE_MAIN_BRANCH_PROTECTION === 'true';
  if (!enforce) {
    return createGuardResult(true, { skipped: true });
  }

  if (process.env.ALLOW_MAIN_DIRECT_PUSH === 'true') {
    console.log('⚠️  Direct main push allowed (ALLOW_MAIN_DIRECT_PUSH=true)');
    return createGuardResult(true, { skipped: true });
  }

  const targetRemoteName = normalizeRemoteValue(remoteName);
  const canonicalRemote = resolveCanonicalRemote(runGit);
  if (!targetRemoteName || !canonicalRemote) {
    return createGuardResult(true, { skipped: true });
  }

  if (targetRemoteName.toLowerCase() !== canonicalRemote.toLowerCase()) {
    return createGuardResult(true, { skipped: true });
  }

  const updates = Array.isArray(prePushUpdates) ? prePushUpdates : [];
  const isMainRefUpdate = updates.some(
    (update) =>
      update &&
      update.remoteRef === 'refs/heads/main' &&
      update.localRef === 'refs/heads/main' &&
      !isZeroOid(update.localOid)
  );

  const currentBranch = normalizeRemoteValue(runGit(['rev-parse', '--abbrev-ref', 'HEAD']));
  const shouldBlock = updates.length > 0 ? isMainRefUpdate : currentBranch === 'main';

  if (!shouldBlock) {
    return createGuardResult(true);
  }

  console.log('❌ Direct push to canonical main is blocked by local strict mode');
  console.log('   Use a feature branch + Merge Request for this push.');
  console.log('💡 Default single-maintainer flow keeps direct main push enabled.');
  console.log('💡 Temporary bypass: ALLOW_MAIN_DIRECT_PUSH=true git push gitlab main');
  return createGuardResult(false, {
    reason: 'direct-main-push-blocked',
    canonicalRemote,
  });
}

// ─── GitLab runner health guard ───────────────────────────────────────────

function runStatus(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      stdio: 'ignore',
    });
    return { ok: result.status === 0, error: result.error || null };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * @param {string} remoteName
 * @param {Function} runGit - (args: string[]) => string
 * @param {{ skip?: boolean }} options
 */
function checkGitLabRunnerHealth(remoteName, runGit, options = {}) {
  if (options.skip) {
    return createGuardResult(true, { skipped: true });
  }

  const targetRemoteName = normalizeRemoteValue(remoteName);
  const canonicalRemote = resolveCanonicalRemote(runGit);
  const isCanonicalPush =
    targetRemoteName &&
    canonicalRemote &&
    targetRemoteName.toLowerCase() === canonicalRemote.toLowerCase();

  if (!isCanonicalPush) {
    return createGuardResult(true, { skipped: true });
  }

  if (process.env.SKIP_RUNNER_HEALTH_CHECK === 'true') {
    console.log('⚪ Runner health check skipped (SKIP_RUNNER_HEALTH_CHECK=true)');
    return createGuardResult(true, { skipped: true });
  }

  if (process.env.ALLOW_RUNNER_DOWN_PUSH === 'true') {
    console.log('⚠️  Runner-down push bypass enabled (ALLOW_RUNNER_DOWN_PUSH=true)');
    return createGuardResult(true, { skipped: true });
  }

  if (process.platform === 'win32') {
    return createGuardResult(true, { skipped: true });
  }

  const statusRunner = options.statusRunner || runStatus;
  const issues = [];

  let runnerDetected = false;

  const serviceStatus = statusRunner('systemctl', ['is-active', '--quiet', 'gitlab-runner']);
  if (serviceStatus.ok) {
    runnerDetected = true;
  }

  const canFallbackToProcessCheck =
    !runnerDetected &&
    (!serviceStatus.error || serviceStatus.error.code === 'ENOENT');

  const processStatus = canFallbackToProcessCheck
    ? statusRunner('pgrep', ['-f', '[g]itlab-runner'])
    : { ok: false, error: null };

  if (processStatus.ok) {
    runnerDetected = true;
  }

  if (!runnerDetected) {
    if (processStatus.error && processStatus.error.code === 'ENOENT') {
      issues.push('gitlab-runner 상태 확인 명령(systemctl/pgrep)을 찾을 수 없음');
    } else {
      issues.push('gitlab-runner 서비스/프로세스를 찾을 수 없음');
    }
  }

  const dockerStatus = statusRunner('docker', ['info']);
  if (!dockerStatus.ok) {
    issues.push('Docker 데몬 미가동');
  }

  if (issues.length === 0) {
    return createGuardResult(true);
  }

  console.log('❌ Local runner health check failed - push blocked');
  for (const issue of issues) {
    console.log(`   - ${issue}`);
  }
  console.log('');
  console.log('💡 Fix: Docker Desktop/daemon과 gitlab-runner를 먼저 복구하세요.');
  console.log('💡 CI를 우회해야 하면 수동으로 vercel --prod 배포를 사용하세요.');
  console.log('⚠️  Temporary bypass: ALLOW_RUNNER_DOWN_PUSH=true git push gitlab <branch>');
  return createGuardResult(false, {
    reason: 'gitlab-runner-health',
    issues,
  });
}

// ─── Cloud Build free-tier guard ─────────────────────────────────────────

/**
 * @param {object} changedFilesResult - { isKnown: boolean, files: string[] }
 * @param {string} cwd
 * @param {boolean} FORCE_CLOUD_BUILD_GUARD
 */
function checkCloudBuildFreeTierGuard(changedFilesResult, cwd, FORCE_CLOUD_BUILD_GUARD) {
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
      return createGuardResult(true, { skipped: true });
    }
    console.warn(
      '⚠️  Cloud Build guard running in fail-closed mode (changed files unknown)'
    );
  }

  const cloudbuildPath = path.join(cwd, 'cloud-run/ai-engine/cloudbuild.yaml');
  const deployPath = path.join(cwd, 'cloud-run/ai-engine/deploy.sh');

  if (!fs.existsSync(cloudbuildPath) || !fs.existsSync(deployPath)) {
    return createGuardResult(true, { skipped: true });
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
    failures.push(
      'cloud-run/ai-engine/cloudbuild.yaml contains highcpu machine type in active config'
    );
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
    return createGuardResult(false, {
      reason: 'cloud-build-free-tier-guard',
      failures,
    });
  }

  return createGuardResult(true);
}

// ─── GitLab CI semantic guard ────────────────────────────────────────────

function checkGitLabCiSemanticGuard(changedFilesResult, cwd) {
  const changedFiles = changedFilesResult.files;
  const hasChangedFiles = changedFiles.length > 0;
  const shouldInspect =
    !changedFilesResult.isKnown || changedFiles.includes('.gitlab-ci.yml');

  if (!shouldInspect) {
    if (hasChangedFiles) {
      return createGuardResult(true, { skipped: true });
    }
    return createGuardResult(true);
  }

  const gitlabCiPath = path.join(cwd, '.gitlab-ci.yml');
  if (!fs.existsSync(gitlabCiPath)) {
    return createGuardResult(true, { skipped: true });
  }

  console.log('🧭 GitLab CI semantic guard...');
  const content = fs.readFileSync(gitlabCiPath, 'utf8');
  const issues = findGitLabCiSemanticIssues(content);

  if (issues.length === 0) {
    return createGuardResult(true);
  }

  console.log('❌ GitLab CI semantic guard failed - push blocked');
  for (const issue of issues) {
    console.log(
      `   - line ${issue.line} (${issue.scriptKey}): ${issue.message} -> ${issue.snippet.trim()}`
    );
  }
  console.log('');
  console.log('💡 Fix: replace `- # comment` with a normal YAML comment or a shell comment inside a string command');
  console.log('⚠️  Bypass: HUSKY=0 git push');
  return createGuardResult(false, {
    reason: 'gitlab-ci-semantic-guard',
    issues,
  });
}

// ─── node_modules health check ───────────────────────────────────────────

/**
 * @param {string} cwd
 * @param {boolean} SKIP_NODE_CHECK
 * @param {boolean} isWSL
 * @param {boolean} isWindows
 * @param {boolean} isWindowsFS
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string }}
 */
function checkNodeModules(cwd, SKIP_NODE_CHECK, isWSL, isWindows, isWindowsFS) {
  if (SKIP_NODE_CHECK) {
    console.log('⚪ node_modules check skipped (SKIP_NODE_CHECK=true)');
    return createGuardResult(true, { skipped: true });
  }

  const criticalPackages = [
    'node_modules/typescript',
    'node_modules/react',
    'node_modules/@types/react',
    'node_modules/@types/node',
    'node_modules/next',
  ];

  const missing = criticalPackages.filter(
    (pkg) => !fs.existsSync(path.join(cwd, pkg))
  );

  if (missing.length > 0) {
    console.log('');
    console.log('⚠️  node_modules appears to be corrupted or incomplete');
    console.log(
      '   Missing packages:',
      missing.map((p) => p.replace('node_modules/', '')).join(', ')
    );
    console.log('');
    console.log('💡 Fix options:');
    console.log('   1. Run: rm -rf node_modules package-lock.json && npm install');
    console.log('   2. Bypass: HUSKY=0 git push');
    console.log('');
    return createGuardResult(false, { reason: 'missing-node-modules', missing });
  }

  if (isWSL && isWindowsFS) {
    const rollupPath = path.join(cwd, 'node_modules/@rollup');
    if (fs.existsSync(rollupPath)) {
      const rollupContents = fs.readdirSync(rollupPath);
      const hasWin32 = rollupContents.some((f) => f.includes('win32'));
      const hasLinux = rollupContents.some((f) => f.includes('linux'));

      if (hasWin32 && !hasLinux) {
        if (isWindows) return createGuardResult(true);
        console.log('');
        console.log('⚠️  node_modules was installed on Windows, not compatible with WSL');
        console.log('');
        console.log('💡 Options:');
        console.log('   1. Push from Windows: Use PowerShell/CMD to run git push');
        console.log('   2. Reinstall: rm -rf node_modules && npm install');
        console.log('   3. Bypass: HUSKY=0 git push');
        console.log('');
        return createGuardResult(false, { reason: 'windows-node-modules-in-wsl' });
      }
    }
  }

  return createGuardResult(true);
}

// ─── Release reminder ────────────────────────────────────────────────────

/**
 * @param {Function} runGit - (args: string[]) => string
 * @param {boolean}  SKIP_RELEASE_CHECK
 */
function checkRelease(runGit, SKIP_RELEASE_CHECK) {
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

// ─── WSL performance warning ─────────────────────────────────────────────

function checkWSLPerformance(isWSL, isWindowsFS) {
  if (isWSL && isWindowsFS) {
    console.log('');
    console.log('ℹ️  WSL + Windows filesystem detected');
    console.log('   기본: TypeScript 검증만 (~20초)');
    console.log('   Full Build 필요 시: QUICK_PUSH=false git push');
    console.log('');
  }
}

// ─── Environment check ───────────────────────────────────────────────────

/**
 * @param {string}   cwd
 * @param {Function} runNpm - (args: string[]) => boolean
 */
function checkEnvironment(cwd, runNpm) {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts?.['env:check']) return createGuardResult(true, { skipped: true });
  } catch {
    return createGuardResult(true, { skipped: true });
  }

  console.log('🔐 Environment variables check...');
  const success = runNpm(['run', 'env:check']);
  if (!success) {
    console.log('❌ Environment variables check failed');
    console.log('');
    console.log('💡 Fix: Add missing env vars to .env.local');
    console.log('');
    console.log('⚠️  Bypass: HUSKY=0 git push');
    return createGuardResult(false, { reason: 'environment-check' });
  }

  return createGuardResult(true);
}

module.exports = {
  checkCanonicalRemotePush,
  checkDirectMainPush,
  checkGitLabRunnerHealth,
  checkGitLabCiSemanticGuard,
  checkCloudBuildFreeTierGuard,
  checkNodeModules,
  checkRelease,
  checkWSLPerformance,
  checkEnvironment,
  findGitLabCiSemanticIssues,
};
