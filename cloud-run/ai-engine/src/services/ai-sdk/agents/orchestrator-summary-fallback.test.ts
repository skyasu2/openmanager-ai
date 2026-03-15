import { describe, expect, it } from 'vitest';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
} from './orchestrator-summary-fallback';

describe('buildDeterministicSummaryFallback', () => {
  it('builds a deterministic NLQ summary from getServerMetrics results', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
              { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
              { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
            ],
            alertServers: [
              {
                id: 'api-01',
                status: 'warning',
                cpu: 71,
                memory: 78,
                disk: 36,
                memoryTrend: 'rising',
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('📊 **서버 현황 요약**');
    expect(summary).toContain('전체 3대');
    expect(summary).toContain('⚠️ **주의 서버**');
    expect(summary).toContain('api-01');
    expect(summary).toContain('💡 **권고**');
  });

  it('returns null for non-summary queries', () => {
    const summary = buildDeterministicSummaryFallback(
      'CPU 높은 서버 찾아줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [{ id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 }],
          },
        },
      ]
    );

    expect(summary).toBeNull();
  });

  it('builds deterministic summary from current state when tool results are absent', () => {
    const summary = buildDeterministicSummaryFromCurrentState(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent'
    );

    expect(summary).toBeTruthy();
    expect(summary).toContain('📊 **서버 현황 요약**');
    expect(summary).toContain('💡 **권고**');
  });
});
