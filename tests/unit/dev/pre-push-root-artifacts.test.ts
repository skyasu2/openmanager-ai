/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const {
  checkRootArtifactAudit,
} = require('../../../scripts/hooks/pre-push-root-artifacts');

describe('checkRootArtifactAudit', () => {
  it('skips when skip flag is enabled', () => {
    const runNpm = vi.fn(() => true);
    const result = checkRootArtifactAudit({ skip: true, runNpm });

    expect(result).toEqual({
      ok: true,
      status: 'skipped',
      reason: 'skip-root-artifact-audit-env',
    });
    expect(runNpm).not.toHaveBeenCalled();
  });

  it('passes when npm guard command succeeds', () => {
    const runNpm = vi.fn(() => true);
    const result = checkRootArtifactAudit({ runNpm });

    expect(result).toEqual({
      ok: true,
      status: 'passed',
    });
    expect(runNpm).toHaveBeenCalledWith(['run', 'root:artifacts:audit:strict']);
  });

  it('fails when npm guard command fails', () => {
    const runNpm = vi.fn(() => false);
    const result = checkRootArtifactAudit({ runNpm });

    expect(result).toEqual({
      ok: false,
      status: 'failed',
      reason: 'root-artifact-audit-failed',
    });
  });
});
