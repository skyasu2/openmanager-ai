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

    checkCloudBuildFreeTierGuard(
      {
        files: ['src/app/page.tsx'],
        isKnown: true,
      },
      '/repo',
      false
    );

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
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    expect(() =>
      checkCloudBuildFreeTierGuard(
        {
          files: [],
          isKnown: false,
        },
        '/repo',
        false
      )
    ).toThrow('process.exit:1');

    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️  Cloud Build guard running in fail-closed mode (changed files unknown)'
    );
    expect(logSpy).toHaveBeenCalledWith(
      '🛡️ Cloud Build free-tier guard check...'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
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

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() =>
      checkCloudBuildFreeTierGuard(
        {
          files: ['cloud-run/ai-engine/deploy.sh'],
          isKnown: true,
        },
        '/repo',
        false
      )
    ).not.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      '🛡️ Cloud Build free-tier guard check...'
    );
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
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    expect(() => checkEnvironment('/repo', () => false)).toThrow(
      'process.exit:1'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
