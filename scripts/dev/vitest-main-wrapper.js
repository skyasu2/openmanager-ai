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
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '../..');

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

function fileLikelyNeedsDom(filePath) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');

    if (source.includes('@vitest-environment jsdom')) return true;
    if (source.includes('@vitest-environment happy-dom')) return true;

    return /\.(test|spec)\.tsx$/u.test(filePath);
  } catch {
    return false;
  }
}

function runJsdomHealthCheck() {
  return spawnSync(
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
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

function shouldCheckJsdom(argv) {
  if (process.env.CI === 'true') return false;
  if (process.env.VITEST_SKIP_JSDOM_HEALTHCHECK === 'true') return false;

  const files = getTargetFiles(argv);
  if (files.length === 0) return true;

  return files.some(fileLikelyNeedsDom);
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
  console.error('   impact: jsdom tests stall in queue with 0 tests started.');
  console.error('');
  console.error('Next steps:');
  console.error('1. Use `npm run test:quick` for node-only smoke checks.');
  console.error('2. Reinstall dependencies or rerun from a faster local filesystem.');
  console.error(
    '3. If you intentionally want to try anyway, set `VITEST_SKIP_JSDOM_HEALTHCHECK=true`.'
  );
  process.exit(1);
}

if (args.includes('--healthcheck-only')) {
  const result = runJsdomHealthCheck();
  if (result.status === 0 && result.stdout.trim() === 'ok') {
    console.log('✅ jsdom import health check passed');
    process.exit(0);
  }

  printFailureAndExit(result);
}

if (shouldCheckJsdom(args)) {
  const result = runJsdomHealthCheck();
  if (!(result.status === 0 && result.stdout.trim() === 'ok')) {
    printFailureAndExit(result);
  }
}

const vitestCli = resolveVitestCli();
const child = spawn(process.execPath, [vitestCli, ...args], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

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
