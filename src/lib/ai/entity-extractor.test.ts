import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRegisteredServerIds } from '@/config/server-registry';
import {
  extractEntities,
  extractLocalSemanticEntities,
  KNOWN_ENTITY_SERVER_IDS,
  normalizeExtractedEntities,
  type SemanticIntentFrame,
} from './entity-extractor';

describe('KNOWN_ENTITY_SERVER_IDS', () => {
  it('uses the registered server inventory as its source of truth', () => {
    expect(KNOWN_ENTITY_SERVER_IDS).toEqual(getRegisteredServerIds());
    expect(KNOWN_ENTITY_SERVER_IDS).toContain('storage-s3gw-dc1-01');
  });
});

describe('normalizeExtractedEntities', () => {
  it('keeps only known server, metric, timeRange values and clamps confidence', () => {
    expect(
      normalizeExtractedEntities({
        server: 'api-was-dc1-01',
        metric: 'cpu',
        timeRange: '24h',
        confidence: 120,
      })
    ).toEqual({
      server: 'api-was-dc1-01',
      metric: 'cpu',
      timeRange: '24h',
      confidence: 100,
    });
  });

  it('keeps a valid semantic intent frame without exposing provider internals', () => {
    expect(
      normalizeExtractedEntities({
        metric: 'load1',
        timeRange: '24h',
        confidence: 91,
        intentFrame: {
          domain: 'monitoring',
          intent: 'metric_peak',
          scope: 'whole_fleet',
          targets: [],
          metric: 'load1',
          timeWindow: '24h',
          aggregation: 'peak',
          topN: 5,
          ambiguity: 'low',
          confidence: 91,
          provider: 'monitoringPeakMetricEvidenceProvider',
        },
      })
    ).toEqual({
      timeRange: '24h',
      confidence: 91,
      intentFrame: {
        domain: 'monitoring',
        intent: 'metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        topN: 5,
        ambiguity: 'low',
        confidence: 91,
      },
    });
  });

  it('drops unknown entity values instead of trusting arbitrary payloads', () => {
    expect(
      normalizeExtractedEntities({
        server: 'unknown-server',
        metric: 'gpu',
        timeRange: '30d',
        confidence: 90,
      })
    ).toEqual({ confidence: 90 });
  });

  it('drops invalid semantic intent frame enum values', () => {
    expect(
      normalizeExtractedEntities({
        confidence: 80,
        intentFrame: {
          domain: 'monitoring',
          intent: 'call_provider_directly',
          scope: 'whole_fleet',
          targets: [],
          metric: 'load1',
          timeWindow: '24h',
          aggregation: 'peak',
          ambiguity: 'low',
          confidence: 80,
        },
      })
    ).toEqual({ confidence: 80 });
  });
});

type SemanticCorpusCase = {
  query: string;
  expectedCurrentRouteFrame?: Pick<
    SemanticIntentFrame,
    'domain' | 'intent' | 'metric' | 'aggregation' | 'timeWindow' | 'scope'
  >;
};

const metricPeakPositiveCorpus: SemanticCorpusCase[] = [
  {
    query: '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '최근 하루 load가 가장 높았던 구간',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '전체 서버 기준 지난 하루 중 load average가 가장 높았던 시간은?',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '최근 24시간 load 최고점 top server',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '어제부터 지금까지 1분 load가 제일 튄 시각',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: 'last 24h node_load1 outlier timestamp and top server evidence',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: 'from yesterday to now system load peak timestamp',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '최근 하루 시스템 pressure 최대 구간과 상위 서버',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query:
      '전체 서버가 최근 24시간 중 제일 힘들었던 순간은? CPU 말고 로드 기준',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query:
      '서버명 없이 전체 기준으로 최근 하루 중 1분 load가 제일 튄 시각과 근거 숫자',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '지난 24시간 load bottleneck 구간과 영향 서버',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load1',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
  {
    query: '최근 하루 node_load5 최고 시간대 top 5 서버',
    expectedCurrentRouteFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      metric: 'load5',
      aggregation: 'peak',
      timeWindow: '24h',
      scope: 'whole_fleet',
    },
  },
];

const localFallbackCorpus: SemanticCorpusCase[] = [
  { query: '현재 모든 서버 상태 요약해줘' },
  { query: 'CPU 사용률 상위 3대 알려줘' },
  { query: '부하가 높으면 조치 방법 알려줘' },
  { query: '최근 하루 load 피크 시간과 대응 방법 알려줘' },
  { query: 'api-was-dc1-01 CPU 어때?' },
  { query: '오늘 날씨 어때?' },
  { query: '지난 24시간 CPU 평균 알려줘' },
  { query: '최근 하루 load timeout 조치 방법 알려줘' },
  { query: '장애 보고서 만들어줘' },
  { query: 'server runbook 절차 알려줘' },
];

describe('extractLocalSemanticEntities metric_peak corpus', () => {
  it('meets the Task 8 corpus gate before enabling local-first metric_peak extraction', () => {
    const coreSlots = [
      'domain',
      'intent',
      'metric',
      'aggregation',
      'timeWindow',
      'scope',
    ] as const;
    let matchedPositiveCount = 0;
    let matchedSlotCount = 0;
    let totalSlotCount = 0;

    expect(metricPeakPositiveCorpus.length).toBeGreaterThanOrEqual(12);
    expect(localFallbackCorpus.length).toBeGreaterThanOrEqual(8);

    for (const corpusCase of metricPeakPositiveCorpus) {
      const localFrame = extractLocalSemanticEntities(
        corpusCase.query
      )?.intentFrame;
      const expectedFrame = corpusCase.expectedCurrentRouteFrame;
      if (localFrame) matchedPositiveCount += 1;
      expect(expectedFrame).toBeDefined();

      for (const slot of coreSlots) {
        totalSlotCount += 1;
        if (localFrame?.[slot] === expectedFrame?.[slot]) {
          matchedSlotCount += 1;
        }
      }
    }

    const falsePositiveCount = localFallbackCorpus.filter(
      (corpusCase) => extractLocalSemanticEntities(corpusCase.query) !== null
    ).length;
    const recall = matchedPositiveCount / metricPeakPositiveCorpus.length;
    const slotMatchRate = matchedSlotCount / totalSlotCount;

    expect(recall).toBeGreaterThanOrEqual(0.9);
    expect(falsePositiveCount).toBe(0);
    expect(slotMatchRate).toBeGreaterThanOrEqual(0.95);
  });

  it('returns a high-confidence frame only for local metric_peak matches', () => {
    expect(
      extractLocalSemanticEntities(
        '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?'
      )
    ).toMatchObject({
      timeRange: '24h',
      confidence: 94,
      intentFrame: {
        domain: 'monitoring',
        intent: 'metric_peak',
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        scope: 'whole_fleet',
        ambiguity: 'low',
        confidence: 94,
      },
    });
    expect(
      extractLocalSemanticEntities(
        '최근 하루 load 피크 시간과 대응 방법 알려줘'
      )
    ).toBeNull();
  });
});

describe('extractEntities', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('posts query to the local extraction route with an abort signal', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          server: 'api-was-dc1-01',
          metric: 'cpu',
          timeRange: '1h',
          confidence: 91,
          intentFrame: {
            domain: 'monitoring',
            intent: 'metric_peak',
            scope: 'whole_fleet',
            targets: [],
            metric: 'load1',
            timeWindow: '24h',
            aggregation: 'peak',
            ambiguity: 'low',
            confidence: 91,
          },
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(extractEntities('api-was-dc1-01 CPU 어때?')).resolves.toEqual({
      server: 'api-was-dc1-01',
      metric: 'cpu',
      timeRange: '1h',
      confidence: 91,
      intentFrame: {
        domain: 'monitoring',
        intent: 'metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        ambiguity: 'low',
        confidence: 91,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/nlq/extract-entities',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'api-was-dc1-01 CPU 어때?' }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('falls back gracefully when the route fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ confidence: 0 }), { status: 500 });
    }) as typeof fetch;

    await expect(extractEntities('서버 상태')).resolves.toEqual({
      confidence: 0,
    });
  });
});
