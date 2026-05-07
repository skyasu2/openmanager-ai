import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLocalEnvFileCandidates } from '../../scripts/_env';
import { getRuntimeEnvFileCandidates } from './env-loader';

describe('getRuntimeEnvFileCandidates', () => {
  it('loads AI Engine env files before root env files', () => {
    const repoRoot = '/repo/openmanager-ai';
    const libDir = path.join(repoRoot, 'cloud-run/ai-engine/src/lib');
    const cwd = repoRoot;

    const candidates = getRuntimeEnvFileCandidates({
      cwd,
      envFile: '/tmp/explicit.env',
      libDir,
    });

    expect(candidates.slice(0, 7)).toEqual([
      '/tmp/explicit.env',
      path.join(repoRoot, 'cloud-run/ai-engine/.env.local'),
      path.join(repoRoot, 'cloud-run/ai-engine/.env'),
      path.join(repoRoot, 'cloud-run/.env.local'),
      path.join(repoRoot, 'cloud-run/.env'),
      path.join(repoRoot, '.env.local'),
      path.join(repoRoot, '.env'),
    ]);
    expect(
      candidates.indexOf(path.join(repoRoot, 'cloud-run/ai-engine/.env'))
    ).toBeLessThan(candidates.indexOf(path.join(repoRoot, '.env.local')));
  });
});

describe('getLocalEnvFileCandidates', () => {
  it('keeps script env loading aligned with runtime env loading', () => {
    const repoRoot = '/repo/openmanager-ai';
    const scriptDir = path.join(repoRoot, 'cloud-run/ai-engine/scripts');
    const cwd = repoRoot;

    const candidates = getLocalEnvFileCandidates({
      cwd,
      envFile: '/tmp/explicit.env',
      scriptDir,
    });

    expect(candidates.slice(0, 7)).toEqual([
      '/tmp/explicit.env',
      path.join(repoRoot, 'cloud-run/ai-engine/.env.local'),
      path.join(repoRoot, 'cloud-run/ai-engine/.env'),
      path.join(repoRoot, 'cloud-run/.env.local'),
      path.join(repoRoot, 'cloud-run/.env'),
      path.join(repoRoot, '.env.local'),
      path.join(repoRoot, '.env'),
    ]);
    expect(
      candidates.indexOf(path.join(repoRoot, 'cloud-run/ai-engine/.env'))
    ).toBeLessThan(
      candidates.indexOf(path.join(repoRoot, '.env.local'))
    );
  });
});
