import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(
  srcRoot,
  '..',
  'package.json'
);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}

function toSrcRelativePath(path: string): string {
  return path.slice(srcRoot.length + 1);
}

describe('knowledge retrieval runtime cleanup', () => {
  it('does not expose package scripts for removed graph runtime utilities', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};
    const graphRuntimeToken = ['graph', 'rag'].join('');
    const evalScriptPrefix = 'rag:eval:';
    const evalFilePrefix = 'rag-eval-';

    expect(scripts).not.toHaveProperty(`rag:analyze:${graphRuntimeToken}`);
    expect(scripts).not.toHaveProperty(`${evalScriptPrefix}onoff`);
    expect(scripts).not.toHaveProperty(`${evalScriptPrefix}goldset`);
    expect(Object.values(scripts).join('\n')).not.toContain(
      `analyze-${graphRuntimeToken}-coverage.ts`
    );
    expect(Object.values(scripts).join('\n')).not.toContain(
      `${evalFilePrefix}onoff.ts`
    );
    expect(Object.values(scripts).join('\n')).not.toContain(
      `${evalFilePrefix}goldset.ts`
    );
  });

  it('keeps removed graph runtime compatibility isolated at boundaries', () => {
    const allowedUseGraphRagRuntimeFiles = new Set([
      'lib/legacy-contracts.ts',
      'tools-ai-sdk/reporter-tools/knowledge-search-tool.ts',
    ]);
    const runtimeOffenders = listSourceFiles(srcRoot)
      .filter((path) => !path.endsWith('.test.ts'))
      .filter((path) => readFileSync(path, 'utf-8').includes('useGraphRAG'))
      .map(toSrcRelativePath)
      .filter((path) => !allowedUseGraphRagRuntimeFiles.has(path));

    expect(runtimeOffenders).toEqual([]);
  });

  it('does not allow legacy GraphRAG telemetry env names in active runtime', () => {
    const offenders = listSourceFiles(srcRoot)
      .filter((path) => !path.endsWith('.test.ts'))
      .filter((path) =>
        readFileSync(path, 'utf-8').includes('GRAPH_RAG_TELEMETRY_SAMPLE_RATE')
      )
      .map(toSrcRelativePath);

    expect(offenders).toEqual([]);
  });
});
