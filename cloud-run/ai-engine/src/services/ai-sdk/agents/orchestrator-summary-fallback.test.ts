import { describe, expect, it } from 'vitest';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
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

  it('추세 섹션에서 평균 대비 변화량을 보여주고 권고를 더 구체화한다', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
              {
                id: 'api-01',
                status: 'critical',
                cpu: 91,
                memory: 78,
                disk: 36,
                dailyTrend: {
                  cpu: { avg: 57 },
                  memory: { avg: 66 },
                  disk: { avg: 34 },
                },
              },
            ],
            alertServers: [
              {
                id: 'api-01',
                status: 'critical',
                cpu: 91,
                memory: 78,
                disk: 36,
                cpuTrend: 'rising',
                dailyAvg: { cpu: 57, memory: 66, disk: 34 },
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('CPU 평균 57% → 현재 91% (+34%p, 상승 추세 ↑)');
    expect(summary).toContain('최근 15분 상위 프로세스, 직전 배포/배치, LB 트래픽 급증 여부를 우선 확인하세요.');
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

  it('excludes offline servers from average metrics while preserving offline count', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 40, memory: 60, disk: 30 },
              { id: 'api-01', status: 'warning', cpu: 60, memory: 40, disk: 50 },
              { id: 'db-01', status: 'offline', cpu: 0, memory: 0, disk: 0 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('정상 1대, 경고 1대, 비상 0대, 오프라인 1대');
    expect(summary).toContain('평균 CPU: 50%, 메모리: 50%, 디스크: 40%');
  });

  it('identifies NLQ summary prompts that must use deterministic output', () => {
    expect(
      isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'NLQ Agent')
    ).toBe(true);
    expect(
      isDeterministicSummaryQuery('CPU 높은 서버 찾아줘', 'NLQ Agent')
    ).toBe(false);
    expect(
      isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'Analyst Agent')
    ).toBe(false);
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
