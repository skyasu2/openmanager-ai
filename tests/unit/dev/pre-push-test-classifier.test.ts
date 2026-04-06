/**
 * @vitest-environment node
 */

import * as path from 'path';
import { describe, expect, it } from 'vitest';

const {
  classifyChangedTestRun,
} = require('../../../scripts/hooks/pre-push-test-classifier');

const CWD = '/project';
const CLOUD_RUN_CWD = path.join(CWD, 'cloud-run/ai-engine');
const EMPTY_MANIFEST = { pathPrefixes: [], exactFiles: new Set<string>() };

function run(
  files: string[],
  {
    isWSL = false,
    isWindowsFS = false,
    manifest = EMPTY_MANIFEST,
  }: {
    isWSL?: boolean;
    isWindowsFS?: boolean;
    manifest?: typeof EMPTY_MANIFEST;
  } = {}
) {
  return classifyChangedTestRun(
    { isKnown: true, files },
    manifest,
    isWSL,
    isWindowsFS,
    CLOUD_RUN_CWD
  );
}

describe('classifyChangedTestRun', () => {
  it('returns null when no files changed', () => {
    expect(run([])).toBeNull();
  });

  it('returns null when changed files are not known', () => {
    const result = classifyChangedTestRun(
      { isKnown: false, files: [] },
      EMPTY_MANIFEST,
      false,
      false,
      CLOUD_RUN_CWD
    );
    expect(result).toBeNull();
  });

  it('routes cloud-run test file to targeted node suite', () => {
    const result = run(['cloud-run/ai-engine/src/agents/nlq.test.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('cloud-run targeted node');
    const step = result.steps[0];
    expect(step.runner).toBe('npx');
    expect(step.args).toContain('vitest');
    expect(step.cwd).toBe(CLOUD_RUN_CWD);
  });

  it('routes cloud-run source file to related node suite', () => {
    const result = run(['cloud-run/ai-engine/src/agents/nlq.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('cloud-run related node');
    const step = result.steps[0];
    expect(step.runner).toBe('npx');
    expect(step.args).toContain('related');
  });

  it('routes node test file to targeted node suite', () => {
    const result = run(['tests/unit/dev/foo.test.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('targeted node');
    expect(result.steps[0].args).toContain('test:node');
  });

  it('routes src source file to related node + DOM suites', () => {
    const result = run(['src/lib/util.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('source-related node + DOM');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].args).toContain('test:related:node');
    expect(result.steps[1].args).toContain('test:related:dom');
  });

  it('routes src/types-only changes to quick smoke instead of related DOM', () => {
    const result = run(['src/types/common.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('type definition quick smoke');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].args).toContain('test:super-fast');
  });

  it('keeps non-type source files on related node + DOM even when src/types changes are mixed in', () => {
    const result = run(['src/types/common.ts', 'src/lib/util.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('source-related node + DOM');
    expect(result.mode).not.toContain('type definition quick smoke');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].args).toContain('test:related:node');
    expect(result.steps[1].args).toContain('test:related:dom');
  });

  it('routes playwright e2e file to quick smoke', () => {
    const result = run(['tests/e2e/dashboard.spec.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('playwright spec quick smoke');
    expect(result.steps[0].args).toContain('test:quick');
  });

  it('routes mixed DOM/node test files to super-fast smoke', () => {
    const domManifest = {
      pathPrefixes: ['tests/ai-sidebar/'],
      exactFiles: new Set<string>(['tests/dom/a.test.ts']),
    };
    const result = run(['tests/dom/a.test.ts', 'tests/unit/dev/b.test.ts'], {
      manifest: domManifest,
    });
    expect(result).not.toBeNull();
    expect(result.mode).toContain('mixed test quick smoke');
    expect(result.steps[0].args).toContain('test:super-fast');
  });

  it('routes DOM infra file to DOM infra smoke when no other steps', () => {
    const result = run(['config/testing/vitest.config.dom.ts']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('DOM infra smoke');
  });

  it('returns null for node-only test config changes', () => {
    const result = run(['config/testing/vitest.config.dev.ts']);
    expect(result).toBeNull();
  });

  it('returns null for package.json-only changes so runner can fall back to quick smoke', () => {
    const result = run(['package.json']);
    expect(result).toBeNull();
  });

  it('routes hook infra file to quick smoke when no other steps', () => {
    const result = run(['scripts/hooks/pre-push.js']);
    expect(result).not.toBeNull();
    expect(result.mode).toContain('hook infra quick smoke');
  });

  it('adds AI quick smoke for frontend smoke files on WSL+WindowsFS', () => {
    const result = run(['src/components/ai/ChatPanel.tsx'], {
      isWSL: true,
      isWindowsFS: true,
    });
    expect(result).not.toBeNull();
    expect(result.mode).toContain('AI assistant quick smoke');
    expect(result.steps[0].args).toContain('test:quick');
  });

  it('does NOT add AI quick smoke for frontend files on non-WSL', () => {
    const result = run(['src/components/ai/ChatPanel.tsx'], {
      isWSL: false,
      isWindowsFS: false,
    });
    // Non-WSL routes frontend smoke as source-related
    if (result) {
      expect(result.mode).not.toContain('AI assistant quick smoke');
    }
  });

  it('returns deduped guidance entries', () => {
    // Two playwright files should not produce duplicate guidance
    const result = run([
      'tests/e2e/dashboard.spec.ts',
      'tests/e2e/auth.spec.ts',
    ]);
    expect(result).not.toBeNull();
    const unique = new Set(result.guidance);
    expect(unique.size).toBe(result.guidance.length);
  });

  it('includes changed files in result.files', () => {
    const changed = ['src/lib/util.ts'];
    const result = run(changed);
    expect(result?.files).toContain('src/lib/util.ts');
  });
});
