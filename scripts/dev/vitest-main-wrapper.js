#!/usr/bin/env node
/**
 * Run Vitest with a fast-fail guard for local jsdom stalls.
 *
 * On this workspace, local `require('jsdom')` can stall indefinitely before
 * Vitest starts any DOM tests. When that happens, `npm test` appears to hang in
 * the queue with `0 passed (N)`.
 *
 * This wrapper checks jsdom health only when a run is likely to include DOM
 * tests. Node-only targeted runs are allowed through unchanged.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '../..');
const DEFAULT_JSDOM_HEALTHCHECK_TIMEOUT_MS = 5000;
const SLOW_ENV_JSDOM_HEALTHCHECK_TIMEOUT_MS = 90000;
const JSDOM_HEALTHCHECK_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NO_TEST_FILES_FOUND_MARKER = 'No test files found, exiting with code 0';
const DEP_SCAN_FAILURE_MARKER =
  '(!) Failed to run dependency scan. Skipping dependency pre-bundling.';
const DEP_SCAN_OUTDATED_REQUEST_MARKER =
  'The server is being restarted or closed. Request is outdated';
const jsdomHealthCachePath = path.join(
  os.tmpdir(),
  'openmanager-vitest-jsdom-health.json'
);

function resolveVitestCli() {
  const pkgPath = require.resolve('vitest/package.json');
  return path.join(path.dirname(pkgPath), 'vitest.mjs');
}

function normalizePath(candidate) {
  return path.isAbsolute(candidate)
    ? candidate
    : path.resolve(projectRoot, candidate);
}

function isExistingFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function getTargetFiles(argv) {
  const files = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current) continue;
    if (current === '--config') {
      index += 1;
      continue;
    }
    if (current.startsWith('-')) continue;

    const resolved = normalizePath(current);
    if (isExistingFile(resolved)) {
      files.push(resolved);
    }
  }

  return files;
}

function getConfigFile(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--config') continue;
    const candidate = argv[index + 1];
    if (!candidate) return null;

    const resolved = normalizePath(candidate);
    return isExistingFile(resolved) ? resolved : null;
  }

  return null;
}

function isWsl() {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;

  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

function isWindowsMountedWorkspace() {
  return /^\/mnt\/[a-z]\//iu.test(projectRoot);
}

function isSlowJsdomEnvironment() {
  return isWsl() && isWindowsMountedWorkspace();
}

function getJsdomVersion() {
  try {
    return require('jsdom/package.json').version;
  } catch {
    return 'unknown';
  }
}

function getLockfileMtimeMs() {
  for (const candidate of ['package-lock.json', 'npm-shrinkwrap.json']) {
    try {
      return fs.statSync(path.join(projectRoot, candidate)).mtimeMs;
    } catch {
      continue;
    }
  }

  return 0;
}

function getJsdomHealthCacheKey() {
  return JSON.stringify({
    projectRoot,
    node: process.version,
    jsdomVersion: getJsdomVersion(),
    lockfileMtimeMs: getLockfileMtimeMs(),
  });
}

function readJsdomHealthCache() {
  try {
    const raw = fs.readFileSync(jsdomHealthCachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.cacheKey !== getJsdomHealthCacheKey()) return null;
    if (Date.now() - parsed.recordedAtMs > JSDOM_HEALTHCHECK_CACHE_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeJsdomHealthCache(durationMs) {
  try {
    fs.writeFileSync(
      jsdomHealthCachePath,
      JSON.stringify(
        {
          cacheKey: getJsdomHealthCacheKey(),
          durationMs,
          recordedAtMs: Date.now(),
        },
        null,
        2
      )
    );
  } catch {
    // Cache write failure should not block test execution.
  }
}

function getJsdomHealthCheckTimeoutMs() {
  const override = Number.parseInt(
    process.env.VITEST_JSDOM_HEALTHCHECK_TIMEOUT_MS || '',
    10
  );
  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  return isSlowJsdomEnvironment()
    ? SLOW_ENV_JSDOM_HEALTHCHECK_TIMEOUT_MS
    : DEFAULT_JSDOM_HEALTHCHECK_TIMEOUT_MS;
}

function runJsdomHealthCheck() {
  const cached = readJsdomHealthCache();
  const timeoutMs = getJsdomHealthCheckTimeoutMs();

  if (cached) {
    return {
      status: 0,
      stdout: 'ok',
      stderr: '',
      durationMs: cached.durationMs,
      timeoutMs,
      cached: true,
    };
  }

  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      [
        'const { JSDOM } = require("jsdom");',
        'if (typeof JSDOM !== "function") process.exit(2);',
        'process.stdout.write("ok");',
      ].join(' '),
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const durationMs = Date.now() - startedAt;

  if (result.status === 0) {
    writeJsdomHealthCache(durationMs);
  }

  return {
    ...result,
    durationMs,
    timeoutMs,
    cached: false,
  };
}

function configLikelyNeedsDom(configFile) {
  if (!configFile) return false;

  try {
    const source = fs.readFileSync(configFile, 'utf8');
    return /environment:\s*['"](jsdom|happy-dom)['"]/u.test(source);
  } catch {
    return false;
  }
}

function shouldCheckJsdom(argv) {
  if (process.env.CI === 'true') return false;
  if (process.env.VITEST_SKIP_JSDOM_HEALTHCHECK === 'true') return false;

  const configFile = getConfigFile(argv);
  if (configLikelyNeedsDom(configFile)) return true;

  const files = getTargetFiles(argv);
  if (files.length === 0) return true;

  // Explicit targeted runs should proceed directly. The full-suite guard exists
  // to prevent accidental stalls before any tests start, while targeted DOM
  // tests can rely on `npm run test:jsdom:health` for an explicit local check.
  return false;
}

function shouldBufferVitestOutput(argv) {
  return (
    argv.includes('related') &&
    argv.includes('--passWithNoTests') &&
    configLikelyNeedsDom(getConfigFile(argv))
  );
}

function stripKnownDepScanNoise(text) {
  if (!text) return '';
  const markerIndex = text.indexOf(DEP_SCAN_FAILURE_MARKER);
  if (markerIndex === -1) return text;
  return text.slice(0, markerIndex).trimEnd();
}

function filterVitestOutput(exitCode, stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  const shouldSuppress =
    exitCode === 0 &&
    combined.includes(NO_TEST_FILES_FOUND_MARKER) &&
    combined.includes(DEP_SCAN_FAILURE_MARKER) &&
    combined.includes(DEP_SCAN_OUTDATED_REQUEST_MARKER);

  if (!shouldSuppress) {
    return { stdout, stderr, suppressed: false };
  }

  const filteredStdout = stripKnownDepScanNoise(stdout);
  const filteredStderr = stripKnownDepScanNoise(stderr);
  const note =
    '[vitest-main-wrapper] Suppressed benign Vite dep-scan noise after a zero-test DOM related run triggered by generated HTML artifacts.';

  return {
    stdout: filteredStdout,
    stderr: filteredStderr ? `${filteredStderr}\n${note}\n` : `${note}\n`,
    suppressed: true,
  };
}

function printFailureAndExit(result) {
  const version = process.version;
  const stderr = result.stderr?.trim();
  const timedOut = result.signal === 'SIGTERM' || result.error?.code === 'ETIMEDOUT';
  const reason = timedOut
    ? "local `require('jsdom')` did not complete within 5s"
    : stderr || 'local jsdom health check failed before Vitest startup';

  console.error('❌ Vitest main wrapper blocked a hanging DOM test startup.');
  console.error(`   node: ${version}`);
  console.error(`   reason: ${reason}`);
  console.error(`   timeout: ${result.timeoutMs}ms`);
  console.error('   impact: jsdom tests stall in queue with 0 tests started.');
  console.error('');
  console.error('Next steps:');
  console.error('1. Use `npm run test:quick` for node-only smoke checks.');
  console.error('2. Run `npm run test:jsdom:health` to warm/verify local DOM startup.');
  console.error(
    '3. Reinstall dependencies or rerun from a faster local filesystem if startup stays too slow.'
  );
  console.error(
    '4. If you intentionally want to try anyway, set `VITEST_SKIP_JSDOM_HEALTHCHECK=true`.'
  );
  process.exit(1);
}

function runVitest(argv) {
  const vitestCli = resolveVitestCli();
  const buffered = shouldBufferVitestOutput(argv);
  const child = spawn(process.execPath, [vitestCli, ...argv], {
    cwd: projectRoot,
    stdio: buffered ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });

  if (!buffered || !child.stdout || !child.stderr) {
    child.on('close', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      process.exit(code ?? 1);
    });

    child.on('error', (error) => {
      console.error('❌ Vitest 실행 오류:', error.message);
      process.exit(1);
    });
    return;
  }

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('close', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    const { stdout: filteredStdout, stderr: filteredStderr } =
      filterVitestOutput(code ?? 1, stdout, stderr);

    if (filteredStdout) process.stdout.write(filteredStdout);
    if (filteredStderr) process.stderr.write(filteredStderr);
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('❌ Vitest 실행 오류:', error.message);
    process.exit(1);
  });
}

function main(argv) {
  if (argv.includes('--healthcheck-only')) {
    const result = runJsdomHealthCheck();
    if (result.status === 0) {
      const cachedLabel = result.cached ? 'cached' : 'fresh';
      console.log(
        `✅ jsdom import health check passed (${cachedLabel}, ${(result.durationMs / 1000).toFixed(1)}s)`
      );
      process.exit(0);
    }

    printFailureAndExit(result);
  }

  if (shouldCheckJsdom(argv)) {
    const result = runJsdomHealthCheck();
    if (result.status !== 0) {
      printFailureAndExit(result);
    }
  }

  runVitest(argv);
}

if (require.main === module) {
  main(args);
}

module.exports = {
  filterVitestOutput,
  shouldBufferVitestOutput,
  stripKnownDepScanNoise,
};
