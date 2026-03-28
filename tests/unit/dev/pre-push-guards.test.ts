/**
 * @vitest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  checkCloudBuildFreeTierGuard,
  checkNodeModules,
  checkEnvironment,
} = require('../../../scripts/hooks/pre-push-guards');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pre-push guards', () => {
  it('skips Cloud Build guard when changed files are known and unrelated', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = checkCloudBuildFreeTierGuard(
      {
        files: ['src/app/page.tsx'],
        isKnown: true,
      },
      '/repo',
      false
    );

    expect(result).toEqual({ ok: true, skipped: true });
    expect(logSpy).toHaveBeenCalledWith(
      '⚪ Cloud Build guard skipped (ai-engine deploy files unchanged)'
    );
    expect(existsSpy).not.toHaveBeenCalled();
  });

  it('fails closed when changed files are unknown and free-tier guardrails are broken', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(
      (filePath: fs.PathOrFileDescriptor) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        if (normalized.endsWith('/cloud-run/ai-engine/cloudbuild.yaml')) {
          return 'options:\n  machineType: E2_HIGHCPU_8\n';
        }
        if (normalized.endsWith('/cloud-run/ai-engine/deploy.sh')) {
          return '#!/usr/bin/env bash\n# guard strings intentionally missing\n';
        }
        throw new Error(`Unexpected readFileSync path: ${normalized}`);
      }
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('should not exit inside guard');
    });

    const result = checkCloudBuildFreeTierGuard(
      {
        files: [],
        isKnown: false,
      },
      '/repo',
      false
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️  Cloud Build guard running in fail-closed mode (changed files unknown)'
    );
    expect(logSpy).toHaveBeenCalledWith(
      '🛡️ Cloud Build free-tier guard check...'
    );
    expect(result).toEqual({
      ok: false,
      reason: 'cloud-build-free-tier-guard',
      failures: [
        'cloud-run/ai-engine/cloudbuild.yaml contains machineType in active config',
        'cloud-run/ai-engine/cloudbuild.yaml contains highcpu machine type in active config',
        'cloud-run/ai-engine/deploy.sh missing BUILD_CMD forbidden-arg guard',
        'cloud-run/ai-engine/deploy.sh missing DEPLOY_CMD forbidden-arg guard',
        'cloud-run/ai-engine/deploy.sh missing free-tier guard enforcement',
      ],
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('ignores commented machineType lines when deploy guard strings are present', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(
      (filePath: fs.PathOrFileDescriptor) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        if (normalized.endsWith('/cloud-run/ai-engine/cloudbuild.yaml')) {
          return '# machineType: E2_HIGHCPU_8\nsteps:\n  - name: gcr.io/cloud-builders/docker\n';
        }
        if (normalized.endsWith('/cloud-run/ai-engine/deploy.sh')) {
          return [
            '#!/usr/bin/env bash',
            'assert_no_forbidden_args "$' + '{BUILD_CMD[@]}"',
            'assert_no_forbidden_args "$' + '{DEPLOY_CMD[@]}"',
            'enforce_free_tier_guards',
          ].join('\n');
        }
        throw new Error(`Unexpected readFileSync path: ${normalized}`);
      }
    );

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('should not exit inside guard');
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = checkCloudBuildFreeTierGuard(
      {
        files: ['cloud-run/ai-engine/deploy.sh'],
        isKnown: true,
      },
      '/repo',
      false
    );

    expect(logSpy).toHaveBeenCalledWith(
      '🛡️ Cloud Build free-tier guard check...'
    );
    expect(result).toEqual({ ok: true });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('returns false when critical node modules are missing', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((target) => {
      const normalized = String(target).replace(/\\/g, '/');
      return normalized.endsWith('/node_modules/typescript');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(checkNodeModules('/repo', false, false, false, false)).toBe(false);
  });

  it('exits when env:check exists and npm validation fails', () => {
    const pkgPath = path.join('/repo', 'package.json');
    vi.spyOn(fs, 'readFileSync').mockImplementation(
      (filePath: fs.PathOrFileDescriptor) => {
        if (String(filePath) === pkgPath) {
          return JSON.stringify({
            scripts: {
              'env:check': 'echo checking',
            },
          });
        }
        throw new Error(`Unexpected readFileSync path: ${String(filePath)}`);
      }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('should not exit inside guard');
    });

    expect(checkEnvironment('/repo', () => false)).toEqual({
      ok: false,
      reason: 'environment-check',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
