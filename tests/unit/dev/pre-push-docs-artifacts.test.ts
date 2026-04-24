/**
 * @vitest-environment node
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const {
  isLightweightArtifactFile,
  isDocsArtifactOnlyPush,
  validateChangedJsonArtifacts,
} = require('../../../scripts/hooks/pre-push-docs-artifacts');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'pre-push-docs-artifacts-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('pre-push docs artifacts helpers', () => {
  it('recognizes markdown and docs/reports JSON artifacts only', () => {
    expect(isLightweightArtifactFile('docs/guide.md')).toBe(true);
    expect(isLightweightArtifactFile('.claude/rules/ai-tools.md')).toBe(true);
    expect(isLightweightArtifactFile('AGENTS.md')).toBe(true);
    expect(isLightweightArtifactFile('reports/planning/status.json')).toBe(
      true
    );
    expect(isLightweightArtifactFile('src/app/page.tsx')).toBe(false);
    expect(isLightweightArtifactFile('public/data/app.json')).toBe(false);
  });

  it('detects docs-only pushes only when all files are lightweight artifacts', () => {
    expect(
      isDocsArtifactOnlyPush({
        isKnown: true,
        files: ['docs/guide.md', 'reports/planning/run.json'],
      })
    ).toBe(true);

    expect(
      isDocsArtifactOnlyPush({
        isKnown: true,
        files: ['docs/guide.md', 'src/app/page.tsx'],
      })
    ).toBe(false);
  });

  it('skips JSON validation when no json files changed', () => {
    expect(validateChangedJsonArtifacts(['docs/guide.md'], '/repo')).toEqual({
      ok: true,
      skipped: true,
      jsonFiles: [],
    });
  });

  it('fails when a changed json artifact is missing', () => {
    const cwd = createTempDir();

    expect(
      validateChangedJsonArtifacts(['reports/planning/missing.json'], cwd)
    ).toEqual({
      ok: false,
      reason: 'missing-json-artifact',
      file: 'reports/planning/missing.json',
    });
  });

  it('fails when a changed json artifact is invalid', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'docs'), { recursive: true });
    const target = join(cwd, 'docs', 'broken.json');
    writeFileSync(target, '{invalid', 'utf8');

    const result = validateChangedJsonArtifacts(['docs/broken.json'], cwd);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-json-artifact');
    expect(result.file).toBe('docs/broken.json');
    expect(result.message).toBeTruthy();
  });

  it('passes when all changed json artifacts are valid', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'planning'), { recursive: true });
    const target = join(cwd, 'reports', 'planning', 'qa.json');
    writeFileSync(target, '{"ok":true}', 'utf8');

    expect(
      validateChangedJsonArtifacts(['reports/planning/qa.json'], cwd)
    ).toEqual({
      ok: true,
      skipped: false,
      jsonFiles: ['reports/planning/qa.json'],
    });
  });
});
