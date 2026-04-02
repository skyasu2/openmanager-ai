/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../scripts/check-vercel-usage.js', import.meta.url)
);

const tempDirs: string[] = [];

function buildChildProcessEnv(
  tempDir: string,
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: tempDir,
    PATH: `${join(tempDir, 'bin')}:${process.env.PATH || ''}`,
    ...overrides,
  };

  for (const key of Object.keys(env)) {
    if (
      key === 'NODE_OPTIONS' ||
      key === 'NODE_V8_COVERAGE' ||
      key.startsWith('VITEST') ||
      key.startsWith('npm_')
    ) {
      delete env[key];
    }
  }

  return env;
}

function createTempWorkspace() {
  const tempDir = mkdtempSync(join(tmpdir(), 'check-vercel-usage-'));
  tempDirs.push(tempDir);
  mkdirSync(join(tempDir, 'bin'), { recursive: true });
  return tempDir;
}

function writeExecutable(
  tempDir: string,
  relativePath: string,
  content: string
) {
  const filePath = join(tempDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  chmodSync(filePath, 0o755);
  return filePath;
}

function installFakeCli(tempDir: string, vercelScriptBody: string) {
  writeExecutable(
    tempDir,
    'bin/vercel',
    `#!/usr/bin/env bash
set -euo pipefail
${vercelScriptBody}
`
  );

  writeExecutable(
    tempDir,
    'bin/npx',
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "vercel" ]]; then
  shift
  exec vercel "$@"
fi
echo "unsupported fake npx invocation: $*" >&2
exit 1
`
  );
}

function runScript(
  tempDir: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = {}
) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: tempDir,
    encoding: 'utf8',
    env: buildChildProcessEnv(tempDir, env),
  });
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('check-vercel-usage', () => {
  it('treats current-period 404 as empty usage when previous-month probe succeeds', () => {
    const tempDir = createTempWorkspace();
    const logPath = join(tempDir, 'vercel.log');

    installFakeCli(
      tempDir,
      `
printf '%s\\n' "$*" >> "$FAKE_VERCEL_LOG"
if [[ "$*" == *"--from 2026-03-01 --to 2026-03-31"* ]]; then
  cat <<'EOF'
{"period":{"from":"2026-03-01T08:00:00.000Z","to":"2026-04-01T07:00:00.000Z"},"context":"skyasus-projects","pricingUnit":"USD","totals":{"effectiveCost":23.7547,"billedCost":0},"chargeCount":18879}
EOF
  exit 0
fi
echo "Error: Costs not found (404)" >&2
exit 1
`
    );

    const result = runScript(tempDir, [], {
      FAKE_VERCEL_LOG: logPath,
      VERCEL_USAGE_REFERENCE_DATE: '2026-04-02T05:56:01Z',
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'PASS VERCEL-USAGE no charge records found yet for the current billing period'
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Previous month probe (2026-03-01..2026-03-31)'
    );

    const loggedInvocations = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(loggedInvocations).toEqual([
      'usage --format json --non-interactive',
      'usage --format json --non-interactive --from 2026-03-01 --to 2026-03-31',
    ]);
  });

  it('passes requested custom ranges that have no charge rows without probing other periods', () => {
    const tempDir = createTempWorkspace();
    const logPath = join(tempDir, 'vercel.log');

    installFakeCli(
      tempDir,
      `
printf '%s\\n' "$*" >> "$FAKE_VERCEL_LOG"
echo "Error: Costs not found (404)" >&2
exit 1
`
    );

    const result = runScript(
      tempDir,
      ['--from', '2026-04-01', '--to', '2026-04-02'],
      { FAKE_VERCEL_LOG: logPath }
    );

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'PASS VERCEL-USAGE no charge records found for the requested range.'
    );

    const loggedInvocations = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(loggedInvocations).toEqual([
      'usage --format json --non-interactive --from 2026-04-01 --to 2026-04-02',
    ]);
  });
});
