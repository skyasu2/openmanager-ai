/**
 * @vitest-environment node
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface LegacyRetrievalRule {
  label: string;
  pattern: RegExp;
  allowFiles?: string[];
}

const SCAN_ROOTS = [
  'docs',
  'public/data',
  'src/data',
  'src/components',
  'src/config',
  'cloud-run/ai-engine/README.md',
  'cloud-run/ai-engine/src',
  'cloud-run/ai-engine/scripts',
];

const RULES: LegacyRetrievalRule[] = [
  {
    label: 'Native GraphRAG product claim',
    pattern: /Native GraphRAG/,
  },
  {
    label: 'Mistral RAG runtime coupling',
    pattern: /Mistral\s*\+\s*RAG|Mistral RAG Embedding/i,
  },
  {
    label: 'removed embedding HTTP route',
    pattern: /\/api\/ai\/embedding|routes\/embedding/,
  },
  {
    label: 'deleted Cloud Run embedding helper import',
    pattern: /\.\.\/src\/lib\/embedding|from ['"][.]{1,2}\/lib\/embedding['"]/,
  },
  {
    label: 'removed hybrid vector/graph search helper',
    pattern: /hybrid-text-search\.ts|hybridTextVectorSearch|HybridTextSearch/,
  },
  {
    label: 'forced useGraphRAG runtime flag',
    pattern: /useGraphRAG\s*:\s*true/,
    allowFiles: [
      'cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts',
    ],
  },
];

function listTrackedFiles(): string[] {
  return execFileSync('git', ['ls-files', ...SCAN_ROOTS], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((file) => existsSync(file))
    .filter(
      (file) =>
        !file.includes('/archive/') &&
        !file.includes('/archived/') &&
        !file.startsWith('reports/planning/')
    );
}

describe('AI retrieval legacy drift guard', () => {
  it('keeps active docs/data on Knowledge Retrieval Lite terminology', () => {
    const findings: string[] = [];

    for (const file of listTrackedFiles()) {
      const content = readFileSync(file, 'utf8');
      for (const rule of RULES) {
        if (rule.allowFiles?.includes(file)) continue;
        if (!rule.pattern.test(content)) continue;
        findings.push(`${file}: ${rule.label}`);
      }
    }

    expect(findings).toEqual([]);
  });
});
