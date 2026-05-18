/**
 * @vitest-environment node
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = 'src';
const FONT_LAYOUT_PATH = 'src/app/layout.tsx';
const GLOBALS_PATH = 'src/app/globals.css';
const SCANNED_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

function toRepoPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function findGoogleFontReferenceFiles(): string[] {
  const matches: string[] = [];

  const visit = (dirPath: string) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!SCANNED_EXTENSIONS.has(path.extname(entryPath))) {
        continue;
      }

      const source = readFileSync(entryPath, 'utf8');
      if (source.includes('next/font/google')) {
        matches.push(toRepoPath(entryPath));
      }
    }
  };

  visit(SOURCE_ROOT);
  return matches.sort();
}

describe('Vercel font source guard', () => {
  it('keeps Google font usage centralized in the root layout', () => {
    const findings = findGoogleFontReferenceFiles();

    expect(findings).toEqual([FONT_LAYOUT_PATH]);
  }, 20_000);

  it('wires the Noto Sans KR font variable into the global font stack', () => {
    const layout = readFileSync(FONT_LAYOUT_PATH, 'utf8');
    const globals = readFileSync(GLOBALS_PATH, 'utf8');

    expect(layout).toContain(
      "import { Noto_Sans_KR } from 'next/font/google';"
    );
    expect(layout).toContain("weight: 'variable'");
    expect(layout).toContain("variable: '--font-noto-sans-kr'");
    expect(layout).toContain('className={notoSansKR.variable}');
    expect(globals).toContain('var(--font-noto-sans-kr)');
  });
});
