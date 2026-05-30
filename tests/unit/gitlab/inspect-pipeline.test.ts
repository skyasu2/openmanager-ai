/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'gitlab',
  'inspect-pipeline.sh'
);

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createFakeCurl(binDir: string) {
  const curlPath = join(binDir, 'curl');
  writeFileSync(
    curlPath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'url="$' + '{@: -1}"',
      'case "$url" in',
      '  */pipelines/42)',
      "    cat <<'JSON'",
      JSON.stringify({
        id: 42,
        status: 'success',
        ref: 'v8.12.87',
        sha: 'abc123',
        source: 'push',
        duration: 120,
        updated_at: '2026-05-30T13:02:00.000Z',
        web_url: 'https://gitlab.example/pipelines/42',
      }),
      'JSON',
      '    ;;',
      '  */pipelines/42/jobs\\?*)',
      "    cat <<'JSON'",
      JSON.stringify([
        {
          id: 100,
          name: 'deploy',
          stage: 'deploy',
          status: 'success',
          runner: { description: 'wsl2-docker' },
          queued_duration: 1,
          duration: 10,
          started_at: '2026-05-30T13:00:00.000Z',
          finished_at: '2026-05-30T13:00:10.000Z',
          web_url: 'https://gitlab.example/jobs/100',
        },
        {
          id: 101,
          name: 'deploy_ai_engine',
          stage: 'deploy',
          status: 'success',
          runner: { description: 'wsl2-docker' },
          queued_duration: 2,
          duration: 10,
          started_at: '2026-05-30T13:00:02.000Z',
          finished_at: '2026-05-30T13:00:12.000Z',
          web_url: 'https://gitlab.example/jobs/101',
        },
      ]),
      'JSON',
      '    ;;',
      '  */resource_groups\\?*)',
      "    printf '[]\\n'",
      '    ;;',
      '  *)',
      '    echo "unexpected url: $url" >&2',
      '    exit 9',
      '    ;;',
      'esac',
      '',
    ].join('\n'),
    'utf8'
  );
  chmodSync(curlPath, 0o755);
}

describe('inspect-pipeline script', () => {
  it('prints release timing and deploy overlap diagnostics', () => {
    const tempDir = createTempDir('inspect-pipeline-');
    const binDir = join(tempDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    createFakeCurl(binDir);

    const result = spawnSync(
      'bash',
      [SCRIPT_PATH, '--pipeline', '42', '--remote', 'gitlab'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          GITLAB_TOKEN: 'test-token',
          GITLAB_PROJECT_URL: 'skyasu2/openmanager-ai',
          GITLAB_API_BASE_URL: 'https://gitlab.example/api/v4',
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
      }
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('duration=120');
    expect(result.stdout).toContain(
      'job id=100 name=deploy stage=deploy status=success'
    );
    expect(result.stdout).toContain('duration=10');
    expect(result.stdout).toContain('started_at=2026-05-30T13:00:00.000Z');
    expect(result.stdout).toContain('Timing Summary');
    expect(result.stdout).toContain(
      'stage_timing stage=deploy jobs=2 wall=12s duration_sum=20s'
    );
    expect(result.stdout).toContain(
      'deploy_parallelism jobs=2 start_delta=2s overlap=8s note=overlap_detected'
    );
  });
});
