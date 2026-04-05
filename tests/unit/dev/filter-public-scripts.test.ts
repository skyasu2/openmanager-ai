/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/sync/filter-public-scripts.js');

const tempDirs: string[] = [];

function makeTempPkg(scripts: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'filter-scripts-test-'));
  tempDirs.push(dir);
  const pkgPath = join(dir, 'package.json');
  writeFileSync(
    pkgPath,
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts }, null, 2),
    'utf8'
  );
  return pkgPath;
}

function run(
  pkgPath: string,
  allowlist: string[],
  overrides?: Record<string, string>
) {
  const args = [SCRIPT, pkgPath, JSON.stringify(allowlist)];
  if (overrides) {
    args.push(JSON.stringify(overrides));
  }
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('filter-public-scripts', () => {
  it('keeps only scripts in the allowlist', () => {
    const pkgPath = makeTempPkg({
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      'type-check': 'tsc --noEmit',
      lint: 'biome check',
      format: 'biome format --write .',
      test: 'vitest run',
      'test:e2e': 'playwright test',
      'docs:check': 'node scripts/docs/check.js',
      'sync:github': 'bash scripts/sync/github-sync.sh',
    });

    const result = run(pkgPath, [
      'dev',
      'build',
      'start',
      'type-check',
      'lint',
      'format',
    ]);
    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(Object.keys(pkg.scripts).sort()).toEqual([
      'build',
      'dev',
      'format',
      'lint',
      'start',
      'type-check',
    ]);
    // Values preserved from original
    expect(pkg.scripts.dev).toBe('next dev');
    expect(pkg.scripts.lint).toBe('biome check');
  });

  it('applies public-safe overrides when provided', () => {
    const pkgPath = makeTempPkg({
      dev: "cross-env NODE_OPTIONS='--max-old-space-size=4096' next dev -p 3000",
      lint: 'bash scripts/dev/biome-wrapper.sh lint .',
      format: 'bash scripts/dev/biome-wrapper.sh format --write .',
      'type-check': 'node scripts/dev/tsc-wrapper.js --noEmit',
    });

    const result = run(pkgPath, ['dev', 'lint', 'format', 'type-check'], {
      lint: 'biome lint .',
      format: 'biome format --write .',
      'type-check': 'tsc --noEmit',
    });

    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts.dev).toBe(
      "cross-env NODE_OPTIONS='--max-old-space-size=4096' next dev -p 3000"
    );
    expect(pkg.scripts.lint).toBe('biome lint .');
    expect(pkg.scripts.format).toBe('biome format --write .');
    expect(pkg.scripts['type-check']).toBe('tsc --noEmit');
  });

  it('excludes internal/sensitive scripts', () => {
    const pkgPath = makeTempPkg({
      dev: 'next dev',
      'sync:github': 'bash scripts/sync/github-sync.sh',
      'release:patch': 'commit-and-tag-version --release-as patch',
      'hook:pre-push': 'node scripts/hooks/pre-push.js',
      'ci:local:docker': 'bash scripts/ci/local-docker-ci.sh',
    });

    const result = run(pkgPath, ['dev', 'build', 'start']);
    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(Object.keys(pkg.scripts)).toEqual(['dev']);
    expect(pkg.scripts).not.toHaveProperty('sync:github');
    expect(pkg.scripts).not.toHaveProperty('release:patch');
    expect(pkg.scripts).not.toHaveProperty('hook:pre-push');
  });

  it('results in empty scripts when allowlist has no matches', () => {
    const pkgPath = makeTempPkg({
      test: 'vitest run',
      'docs:check': 'node scripts/docs/check.js',
    });

    const result = run(pkgPath, ['dev', 'build']);
    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts).toEqual({});
  });

  it('handles empty scripts object gracefully', () => {
    const pkgPath = makeTempPkg({});
    const result = run(pkgPath, ['dev', 'build']);
    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts).toEqual({});
  });

  it('preserves non-scripts fields untouched', () => {
    const pkgPath = makeTempPkg({ dev: 'next dev', test: 'vitest run' });

    const result = run(pkgPath, ['dev']);
    expect(result.status).toBe(0);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.name).toBe('fixture');
    expect(pkg.version).toBe('1.0.0');
  });

  it('exits with error when arguments are missing', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });
});
