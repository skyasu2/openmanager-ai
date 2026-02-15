#!/usr/bin/env node
/**
 * Cloud Deployment Essential Smoke Test (Low-Cost)
 *
 * Goal:
 * - Validate minimum production readiness with near-zero usage cost.
 * - Default mode never calls LLM generation endpoints.
 *
 * Default checks (0 LLM calls):
 * 1) GET /health
 * 2) GET /warmup
 * 3) GET /api/ai/supervisor/health (only when API key is available)
 *
 * Optional check (1 LLM call):
 * - POST /api/ai/supervisor (--with-supervisor-call)
 */

const DEFAULT_TIMEOUT_MS = 7000;

/**
 * @typedef {{
 *   url: string;
 *   apiKey: string;
 *   timeoutMs: number;
 *   requireAuth: boolean;
 *   withSupervisorCall: boolean;
 * }} CliOptions
 */

/**
 * @param {string[]} argv
 * @returns {CliOptions}
 */
function parseArgs(argv) {
  /** @type {CliOptions} */
  const options = {
    url: process.env.CLOUD_RUN_AI_URL || '',
    apiKey: process.env.CLOUD_RUN_API_SECRET || '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    requireAuth: false,
    withSupervisorCall: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--require-auth') {
      options.requireAuth = true;
      continue;
    }

    if (arg === '--with-supervisor-call') {
      options.withSupervisorCall = true;
      continue;
    }

    if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length);
      continue;
    }

    if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.slice('--api-key='.length);
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      const value = Number.parseInt(arg.slice('--timeout-ms='.length), 10);
      if (!Number.isNaN(value) && value > 0) {
        options.timeoutMs = value;
      }
      continue;
    }
  }

  options.url = options.url.trim().replace(/\/+$/, '');
  options.apiKey = options.apiKey.trim();
  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/test/cloud-deploy-essential-smoke.mjs [options]

Options:
  --url=<cloud-run-url>          Target URL (default: CLOUD_RUN_AI_URL)
  --api-key=<secret>             API key (default: CLOUD_RUN_API_SECRET)
  --timeout-ms=<number>          Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --require-auth                 Fail when API key is missing
  --with-supervisor-call         Run exactly one /api/ai/supervisor call (costs tokens)
  --help, -h                     Show help

Examples:
  npm run test:cloud:essential -- --url=https://ai-engine-xxx.run.app
  npm run test:cloud:essential:strict -- --url=https://ai-engine-xxx.run.app
  npm run test:cloud:essential:llm-once -- --url=https://ai-engine-xxx.run.app
`);
}

/**
 * @param {string} url
 * @returns {string}
 */
function maskUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {{
 *   method?: string;
 *   timeoutMs: number;
 *   apiKey?: string;
 *   body?: unknown;
 * }} options
 * @returns {Promise<{status: number; json: unknown; rawText: string}>}
 */
async function requestJson(baseUrl, path, options) {
  const method = options.method || 'GET';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (options.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  const rawText = await response.text();
  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, rawText };
}

/**
 * @param {string} name
 * @param {() => Promise<void>} fn
 * @param {{ passed: number; failed: number; skipped: number }} counters
 */
async function runCase(name, fn, counters) {
  process.stdout.write(`- ${name} ... `);
  try {
    await fn();
    counters.passed += 1;
    console.log('PASS');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SKIP:')) {
      counters.skipped += 1;
      console.log(`SKIP (${error.message.replace('SKIP:', '').trim()})`);
      return;
    }
    counters.failed += 1;
    console.log(
      `FAIL (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.url) {
    console.error(
      '❌ CLOUD_RUN_AI_URL 또는 --url 인자가 필요합니다. (--help 참고)'
    );
    process.exit(1);
  }

  if (options.requireAuth && !options.apiKey) {
    console.error(
      '❌ --require-auth 모드에서는 CLOUD_RUN_API_SECRET 또는 --api-key가 필요합니다.'
    );
    process.exit(1);
  }

  console.log('Cloud Deployment Essential Smoke Test');
  console.log(`- target: ${maskUrl(options.url)}`);
  console.log(`- auth check: ${options.apiKey ? 'enabled' : 'disabled'}`);
  console.log(`- supervisor call: ${options.withSupervisorCall ? '1 call' : '0 calls'}`);
  console.log(`- timeout: ${options.timeoutMs}ms`);
  console.log('');

  const counters = { passed: 0, failed: 0, skipped: 0 };

  await runCase(
    'GET /health',
    async () => {
      const { status, json } = await requestJson(options.url, '/health', {
        timeoutMs: options.timeoutMs,
      });
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        json && typeof json === 'object' && json.status === 'ok',
        'body.status must be "ok"'
      );
    },
    counters
  );

  await runCase(
    'GET /warmup',
    async () => {
      const { status, json } = await requestJson(options.url, '/warmup', {
        timeoutMs: options.timeoutMs,
      });
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        json && typeof json === 'object' && json.status === 'warmed_up',
        'body.status must be "warmed_up"'
      );
    },
    counters
  );

  await runCase(
    'GET /api/ai/supervisor/health (authenticated)',
    async () => {
      if (!options.apiKey) {
        throw new Error('SKIP: no API key provided');
      }
      const { status, json } = await requestJson(
        options.url,
        '/api/ai/supervisor/health',
        {
          timeoutMs: options.timeoutMs,
          apiKey: options.apiKey,
        }
      );
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        json && typeof json === 'object' && json.success === true,
        'body.success must be true'
      );
    },
    counters
  );

  if (options.withSupervisorCall) {
    await runCase(
      'POST /api/ai/supervisor (single low-cost request)',
      async () => {
        if (!options.apiKey) {
          throw new Error('missing API key for supervisor call');
        }

        const { status, json } = await requestJson(
          options.url,
          '/api/ai/supervisor',
          {
            method: 'POST',
            timeoutMs: Math.max(options.timeoutMs, 15000),
            apiKey: options.apiKey,
            body: {
              messages: [
                {
                  role: 'user',
                  content: '상태 요약 1줄',
                },
              ],
              sessionId: `smoke-${Date.now()}`,
              enableWebSearch: false,
            },
          }
        );

        assert(status === 200, `expected 200, got ${status}`);
        assert(
          json && typeof json === 'object' && json.success === true,
          'body.success must be true'
        );
      },
      counters
    );
  }

  const total = counters.passed + counters.failed + counters.skipped;
  console.log('');
  console.log('Summary');
  console.log(`- total: ${total}`);
  console.log(`- passed: ${counters.passed}`);
  console.log(`- skipped: ${counters.skipped}`);
  console.log(`- failed: ${counters.failed}`);
  console.log(
    `- estimated LLM calls: ${options.withSupervisorCall ? '1' : '0'}`
  );

  if (counters.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Smoke test crashed:', error);
  process.exit(1);
});
