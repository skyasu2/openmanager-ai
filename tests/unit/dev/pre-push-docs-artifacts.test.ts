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
  isQaEvidenceIntegrityFile,
  shouldRunQaEvidenceIntegrityValidation,
  validateQaEvidenceIntegrityChanges,
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

  it('detects QA evidence integrity files that require strict audit', () => {
    expect(
      isQaEvidenceIntegrityFile(
        'reports/qa/evidence/legacy/2026/qa-console.log'
      )
    ).toBe(true);
    expect(
      isQaEvidenceIntegrityFile(
        'reports/qa/runs/2026/qa-run-QA-20260526-0614.json'
      )
    ).toBe(true);
    expect(isQaEvidenceIntegrityFile('reports/qa/QA_STATUS.md')).toBe(false);
    expect(isQaEvidenceIntegrityFile('docs/qa/evidence.md')).toBe(false);
  });

  it('requires QA evidence integrity validation for run or evidence changes', () => {
    expect(
      shouldRunQaEvidenceIntegrityValidation({
        isKnown: true,
        files: ['reports/qa/evidence/qa-20260526.png'],
      })
    ).toBe(true);
    expect(
      shouldRunQaEvidenceIntegrityValidation({
        isKnown: true,
        files: ['reports/qa/runs/2026/qa-run-QA-20260526-0614.json'],
      })
    ).toBe(true);
    expect(
      shouldRunQaEvidenceIntegrityValidation({
        isKnown: true,
        files: ['reports/qa/QA_STATUS.md'],
      })
    ).toBe(false);
    expect(
      shouldRunQaEvidenceIntegrityValidation({
        isKnown: false,
        files: ['reports/qa/evidence/qa-20260526.png'],
      })
    ).toBe(false);
  });

  it('blocks deletion of evidence that is still referenced by a QA run', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'qa', 'runs', '2026'), { recursive: true });
    writeFileSync(
      join(cwd, 'reports', 'qa', 'runs', '2026', 'qa-run-QA-1.json'),
      JSON.stringify({
        runId: 'QA-1',
        artifacts: [
          {
            path: 'reports/qa/evidence/deleted.png',
          },
        ],
      }),
      'utf8'
    );

    expect(
      validateQaEvidenceIntegrityChanges(
        ['reports/qa/evidence/deleted.png'],
        cwd
      )
    ).toEqual({
      ok: false,
      reason: 'referenced-evidence-deleted',
      file: 'reports/qa/evidence/deleted.png',
      runIds: ['QA-1'],
    });
  });

  it('allows deletion of evidence that is not referenced by any QA run', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'qa', 'runs', '2026'), { recursive: true });
    writeFileSync(
      join(cwd, 'reports', 'qa', 'runs', '2026', 'qa-run-QA-1.json'),
      JSON.stringify({
        runId: 'QA-1',
        artifacts: [
          {
            path: 'reports/qa/evidence/kept.png',
          },
        ],
      }),
      'utf8'
    );

    const result = validateQaEvidenceIntegrityChanges(
      ['reports/qa/evidence/deleted.png'],
      cwd
    );

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
  });

  it('blocks changed QA runs that reference missing evidence', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'qa', 'runs', '2026'), { recursive: true });
    const runPath = 'reports/qa/runs/2026/qa-run-QA-1.json';
    writeFileSync(
      join(cwd, runPath),
      JSON.stringify({
        runId: 'QA-1',
        artifacts: [
          {
            path: 'reports/qa/evidence/missing.png',
          },
        ],
      }),
      'utf8'
    );

    expect(validateQaEvidenceIntegrityChanges([runPath], cwd)).toEqual({
      ok: false,
      reason: 'run-references-missing-evidence',
      file: runPath,
      artifactPath: 'reports/qa/evidence/missing.png',
    });
  });

  it('blocks changed QA runs with invalid JSON before artifact validation', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'qa', 'runs', '2026'), { recursive: true });
    const runPath = 'reports/qa/runs/2026/qa-run-QA-1.json';
    writeFileSync(join(cwd, runPath), '{invalid', 'utf8');

    const result = validateQaEvidenceIntegrityChanges([runPath], cwd);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-run-json');
    expect(result.file).toBe(runPath);
    expect(result.message).toBeTruthy();
  });

  it('blocks deletion of QA run records', () => {
    const cwd = createTempDir();
    const runPath = 'reports/qa/runs/2026/qa-run-QA-1.json';

    expect(validateQaEvidenceIntegrityChanges([runPath], cwd)).toEqual({
      ok: false,
      reason: 'qa-run-deleted',
      file: runPath,
    });
  });

  it('passes changed QA runs when referenced evidence exists', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'reports', 'qa', 'runs', '2026'), { recursive: true });
    mkdirSync(join(cwd, 'reports', 'qa', 'evidence'), { recursive: true });
    const runPath = 'reports/qa/runs/2026/qa-run-QA-1.json';
    writeFileSync(
      join(cwd, 'reports', 'qa', 'evidence', 'kept.png'),
      '',
      'utf8'
    );
    writeFileSync(
      join(cwd, runPath),
      JSON.stringify({
        runId: 'QA-1',
        artifacts: [
          {
            path: 'reports/qa/evidence/kept.png',
          },
        ],
      }),
      'utf8'
    );

    const result = validateQaEvidenceIntegrityChanges([runPath], cwd);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
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
