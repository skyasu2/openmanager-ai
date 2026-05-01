#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Vercel Post-Deploy Smoke Test (Low-Cost)
 *
 * Goal:
 * - Validate that the production frontend is reachable immediately after deploy.
 * - Keep the gate cheap: HTML route checks + one lightweight JSON endpoint.
 *
 * Default checks:
 * 1) GET /
 * 2) GET /login
 * 3) GET /api/version
 *
 * Notes:
 * - This is a deployment gate, not a background uptime monitor.
 * - We intentionally avoid /api/health here to respect the manual-only health policy.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 8;
const DEFAULT_RETRY_DELAY_MS = 3000;

function resolveDefaultExpectedVersion() {
  const envVersion = String(
    process.env.EXPECTED_APP_VERSION || process.env.npm_package_version || ''
  ).trim();
  if (envVersion) {
    return envVersion;
  }

  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    return String(packageJson.version || '').trim();
  } catch {
    return '';
  }
}

function normalizeUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  return `https://${trimmed}`.replace(/\/+$/, '');
}

function resolveDefaultUrl() {
  return (
    normalizeUrl(process.env.CI_ENVIRONMENT_URL) ||
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeUrl(process.env.VERCEL_URL) ||
    'https://openmanager-ai.vercel.app'
  );
}

function parseArgs(argv) {
  const options = {
    url: resolveDefaultUrl(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    expectedVersion: resolveDefaultExpectedVersion(),
    expectedCommitSha: String(
      process.env.EXPECTED_COMMIT_SHA || process.env.CI_COMMIT_SHA || ''
    ).trim(),
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith('--url=')) {
      options.url = normalizeUrl(arg.slice('--url='.length));
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      const value = Number.parseInt(arg.slice('--timeout-ms='.length), 10);
      if (!Number.isNaN(value) && value > 0) {
        options.timeoutMs = value;
      }
      continue;
    }

    if (arg.startsWith('--retries=')) {
      const value = Number.parseInt(arg.slice('--retries='.length), 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.retries = value;
      }
      continue;
    }

    if (arg.startsWith('--retry-delay-ms=')) {
      const value = Number.parseInt(
        arg.slice('--retry-delay-ms='.length),
        10
      );
      if (!Number.isNaN(value) && value >= 0) {
        options.retryDelayMs = value;
      }
      continue;
    }

    if (arg.startsWith('--expected-version=')) {
      options.expectedVersion = String(
        arg.slice('--expected-version='.length)
      ).trim();
      continue;
    }

    if (arg.startsWith('--expected-commit-sha=')) {
      options.expectedCommitSha = String(
        arg.slice('--expected-commit-sha='.length)
      ).trim();
    }
  }

  options.url = normalizeUrl(options.url);
  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/test/vercel-post-deploy-smoke.mjs [options]

Options:
  --url=<url>                   Target URL (default: CI_ENVIRONMENT_URL or production URL)
  --timeout-ms=<number>         Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --retries=<number>            Retry count after the first attempt (default: ${DEFAULT_RETRIES})
  --retry-delay-ms=<number>     Delay between attempts in ms (default: ${DEFAULT_RETRY_DELAY_MS})
  --expected-version=<version>  Assert /api/version buildVersion matches this release version
  --expected-commit-sha=<sha>   Assert /api/version commitSha matches this commit
  --help, -h                    Show help

Examples:
  npm run test:vercel:post-deploy:smoke
  npm run test:vercel:post-deploy:smoke -- --url=https://openmanager-ai.vercel.app
  npm run test:vercel:post-deploy:smoke -- --retries=2 --retry-delay-ms=1000
`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, timeoutMs, acceptHeader) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: acceptHeader,
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.text();
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type') || '',
  };
}

async function checkLandingPage(baseUrl, timeoutMs) {
  const result = await request(
    baseUrl,
    '/',
    timeoutMs,
    'text/html,application/xhtml+xml'
  );

  assert(result.status === 200, `expected HTTP 200, got ${result.status}`);
  assert(
    result.contentType.includes('text/html'),
    `expected text/html content-type, got ${result.contentType || 'unknown'}`
  );
  assert(
    result.body.includes('OpenManager AI'),
    'expected landing page marker "OpenManager AI"'
  );
}

async function checkLoginPage(baseUrl, timeoutMs) {
  const result = await request(
    baseUrl,
    '/login',
    timeoutMs,
    'text/html,application/xhtml+xml'
  );

  assert(result.status === 200, `expected HTTP 200, got ${result.status}`);
  assert(
    result.contentType.includes('text/html'),
    `expected text/html content-type, got ${result.contentType || 'unknown'}`
  );
  assert(
    result.body.includes('OpenManager') || result.body.includes('로그인'),
    'expected login page marker "OpenManager" or "로그인"'
  );
}

async function checkVersionApi(
  baseUrl,
  timeoutMs,
  expectedVersion,
  expectedCommitSha
) {
  const result = await request(
    baseUrl,
    '/api/version',
    timeoutMs,
    'application/json'
  );

  assert(result.status === 200, `expected HTTP 200, got ${result.status}`);
  assert(
    result.contentType.includes('application/json'),
    `expected application/json content-type, got ${result.contentType || 'unknown'}`
  );

  let payload = null;
  try {
    payload = result.body ? JSON.parse(result.body) : null;
  } catch {
    throw new Error('expected valid JSON body from /api/version');
  }

  assert(payload && typeof payload === 'object', 'expected JSON object body');
  assert(
    typeof payload.version === 'string' && payload.version.trim().length > 0,
    'expected non-empty "version" field'
  );
  const actualVersion =
    typeof payload.buildVersion === 'string' && payload.buildVersion.trim().length > 0
      ? payload.buildVersion.trim()
      : payload.version.trim();
  assert(
    typeof payload.environment === 'string' &&
      payload.environment.trim().length > 0,
    'expected non-empty "environment" field'
  );

  if (expectedVersion) {
    assert(
      actualVersion === expectedVersion,
      `expected deployed version ${expectedVersion}, got ${actualVersion}`
    );
  }

  if (expectedCommitSha) {
    const actualCommitSha =
      typeof payload.commitSha === 'string' ? payload.commitSha.trim() : '';
    assert(
      actualCommitSha === expectedCommitSha,
      `expected deployed commit ${expectedCommitSha}, got ${actualCommitSha || 'unknown'}`
    );
  }
}

async function runAttempt(
  baseUrl,
  timeoutMs,
  expectedVersion,
  expectedCommitSha
) {
  const checks = [
    { name: 'GET /', fn: checkLandingPage },
    { name: 'GET /login', fn: checkLoginPage },
    {
      name: 'GET /api/version',
      fn: (targetUrl, targetTimeoutMs) =>
        checkVersionApi(
          targetUrl,
          targetTimeoutMs,
          expectedVersion,
          expectedCommitSha
        ),
    },
  ];

  const failures = [];

  for (const check of checks) {
    process.stdout.write(`- ${check.name} ... `);
    try {
      await check.fn(baseUrl, timeoutMs);
      console.log('PASS');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL (${message})`);
      failures.push(`${check.name}: ${message}`);
    }
  }

  return failures;
}

async function sleep(ms) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const totalAttempts = options.retries + 1;

  if (!options.url) {
    console.error(
      '❌ Target URL is empty. Use --url=<url> or set CI_ENVIRONMENT_URL.'
    );
    process.exit(1);
  }

  console.log('Vercel Post-Deploy Smoke Test');
  console.log(`- target: ${options.url}`);
  console.log(`- timeout: ${options.timeoutMs}ms`);
  console.log(`- retries: ${options.retries}`);
  console.log(`- retry delay: ${options.retryDelayMs}ms`);
  if (options.expectedVersion) {
    console.log(`- expected version: ${options.expectedVersion}`);
  }
  if (options.expectedCommitSha) {
    console.log(`- expected commit: ${options.expectedCommitSha}`);
  }
  console.log('');

  let lastFailures = [];

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    console.log(`Attempt ${attempt}/${totalAttempts}`);
    lastFailures = await runAttempt(
      options.url,
      options.timeoutMs,
      options.expectedVersion,
      options.expectedCommitSha
    );

    if (lastFailures.length === 0) {
      console.log('');
      console.log(`✅ Smoke passed on attempt ${attempt}/${totalAttempts}`);
      return;
    }

    if (attempt < totalAttempts) {
      console.log(
        `Waiting ${options.retryDelayMs}ms before retry (${lastFailures.length} failing checks)...`
      );
      console.log('');
      await sleep(options.retryDelayMs);
    }
  }

  console.error('');
  console.error(
    `❌ Smoke failed after ${totalAttempts} attempt${totalAttempts > 1 ? 's' : ''}:`
  );
  for (const failure of lastFailures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(
    `❌ vercel post-deploy smoke failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
