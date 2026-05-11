import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRegisteredServerIds } from '@/config/server-registry';
import {
  extractEntities,
  KNOWN_ENTITY_SERVER_IDS,
  normalizeExtractedEntities,
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
