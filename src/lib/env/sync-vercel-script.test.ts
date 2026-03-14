/**
 * @vitest-environment node
 */

import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../scripts/env/sync-vercel.sh', import.meta.url)
);
const tempDirs: string[] = [];

function createFakeVercel(tempDir: string) {
  const logPath = join(tempDir, 'vercel.log');
  const binPath = join(tempDir, 'fake-vercel');

  writeFileSync(
    binPath,
    `#!/bin/bash
set -e
printf "%s\\n" "$*" >> "${logPath}"
cat >/dev/null || true
if [ -n "$FAIL_ON" ] && [[ "$*" == *"$FAIL_ON"* ]]; then
  exit 1
fi
`,
    'utf8'
  );
  chmodSync(binPath, 0o755);

  return { binPath, logPath };
}

function runSyncScript(
  envFileContent: string,
  options?: {
    environment?: 'preview' | 'production';
    failOn?: string;
  }
) {
  const tempDir = mkdtempSync(join(tmpdir(), 'sync-vercel-'));
  tempDirs.push(tempDir);
  writeFileSync(join(tempDir, '.env.local'), envFileContent, 'utf8');

  const { binPath, logPath } = createFakeVercel(tempDir);
  const result = spawnSync(
    'bash',
    [SCRIPT_PATH, options?.environment ?? 'preview'],
    {
      cwd: tempDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dirname(binPath)}:${process.env.PATH || ''}`,
        VERCEL_BIN: binPath,
        FAIL_ON: options?.failOn || '',
      },
    }
  );

  return { ...result, logPath };
}

const REQUIRED_ENV_BLOCK = `
CLOUD_RUN_ENABLED=true
CLOUD_RUN_AI_URL=https://example.run.app
CLOUD_RUN_API_SECRET=cloud-secret
SESSION_SECRET=session-secret
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable-key
`.trim();

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('sync-vercel.sh', () => {
  it('fails fast when a required variable is missing locally', () => {
    const { status, stdout, stderr, logPath } = runSyncScript(`
CLOUD_RUN_AI_URL=https://example.run.app
CLOUD_RUN_API_SECRET=cloud-secret
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key
`.trim());

    expect(status).toBe(1);
    expect(`${stdout}${stderr}`).toContain(
      'CLOUD_RUN_ENABLED: 필수 변수인데 로컬에 값이 없습니다'
    );
    expect(existsSync(logPath)).toBe(false);
  });

  it('syncs variables with vercel env add --force without removing first', () => {
    const { status, stdout, stderr, logPath } =
      runSyncScript(REQUIRED_ENV_BLOCK);

    expect(status).toBe(0);
    expect(`${stdout}${stderr}`).toContain('✅ 동기화 완료!');

    const commands = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(commands).toHaveLength(7);
    expect(commands.every((line) => line.startsWith('env add '))).toBe(true);
    expect(commands.every((line) => line.endsWith(' --force'))).toBe(true);
    expect(commands.some((line) => line.includes('env rm'))).toBe(false);
  });

  it('exits with failure when vercel env add fails', () => {
    const { status, stdout, stderr, logPath } = runSyncScript(
      REQUIRED_ENV_BLOCK,
      {
        failOn: 'NEXT_PUBLIC_SUPABASE_ANON_KEY preview --force',
      }
    );

    expect(status).toBe(1);
    expect(`${stdout}${stderr}`).toContain(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY: 동기화 실패'
    );

    const commands = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(commands.some((line) => line.includes('env rm'))).toBe(false);
  });
});
