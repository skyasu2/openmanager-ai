import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const agentsDir = join(
  process.cwd(),
  'src/services/ai-sdk/agents'
);

describe('orchestrator factory layering contract', () => {
  it('keeps AgentFactory execution in a dedicated module with routing compatibility re-exports', () => {
    const factoryPath = join(agentsDir, 'orchestrator-factory.ts');
    const routingPath = join(agentsDir, 'orchestrator-routing.ts');

    expect(existsSync(factoryPath)).toBe(true);

    const factorySource = readFileSync(factoryPath, 'utf8');
    expect(factorySource).toContain('export function getAgentTypeFromName');
    expect(factorySource).toContain('export async function executeWithAgentFactory');

    const routingSource = readFileSync(routingPath, 'utf8');
    expect(routingSource).toContain("from './orchestrator-factory'");
    expect(routingSource).not.toContain('AgentFactory-based Execution');
  });
});
