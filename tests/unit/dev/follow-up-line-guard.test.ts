import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LINE_GUARD_TARGET_MAX_LINES = 650;

const followUpLineGuardTargets = [
  'cloud-run/ai-engine/src/routes/analytics.ts',
  'cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts',
  'cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-operational.ts',
  'src/components/dashboard/log-explorer/LogExplorerModal.tsx',
  'src/components/ai/AIWorkspace.tsx',
  'src/app/api/ai/supervisor/stream/v2/route.ts',
  'src/components/dashboard/alert-history/AlertHistoryModal.tsx',
] as const;

function countLines(path: string): number {
  const content = readFileSync(path, 'utf8');
  return content === '' ? 0 : content.replace(/\n$/, '').split('\n').length;
}

describe('follow-up line-guard targets', () => {
  it.each(
    followUpLineGuardTargets
  )('keeps %s at or below 650 lines', (path) => {
    expect(countLines(path)).toBeLessThanOrEqual(LINE_GUARD_TARGET_MAX_LINES);
  });
});
