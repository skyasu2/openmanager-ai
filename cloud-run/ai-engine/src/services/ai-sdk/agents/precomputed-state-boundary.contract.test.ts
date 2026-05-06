import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const AI_ENGINE_ROOT = process.cwd();
const AGENTS_ROOT = join(AI_ENGINE_ROOT, 'src/services/ai-sdk/agents');

const FORBIDDEN_AGENT_DATA_IMPORTS = [
  {
    label: 'precomputed-state direct import',
    pattern: /from ['"][^'"]*data\/precomputed-state(?:-core)?[^'"]*['"]/,
  },
  {
    label: 'server metrics data transitive import',
    pattern: /from ['"][^'"]*tools-ai-sdk\/server-metrics\/data['"]/,
  },
];

function listAgentSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listAgentSourceFiles(path);
    }

    if (
      !entry.endsWith('.ts') ||
      entry.endsWith('.test.ts') ||
      entry.endsWith('.spec.ts')
    ) {
      return [];
    }

    return [path];
  });
}

describe('ai-sdk agents precomputed-state boundary', () => {
  it('keeps agent runtime files free of monitoring data-source imports', () => {
    const findings = listAgentSourceFiles(AGENTS_ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_AGENT_DATA_IMPORTS.flatMap((rule) => {
        const match = rule.pattern.exec(source);
        if (!match) return [];

        const line = source.slice(0, match.index).split('\n').length;
        return [
          `${relative(AI_ENGINE_ROOT, file)}:${line}: ${rule.label} must be accessed through AssistantDomain.dataSource`,
        ];
      });
    });

    expect(findings).toEqual([]);
  });
});
