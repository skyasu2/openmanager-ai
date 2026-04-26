import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function localPath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

describe('GraphRAG runtime removal contract', () => {
  it('removes custom GraphRAG runtime source files from the request path', () => {
    expect(existsSync(localPath('./graphrag-service.ts'))).toBe(false);
    expect(existsSync(localPath('./graphrag-graph.ts'))).toBe(false);
    expect(existsSync(localPath('./graphrag-types.ts'))).toBe(false);
  });

  it('keeps the deprecated /graphrag route disconnected from graph traversal services', () => {
    const routeSource = readFileSync(
      localPath('../routes/graphrag.ts'),
      'utf8'
    );

    expect(routeSource).not.toContain('graphrag-service');
    expect(routeSource).not.toContain('getGraphRAGStats');
    expect(routeSource).not.toContain('getRelatedKnowledge');
    expect(routeSource).not.toContain('traverse_knowledge_graph');
  });

  it('does not force legacy useGraphRAG flags in deterministic topology retrieval', () => {
    const routingSource = readFileSync(
      localPath('../services/ai-sdk/agents/orchestrator-routing.ts'),
      'utf8'
    );

    expect(routingSource).not.toContain('useGraphRAG: true');
  });
});
