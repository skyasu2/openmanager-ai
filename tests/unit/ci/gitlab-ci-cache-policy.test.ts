/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const REPO_ROOT = process.cwd();

type CacheAnchor = {
  cache?: {
    key?: unknown;
  };
};

describe('GitLab CI npm cache policy', () => {
  it('uses stable npm HTTP cache keys that survive release version bumps', () => {
    const ci = YAML.parse(
      readFileSync(join(REPO_ROOT, '.gitlab-ci.yml'), 'utf8')
    ) as Record<string, unknown> & {
      variables?: {
        NPM_CONFIG_CACHE?: string;
      };
    };

    const rootCache = ci['.npm_cache'] as CacheAnchor;
    const rootReadonlyCache = ci['.npm_cache_readonly'] as CacheAnchor;
    const aiEngineCache = ci['.ai_engine_npm_cache'] as CacheAnchor;

    expect(ci.variables?.NPM_CONFIG_CACHE).toBe('$CI_PROJECT_DIR/.npm');

    expect(rootCache.cache?.key).toBe('npm-root-http-v1');
    expect(rootReadonlyCache.cache?.key).toBe('npm-root-http-v1');
    expect(aiEngineCache.cache?.key).toBe('npm-ai-engine-http-v1');

    expect(rootCache.cache?.key).not.toHaveProperty('files');
    expect(rootReadonlyCache.cache?.key).not.toHaveProperty('files');
    expect(aiEngineCache.cache?.key).not.toHaveProperty('files');
  });
});
