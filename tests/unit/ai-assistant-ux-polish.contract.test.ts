/**
 * @vitest-environment node
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const AI_SURFACE_ROOTS = ['src/components/ai', 'src/components/ai-sidebar'];
const AI_ASSISTANT_ROUTE_FILES = [
  'src/app/dashboard/ai-assistant/page.tsx',
  'src/app/dashboard/ai-assistant/loading.tsx',
  'src/app/dashboard/ai-assistant/error.tsx',
];
const PRODUCTION_FILE_PATTERN = /\.(tsx|ts)$/;
const NON_PRODUCTION_FILE_PATTERN = /\.(test|stories)\.(tsx|ts)$/;
const DISALLOWED_TEXT_SIZE_PATTERN =
  /\btext-(?:2xs|3xs|4xs|xl|2xl|3xl|4xl|5xl|\[(?:10|11|13|15)px\])\b/g;
const DARK_AI_ASSISTANT_SURFACE_PATTERN =
  /\b(?:bg-gray-950|bg-slate-950|bg-zinc-950|from-gray-900|from-slate-900|via-gray-900|via-slate-900|to-black)\b/g;

function walkProductionFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(PROJECT_ROOT, relativeRoot);
  const entries = readdirSync(absoluteRoot, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeRoot, entry.name);
    const absolutePath = path.join(PROJECT_ROOT, relativePath);

    if (entry.isDirectory()) {
      return walkProductionFiles(relativePath);
    }

    if (
      !entry.isFile() ||
      !PRODUCTION_FILE_PATTERN.test(entry.name) ||
      NON_PRODUCTION_FILE_PATTERN.test(entry.name)
    ) {
      return [];
    }

    return statSync(absolutePath).size > 0 ? [relativePath] : [];
  });
}

function collectMatches(files: string[], pattern: RegExp) {
  return files.flatMap((file) => {
    const content = readFileSync(path.join(PROJECT_ROOT, file), 'utf8');
    return Array.from(content.matchAll(pattern), (match) => ({
      file,
      className: match[0],
    }));
  });
}

describe('AI Assistant UX polish contract', () => {
  it('keeps AI assistant typography on the approved 4-tier scale', () => {
    const files = AI_SURFACE_ROOTS.flatMap(walkProductionFiles);
    const matches = collectMatches(files, DISALLOWED_TEXT_SIZE_PATTERN);

    expect(matches).toEqual([]);
  });

  it('keeps the fullscreen AI Assistant route aligned to the light surface', () => {
    const matches = collectMatches(
      AI_ASSISTANT_ROUTE_FILES,
      DARK_AI_ASSISTANT_SURFACE_PATTERN
    );

    expect(matches).toEqual([]);
  });
});
