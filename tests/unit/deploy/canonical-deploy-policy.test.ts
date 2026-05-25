/**
 * @vitest-environment node
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

describe('canonical deploy policy', () => {
  it('does not expose local Vercel production fallback scripts', () => {
    const packageJson = JSON.parse(
      readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    const scripts = packageJson.scripts ?? {};

    expect(scripts).not.toHaveProperty('deploy:safe');
    expect(scripts).not.toHaveProperty('deploy:smart');
    expect(scripts).not.toHaveProperty('deploy:guard:canonical');
    expect(Object.values(scripts).join('\n')).not.toMatch(
      /\bnpx\s+vercel\s+--prod\b|\bvercel\s+--prod\b/
    );
  });

  it('keeps removed fallback shell entrypoints absent', () => {
    expect(
      existsSync(
        join(REPO_ROOT, 'scripts/deploy/deploy-with-runner-fallback.sh')
      )
    ).toBe(false);
    expect(
      existsSync(join(REPO_ROOT, 'scripts/deploy/guard-canonical-deploy.sh'))
    ).toBe(false);
  });

  it('keeps degraded single fallback disabled by default in Cloud Run deploys', () => {
    const deployScript = readFileSync(
      join(REPO_ROOT, 'cloud-run/ai-engine/deploy.sh'),
      'utf8'
    );

    expect(deployScript).toContain(
      'ALLOW_DEGRADED_SINGLE=${ALLOW_DEGRADED_SINGLE:-false}'
    );
    expect(deployScript).not.toContain('ALLOW_DEGRADED_SINGLE=true');
  });
});
