/**
 * Pre-push root artifact audit guard
 * Pure function — no side effects, no process.exit
 */

'use strict';

function checkRootArtifactAudit({ skip = false, runNpm }) {
  if (skip) {
    return {
      ok: true,
      status: 'skipped',
      reason: 'skip-root-artifact-audit-env',
    };
  }

  if (typeof runNpm !== 'function') {
    throw new Error('checkRootArtifactAudit requires runNpm function');
  }

  const success = runNpm(['run', 'root:artifacts:audit:strict']);
  if (!success) {
    return {
      ok: false,
      status: 'failed',
      reason: 'root-artifact-audit-failed',
    };
  }

  return {
    ok: true,
    status: 'passed',
  };
}

module.exports = {
  checkRootArtifactAudit,
};
