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

type RulesAnchor = {
  rules?: Array<{
    if?: string;
    when?: string;
    allow_failure?: boolean;
  }>;
};

describe('GitLab CI policy', () => {
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

  it('keeps bundle budget out of automatic validate wall-clock', () => {
    const ci = YAML.parse(
      readFileSync(join(REPO_ROOT, '.gitlab-ci.yml'), 'utf8')
    ) as Record<string, unknown>;

    const bundleRules = (ci['.bundle_budget_changes'] as RulesAnchor).rules;

    expect(bundleRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          if: '$CI_PIPELINE_SOURCE == "schedule"',
          when: 'on_success',
        }),
        expect.objectContaining({
          if: '$CI_PIPELINE_SOURCE == "web"',
          when: 'manual',
          allow_failure: true,
        }),
        expect.objectContaining({
          if: '$CI_COMMIT_BRANCH == "main"',
          when: 'manual',
          allow_failure: true,
        }),
        expect.objectContaining({
          if: '$CI_COMMIT_BRANCH',
          when: 'manual',
          allow_failure: true,
        }),
      ])
    );

    const automaticBranchRules = bundleRules?.filter(
      (rule) =>
        rule.when === 'on_success' &&
        rule.if !== '$CI_PIPELINE_SOURCE == "schedule"'
    );
    expect(automaticBranchRules).toEqual([]);
  });
});
