/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BoundaryRule {
  file: string;
  label: string;
  pattern: RegExp;
  hint: string;
}

const PROJECT_ROOT = process.cwd();

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    file: 'src/lib/ai/route-decision.ts',
    label: 'RouteDecision must not own monitoring artifact kind literals',
    pattern: /['"`](server-snapshot|incident-report|monitoring-analysis)['"`]/,
    hint: 'move artifact kind ownership to ArtifactRegistry or a domain compatibility wrapper',
  },
  {
    file: 'cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts',
    label: 'Supervisor mode must not own monitoring artifact kind literals',
    pattern: /['"`](server-snapshot|incident-report|monitoring-analysis)['"`]/,
    hint: 'resolve artifact kinds through the selected domain pack',
  },
  {
    file: 'cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts',
    label:
      'Supervisor routing must not directly own monitoring prompt or source imports',
    pattern:
      /from ['"]\.\.\/\.\.\/data\/precomputed-state(?:-core)?['"]|당신은 서버 모니터링 AI 어시스턴트입니다|### 서버 메트릭 조회/,
    hint: 'inject monitoring prompt and fact/source access through monitoringDomainPack',
  },
  {
    file: 'cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts',
    label:
      'Agent configs must not directly import the monitoring tool registry',
    pattern: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/tools-ai-sdk['"]/,
    hint: 'bind tools through a domain ToolRegistry and agent allowlist wrapper',
  },
];

function firstMatchLine(source: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(source);
  if (!match) return undefined;
  return source.slice(0, match.index).split('\n').length;
}

describe('AI assistant portable boundary contract', () => {
  it('keeps shared/runtime assistant files free of monitoring domain ownership', () => {
    const findings = BOUNDARY_RULES.flatMap((rule) => {
      const source = readFileSync(join(PROJECT_ROOT, rule.file), 'utf8');
      const line = firstMatchLine(source, rule.pattern);
      if (!line) return [];

      return [`${rule.file}:${line}: ${rule.label}; ${rule.hint}`];
    });

    expect(findings).toEqual([]);
  });
});
