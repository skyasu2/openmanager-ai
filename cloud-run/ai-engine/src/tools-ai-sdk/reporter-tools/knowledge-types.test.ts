import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const KNOWLEDGE_TYPES_PATH = fileURLToPath(
  new URL('./knowledge-types.ts', import.meta.url)
);

describe('knowledge search result types', () => {
  it('does not expose vector or graph as active RAG result source types', () => {
    const source = readFileSync(KNOWLEDGE_TYPES_PATH, 'utf8');

    expect(source).not.toMatch(/\|\s*'vector'/);
    expect(source).not.toMatch(/\|\s*'graph'/);
  });
});
