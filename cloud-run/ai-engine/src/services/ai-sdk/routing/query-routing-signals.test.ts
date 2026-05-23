import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  getIntentCategory,
  selectExecutionMode,
} from '../../../domains/monitoring/routing-policy';
import { MONITORING_AGENT_MATCH_PATTERN_USAGE } from '../../../domains/monitoring/agent-roles';
import { preFilterQuery } from '../agents/orchestrator-context';
import {
  extractQueryRoutingSignals as extractLegacyQueryRoutingSignals,
} from '../query-routing-signals';
import {
  extractQueryRoutingSignals,
  mapQuerySignalsToIntentCategory,
  MONITORING_RUNTIME_ROUTING_SOURCE,
} from './query-routing-signals';

describe('extractQueryRoutingSignals', () => {
  it('declares routing signals as runtime SSOT and role matchPatterns as metadata-only', () => {
    expect(MONITORING_RUNTIME_ROUTING_SOURCE).toBe('query-routing-signals');
    expect(MONITORING_AGENT_MATCH_PATTERN_USAGE).toBe('metadata-only');
  });

  it('keeps the legacy query-routing-signals path as a canonical re-export', () => {
    const query =
      '지난 24시간 중 전체 서버에서 load1이 가장 높았던 시간대와 서버 TOP3 알려줘';

    expect(extractLegacyQueryRoutingSignals(query)).toEqual(
      extractQueryRoutingSignals(query)
    );
  });

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

  it('extracts AZ load-balance queries as monitoring metric signals', () => {
    const signals = extractQueryRoutingSignals(
      'DC1-AZ1/AZ2/AZ3 구역별 부하 균형이 잡혀 있어?'
    );

    expect(signals.intent).toBe('metrics');
    expect(signals.toolIntentCategory).toBe('metrics');
    expect(signals.metric).toBe('load1');
    expect(signals.hasInfraContext).toBe(true);
    expect(signals.reasonCodes).toContain('metric_detected_load1');
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

  it('classifies attached Playwright screenshots as Vision pre-filter even without server keywords', () => {
    const query = '첨부된 Playwright 스크린샷을 분석해줘';
    const signals = extractQueryRoutingSignals(query, {
      hasImageAttachments: true,
    });

    expect(signals.intent).toBe('vision');
    expect(signals.preFilter.action).toBe('suggest_agent');
    expect(signals.preFilter.suggestedAgent).toBe('Vision Agent');
    expect(signals.preFilter.reasonCodes).toContain(
      'prefilter_vision_attachment'
    );
  });

  it('routes Vercel BFF and Cloud Run boundary KRL questions to knowledge', () => {
    const signals = extractQueryRoutingSignals(
      'Vercel BFF와 Cloud Run AI Engine 책임 경계를 알려줘. KRL 근거가 있으면 함께 알려줘.'
    );

    expect(signals.intent).toBe('knowledge');
    expect(signals.modeHint).toBe('multi');
    expect(signals.reasonCodes).toContain('mode_multi_knowledge');
    expect(signals.preFilter.action).toBe('suggest_agent');
    expect(signals.preFilter.suggestedAgent).toBe('Advisor Agent');
  });

  it('routes Redis configuration guide requests to direct knowledge without catching immediate mitigation commands', () => {
    const guideSignals = extractQueryRoutingSignals(
      'Redis maxmemory 설정 가이드와 redis.conf 영속화 방법 알려줘'
    );

    expect(guideSignals.intent).toBe('knowledge');
    expect(guideSignals.modeHint).toBe('multi');
    expect(guideSignals.reasonCodes).toContain('mode_multi_knowledge');
    expect(guideSignals.preFilter.suggestedAgent).toBe('Advisor Agent');

    const immediateCommandSignals = extractQueryRoutingSignals(
      'Redis 메모리 즉시 완화 명령어 정리해줘'
    );

    expect(immediateCommandSignals.intent).not.toBe('knowledge');
    expect(immediateCommandSignals.reasonCodes).not.toContain(
      'mode_multi_knowledge'
    );
  });

  it('routes performance improvement advice wording to Advisor pre-filter', () => {
    const signals = extractQueryRoutingSignals(
      'api-was-dc1-01 서버 성능 개선 조언 해줘'
    );

    expect(signals.intent).toBe('advisor');
    expect(signals.toolIntentCategory).toBe('advisor');
    expect(signals.preFilter.action).toBe('suggest_agent');
    expect(signals.preFilter.suggestedAgent).toBe('Advisor Agent');

    const optimizationSignals = extractQueryRoutingSignals(
      'db-mysql-dc1-primary 최적화 방법 알려줘'
    );
    expect(optimizationSignals.preFilter.suggestedAgent).toBe('Advisor Agent');
  });

  it('keeps retired analysis-mode reason labels out of the routing source', () => {
    const source = readFileSync(
      new URL('./query-routing-signals.ts', import.meta.url),
      'utf8'
    );

    expect(source).not.toContain('mode_multi_analysis_mode');
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
