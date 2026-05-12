import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { getIntentCategory, selectExecutionMode } from '../supervisor-routing';
import { preFilterQuery } from '../agents/orchestrator-context';
import {
  extractQueryRoutingSignals,
  mapQuerySignalsToIntentCategory,
} from './query-routing-signals';

describe('extractQueryRoutingSignals', () => {
  it('extracts whole-fleet load1 peak metric signals', () => {
    const signals = extractQueryRoutingSignals(
      '지난 24시간 중 전체 서버에서 load1이 가장 높았던 시간대와 서버 TOP3 알려줘'
    );

    expect(signals.intent).toBe('metrics');
    expect(signals.scope).toBe('whole_fleet');
    expect(signals.metric).toBe('load1');
    expect(signals.timeWindow).toBe('24h');
    expect(signals.hasInfraContext).toBe(true);
    expect(signals.reasonCodes).toContain('whole_fleet_metric');
  });

  it.each([
    '안녕하세요',
    'CPU 알려줘',
    '서버 상태 요약해줘',
    '장애 보고서 생성해줘',
    '메모리 부족 해결 방법 알려줘',
    'CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘',
    '로그 중 에러/경고 보고 원인과 대응 순서 알려줘',
    '서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘',
    '현재 인프라 토폴로지 알려줘',
    '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘',
  ])('keeps trace-only parity with current routing policies: %s', (query) => {
    const signals = extractQueryRoutingSignals(query);
    const preFilter = preFilterQuery(query);

    expect(mapQuerySignalsToIntentCategory(signals)).toBe(
      getIntentCategory(query)
    );
    expect(signals.modeHint).toBe(selectExecutionMode(query));
    expect(signals.preFilter.action).toBe(
      !preFilter.shouldHandoff && preFilter.directResponse
        ? 'direct_response'
        : preFilter.suggestedAgent
          ? 'suggest_agent'
          : 'continue'
    );
    expect(signals.preFilter.suggestedAgent).toBe(preFilter.suggestedAgent);
  });

  it('keeps deterministic extraction under the p50 latency budget', () => {
    const query =
      '서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘. 지난 24시간 load1 피크도 같이 확인해줘';
    const durations: number[] = [];

    for (let index = 0; index < 1000; index += 1) {
      const startedAt = performance.now();
      extractQueryRoutingSignals(query);
      durations.push(performance.now() - startedAt);
    }

    const sorted = durations.toSorted((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;

    expect(p50).toBeLessThanOrEqual(2);
  });
});
