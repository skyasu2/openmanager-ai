#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 8000;

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

function parseArgs(argv) {
  const options = {
    url: normalizeUrl(process.env.VERCEL_QA_URL || process.env.CI_ENVIRONMENT_URL),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    expectedVersion: String(process.env.EXPECTED_APP_VERSION || '').trim(),
    expectedCommitSha: String(
      process.env.EXPECTED_COMMIT_SHA || process.env.CI_COMMIT_SHA || ''
    ).trim(),
    expectedReleaseTag: String(
      process.env.EXPECTED_RELEASE_TAG || process.env.CI_COMMIT_TAG || ''
    ).trim(),
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--json') {
      options.json = true;
      continue;
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
      continue;
    }

    if (arg.startsWith('--expected-release-tag=')) {
      options.expectedReleaseTag = String(
        arg.slice('--expected-release-tag='.length)
      ).trim();
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/qa/check-vercel-deployment-drift.mjs [options]

Options:
  --url=<url>                   Target deployment URL
  --timeout-ms=<number>         Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --expected-version=<version>  Expected /api/version buildVersion or version
  --expected-commit-sha=<sha>   Expected /api/version commitSha
  --expected-release-tag=<tag>  Expected /api/version releaseTag
  --json                        Emit machine-readable JSON summary
  --help, -h                    Show help
`);
}

async function requestVersion(baseUrl, timeoutMs) {
  const response = await fetch(`${baseUrl}/api/version`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error(`expected HTTP 200 from /api/version, got ${response.status}`);
  }

  try {
    return body ? JSON.parse(body) : null;
  } catch {
    throw new Error('expected valid JSON body from /api/version');
  }
}

function getActualVersion(payload) {
  if (
    typeof payload?.buildVersion === 'string' &&
    payload.buildVersion.trim().length > 0
  ) {
    return payload.buildVersion.trim();
  }

  return typeof payload?.version === 'string' ? payload.version.trim() : '';
}

function compareDeployment(payload, options) {
  const actual = {
    version: getActualVersion(payload),
    commitSha: typeof payload?.commitSha === 'string' ? payload.commitSha.trim() : '',
    releaseTag:
      typeof payload?.releaseTag === 'string' ? payload.releaseTag.trim() : '',
  };

  const mismatches = [];

  if (options.expectedVersion && actual.version !== options.expectedVersion) {
    mismatches.push({
      field: 'version',
      expected: options.expectedVersion,
      actual: actual.version || 'unknown',
    });
  }

  if (
    options.expectedCommitSha &&
    actual.commitSha !== options.expectedCommitSha
  ) {
    mismatches.push({
      field: 'commitSha',
      expected: options.expectedCommitSha,
      actual: actual.commitSha || 'unknown',
    });
  }

  if (
    options.expectedReleaseTag &&
    actual.releaseTag !== options.expectedReleaseTag
  ) {
    mismatches.push({
      field: 'releaseTag',
      expected: options.expectedReleaseTag,
      actual: actual.releaseTag || 'unknown',
    });
  }

  return {
    status: mismatches.length > 0 ? 'deployment drift' : 'ok',
    actual,
    mismatches,
  };
}

function printSummary(summary, options) {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`deployment status: ${summary.status}`);
  console.log(`- version: ${summary.actual.version || 'unknown'}`);
  console.log(`- commitSha: ${summary.actual.commitSha || 'unknown'}`);
  console.log(`- releaseTag: ${summary.actual.releaseTag || 'unknown'}`);

  for (const mismatch of summary.mismatches) {
    console.log(
      `- mismatch ${mismatch.field}: expected ${mismatch.expected}, got ${mismatch.actual}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.url) {
    console.error('missing target URL. Use --url=<url>.');
    process.exit(1);
  }

  const payload = await requestVersion(options.url, options.timeoutMs);
  const summary = compareDeployment(payload, options);
  printSummary(summary, options);

  process.exit(summary.mismatches.length > 0 ? 2 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
