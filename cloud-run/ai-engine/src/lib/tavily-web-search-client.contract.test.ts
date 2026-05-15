import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TAVILY_CLIENT_PATH = fileURLToPath(
  new URL('./tavily-hybrid-rag.ts', import.meta.url)
);

describe('Tavily web search client contract', () => {
  it('does not expose HybridRAG fallback APIs from the standalone web search client', () => {
    const source = readFileSync(TAVILY_CLIENT_PATH, 'utf8');

    expect(source).not.toMatch(/\bHybridRAG/);
    expect(source).not.toContain('shouldTriggerWebSearch');
    expect(source).not.toContain('enhanceWithWebSearch');
  });
});
