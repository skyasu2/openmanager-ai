/**
 * @vitest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const {
  classifyReference,
  auditScriptReferences,
} = require('../../../scripts/dev/audit-script-references');

const tempDirs: string[] = [];

function makeTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-ref-audit-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeFile(rootDir: string, relativePath: string, content: string) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('audit-script-references', () => {
  it('classifies reference sources by execution surface', () => {
    expect(classifyReference('package.json')).toBe('runtime');
    expect(classifyReference('.github/workflows/ci.yml')).toBe('runtime');
    expect(classifyReference('.husky/pre-commit')).toBe('runtime');
    expect(classifyReference('.codex/config.toml')).toBe('runtime');
    expect(classifyReference('scripts/hooks/pre-push.js')).toBe('runtime');
    expect(classifyReference('tests/unit/dev/tool.test.ts')).toBe('test');
    expect(classifyReference('docs/development/tooling.md')).toBe('docs');
  });

  it('splits runtime, docs-only, test-only, and unreferenced scripts', () => {
    const rootDir = makeTempDir();

    writeFile(rootDir, 'scripts/dev/runtime.js', "console.log('runtime');\n");
    writeFile(rootDir, 'scripts/dev/docs-only.js', "console.log('docs');\n");
    writeFile(rootDir, 'scripts/dev/test-only.js', "console.log('test');\n");
    writeFile(
      rootDir,
      'scripts/dev/unreferenced.js',
      "console.log('orphan');\n"
    );

    writeFile(
      rootDir,
      'package.json',
      '{ "scripts": { "runtime": "node scripts/dev/runtime.js" } }'
    );
    writeFile(
      rootDir,
      'docs/tooling.md',
      'Use `scripts/dev/docs-only.js` when documenting local setup.\n'
    );
    writeFile(
      rootDir,
      'tests/unit/tool.test.ts',
      "require('../../../scripts/dev/test-only.js');\n"
    );

    const summary = auditScriptReferences({
      cwd: rootDir,
      scanRoots: ['package.json', 'docs', 'tests', 'scripts'],
    });

    expect(
      summary.runtimeReferenced.map((item: { file: string }) => item.file)
    ).toEqual(['scripts/dev/runtime.js']);
    expect(summary.docsOnly.map((item: { file: string }) => item.file)).toEqual(
      ['scripts/dev/docs-only.js']
    );
    expect(summary.testOnly.map((item: { file: string }) => item.file)).toEqual(
      ['scripts/dev/test-only.js']
    );
    expect(
      summary.unreferenced.map((item: { file: string }) => item.file)
    ).toEqual(['scripts/dev/unreferenced.js']);
  });

  it('ignores audit reports that would otherwise self-reference orphan candidates', () => {
    const rootDir = makeTempDir();

    writeFile(
      rootDir,
      'scripts/dev/unreferenced.js',
      "console.log('orphan');\n"
    );
    writeFile(
      rootDir,
      'reports/docs/script-reference-audit-2026-04-10.md',
      '- `scripts/dev/unreferenced.js`\n'
    );

    const summary = auditScriptReferences({
      cwd: rootDir,
      scanRoots: ['reports/docs', 'scripts'],
    });

    expect(summary.docsOnly).toEqual([]);
    expect(
      summary.unreferenced.map((item: { file: string }) => item.file)
    ).toEqual(['scripts/dev/unreferenced.js']);
  });
});
