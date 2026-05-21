import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRegisteredServerIds } from '@/config/server-registry';
import {
  extractEntities,
  KNOWN_ENTITY_SERVER_IDS,
  normalizeExtractedEntities,
  normalizeExtractedEntitiesForQuery,
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
          executionMode: 'multi',
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
        executionMode: 'multi',
        confidence: 91,
      },
    });
  });

  it('defaults missing semantic execution mode to unknown for legacy payloads', () => {
    expect(
      normalizeExtractedEntities({
        confidence: 88,
        intentFrame: {
          domain: 'monitoring',
          intent: 'server_health',
          scope: 'whole_fleet',
          targets: [],
          metric: 'unknown',
          timeWindow: 'current',
          aggregation: 'summary',
          ambiguity: 'low',
          confidence: 88,
        },
      })
    ).toEqual({
      confidence: 88,
      intentFrame: {
        domain: 'monitoring',
        intent: 'server_health',
        scope: 'whole_fleet',
        targets: [],
        metric: 'unknown',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        executionMode: 'unknown',
        confidence: 88,
      },
    });
  });

  it.each([
    ['anomaly_detection', '이상 탐지', 'all'],
    ['anomaly_prediction', '이상 예측', 'all'],
    ['capacity_forecast', '디스크 고갈 예측', 'disk'],
    ['failure_risk', '장애 위험', 'unknown'],
  ] as const)('keeps %s semantic intent frames for Analyst routing', (intent, label, metric) => {
    expect(
      normalizeExtractedEntities({
        confidence: 92,
        intentFrame: {
          domain: 'monitoring',
          intent,
          scope: 'whole_fleet',
          targets: [],
          metric,
          timeWindow: '6h',
          aggregation: 'summary',
          topN: null,
          ambiguity: 'low',
          executionMode: 'multi',
          confidence: 92,
          reason: label,
        },
      })
    ).toEqual({
      confidence: 92,
      intentFrame: {
        domain: 'monitoring',
        intent,
        scope: 'whole_fleet',
        targets: [],
        metric,
        timeWindow: '6h',
        aggregation: 'summary',
        ambiguity: 'low',
        executionMode: 'multi',
        confidence: 92,
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

  it('tolerates provider-compatible nullable payloads while preserving legacy top-level slots', () => {
    expect(
      normalizeExtractedEntities({
        server: null,
        metric: 'load1',
        timeRange: 'current',
        intentFrame: null,
        confidence: 88,
      })
    ).toEqual({ confidence: 88 });
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

  it('corrects group wording that providers over-normalize to one cache server', () => {
    expect(
      normalizeExtractedEntitiesForQuery(
        {
          server: 'cache-redis-dc1-01',
          metric: 'memory',
          confidence: 80,
          intentFrame: {
            domain: 'monitoring',
            intent: 'metric_current',
            scope: 'server',
            targets: ['cache-redis-dc1-01'],
            metric: 'memory',
            timeWindow: 'current',
            aggregation: 'summary',
            topN: null,
            ambiguity: 'low',
            executionMode: 'single',
            confidence: 80,
          },
        },
        '캐시 서버 메모리 현황'
      )
    ).toEqual({
      metric: 'memory',
      confidence: 80,
      intentFrame: {
        domain: 'monitoring',
        intent: 'metric_current',
        scope: 'group',
        targets: ['cache'],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 80,
      },
    });
  });

  it('keeps explicit server IDs even when the server type is also named', () => {
    expect(
      normalizeExtractedEntitiesForQuery(
        {
          server: 'cache-redis-dc1-01',
          metric: 'memory',
          confidence: 85,
          intentFrame: {
            domain: 'monitoring',
            intent: 'metric_current',
            scope: 'server',
            targets: ['cache-redis-dc1-01'],
            metric: 'memory',
            timeWindow: 'current',
            aggregation: 'summary',
            topN: null,
            ambiguity: 'low',
            executionMode: 'single',
            confidence: 85,
          },
        },
        'cache-redis-dc1-01 캐시 서버 메모리 현황'
      )
    ).toMatchObject({
      server: 'cache-redis-dc1-01',
      intentFrame: {
        scope: 'server',
        targets: ['cache-redis-dc1-01'],
      },
    });
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
            executionMode: 'multi',
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
        executionMode: 'multi',
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
