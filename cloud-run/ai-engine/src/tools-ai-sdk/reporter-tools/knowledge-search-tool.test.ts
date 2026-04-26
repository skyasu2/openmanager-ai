import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSupabaseClient,
  mockRetrieveKnowledgeEvidence,
  mockEmbedText,
  mockSearchWithEmbedding,
  mockEnhanceWithWebSearch,
  mockIsTavilyAvailable,
} = vi.hoisted(() => ({
  mockGetSupabaseClient: vi.fn(),
  mockRetrieveKnowledgeEvidence: vi.fn(),
  mockEmbedText: vi.fn(),
  mockSearchWithEmbedding: vi.fn(),
  mockEnhanceWithWebSearch: vi.fn(),
  mockIsTavilyAvailable: vi.fn(() => true),
}));

vi.mock('./knowledge-client', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

vi.mock('../../lib/embedding', () => ({
  embedText: mockEmbedText,
  searchWithEmbedding: mockSearchWithEmbedding,
}));

vi.mock('../../lib/knowledge-retrieval-lite', () => ({
  retrieveKnowledgeEvidence: mockRetrieveKnowledgeEvidence,
}));

vi.mock('../../lib/tavily-hybrid-rag', () => ({
  enhanceWithWebSearch: mockEnhanceWithWebSearch,
  isTavilyAvailable: mockIsTavilyAvailable,
}));

vi.mock('../../lib/reranker', () => ({
  isRerankerAvailable: vi.fn(() => false),
  rerankDocuments: vi.fn(),
}));

vi.mock('../../lib/query-expansion', () => ({
  shouldUseHyDE: vi.fn(() => false),
  expandQueryWithHyDE: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  resetKnowledgeSearchCacheForTest,
  searchKnowledgeBase,
} from './knowledge-search-tool';
import { logger } from '../../lib/logger';

describe('searchKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetKnowledgeSearchCacheForTest();
  });

  it('coerces string boolean flags in tool-call payloads', () => {
    const inputSchema = (
      searchKnowledgeBase as unknown as {
        inputSchema: { parse: (input: unknown) => Record<string, unknown> };
      }
    ).inputSchema;

    const parsed = inputSchema.parse({
      query: '현재 인프라 아키텍처 요약',
      useGraphRAG: 'true',
      fastMode: 'true',
      includeWebSearch: 'false',
    });

    expect(parsed.useGraphRAG).toBe(true);
    expect(parsed.fastMode).toBe(true);
    expect(parsed.includeWebSearch).toBe(false);
  });

  it('returns graceful fallback when Supabase client is unavailable', async () => {
    mockGetSupabaseClient.mockResolvedValue(null);

    const result = await searchKnowledgeBase.execute({
      query: 'Redis OOM 조치 방법',
    });

    expect(result).toMatchObject({
      success: false,
      results: [],
      totalFound: 0,
      _source: 'Fallback (No Supabase)',
      evidenceCards: [],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'unavailable',
        evidenceCount: 0,
        webUsed: false,
      },
    });
    expect(result.systemMessage).toContain('Supabase 데이터베이스 연결 실패');
    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it('returns success result from Knowledge Retrieval Lite without embedding, graph, or web fallback', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockRetrieveKnowledgeEvidence.mockResolvedValue({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 2,
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
      evidenceCards: [
        {
          id: 'kb-1',
          title: 'Redis OOM 대응 가이드',
          summary: '메모리 사용률 임계치 초과 시 ...',
          score: 0.93,
          sourceType: 'runbook',
          category: 'incident',
        },
        {
          id: 'kb-2',
          title: 'Redis 캐시 정책',
          summary: 'eviction-policy 설정 확인',
          score: 0.88,
          sourceType: 'knowledge',
          category: 'troubleshooting',
        },
      ],
    });

    const result = await searchKnowledgeBase.execute({
      query: 'Redis OOM 원인 분석',
      category: 'incident',
      useGraphRAG: true,
      includeWebSearch: true,
    });

    expect(result).toMatchObject({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
      webSearchTriggered: false,
    });
    expect(result.totalFound).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      id: 'kb-1',
      title: 'Redis OOM 대응 가이드',
      sourceType: 'runbook',
      category: 'incident',
    });
    expect(mockRetrieveKnowledgeEvidence).toHaveBeenCalledWith(
      {
        query: 'Redis OOM 원인 분석',
        category: 'incident',
        severity: undefined,
        limit: 5,
      },
      { client: {} }
    );
    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockSearchWithEmbedding).not.toHaveBeenCalled();
    expect(mockEnhanceWithWebSearch).not.toHaveBeenCalled();
  });

  it('keeps evidenceCards aligned with rebalance-filtered results', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockRetrieveKnowledgeEvidence.mockResolvedValue({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 2,
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
      evidenceCards: [
        {
          id: 'kb-safe',
          title: 'Redis OOM 대응 가이드',
          summary: '메모리 사용률 임계치 초과 시 eviction 정책을 확인합니다.',
          score: 0.91,
          sourceType: 'runbook',
          category: 'troubleshooting',
        },
        {
          id: 'kb-destructive',
          title: 'docker system prune',
          summary: '전체 Docker 캐시와 미사용 리소스를 삭제합니다.',
          score: 0.89,
          sourceType: 'runbook',
          category: 'command',
        },
      ],
    });

    const result = await searchKnowledgeBase.execute({
      query: 'Redis OOM 원인 분석',
      category: 'incident',
    });

    expect(result.results).toHaveLength(1);
    expect(result.evidenceCards).toHaveLength(1);
    expect(result.totalFound).toBe(1);
    expect(result.retrieval?.evidenceCount).toBe(1);
    expect(result.results[0]?.id).toBe('kb-safe');
    expect(result.evidenceCards?.[0]?.id).toBe('kb-safe');
    expect(result.evidenceCards?.some((card) => card.id === 'kb-destructive')).toBe(
      false
    );
  });

  it('returns error fallback when Knowledge Retrieval Lite is unavailable', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockRetrieveKnowledgeEvidence
      .mockResolvedValueOnce({
        success: false,
        _source: 'Knowledge Retrieval Lite (Unavailable)',
        evidenceCards: [],
        totalFound: 0,
        metadata: {
          retrievalEnabled: true,
          retrievalUsed: false,
          retrievalMode: 'lite',
          suppressedReason: 'unavailable',
          evidenceCount: 0,
          webUsed: false,
        },
        error: 'text search unavailable',
      })
      .mockResolvedValueOnce({
        success: true,
        _source: 'Knowledge Retrieval Lite',
        evidenceCards: [
          {
            id: 'kb-recovered',
            title: 'Recovered KB',
            summary: 'text search recovered',
            score: 0.7,
            sourceType: 'knowledge',
            category: 'troubleshooting',
          },
        ],
        totalFound: 1,
        metadata: {
          retrievalEnabled: true,
          retrievalUsed: true,
          retrievalMode: 'lite',
          evidenceCount: 1,
          webUsed: false,
        },
      });

    const result = await searchKnowledgeBase.execute({
      query: 'redis 설정 확인',
    });

    expect(result).toMatchObject({
      success: false,
      _source: 'Knowledge Retrieval Lite (Unavailable)',
      totalFound: 0,
      results: [],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'unavailable',
      },
    });
    expect(result.systemMessage).toContain(
      '지식 베이스 검색 중 오류가 발생했습니다'
    );
    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockSearchWithEmbedding).not.toHaveBeenCalled();

    const recovered = await searchKnowledgeBase.execute({
      query: 'redis 설정 확인',
    });
    expect(recovered).toMatchObject({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 1,
    });
    expect(mockRetrieveKnowledgeEvidence).toHaveBeenCalledTimes(2);
  });

  it('reuses cached result for duplicate KB searches', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockRetrieveKnowledgeEvidence.mockResolvedValue({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 1,
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
        webUsed: false,
      },
      evidenceCards: [
        {
          id: 'kb-1',
          title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
          summary: 'APP, DB, CACHE 트래픽 구조 설명',
          score: 0.91,
          sourceType: 'knowledge',
          category: 'architecture',
        },
      ],
    });

    const first = await searchKnowledgeBase.execute({
      query: '현재 인프라 토폴로지 알려줘',
      category: 'architecture',
    });
    const second = await searchKnowledgeBase.execute({
      query: '현재 인프라 토폴로지 알려줘',
      category: 'architecture',
    });

    expect(first).toEqual(second);
    expect(mockRetrieveKnowledgeEvidence).toHaveBeenCalledTimes(1);
    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it('emits sampled structured telemetry for production Knowledge Retrieval Lite usage', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSampleRate =
      process.env.KNOWLEDGE_RETRIEVAL_TELEMETRY_SAMPLE_RATE;
    process.env.NODE_ENV = 'production';
    process.env.KNOWLEDGE_RETRIEVAL_TELEMETRY_SAMPLE_RATE = '1';
    vi.spyOn(Math, 'random').mockReturnValue(0);

    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockRetrieveKnowledgeEvidence.mockResolvedValue({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 2,
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
      evidenceCards: [
        {
          id: 'kb-1',
          title: 'Redis OOM 대응 가이드',
          summary: '메모리 사용률 임계치 초과 시 ...',
          score: 0.93,
          sourceType: 'runbook',
          category: 'incident',
        },
        {
          id: 'kb-2',
          title: 'Redis 캐시 정책',
          summary: 'eviction-policy 설정 확인',
          score: 0.88,
          sourceType: 'knowledge',
          category: 'troubleshooting',
        },
      ],
    });

    await searchKnowledgeBase.execute({
      query: 'Redis OOM 원인 분석',
      category: 'incident',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'knowledge_retrieval_lite_search',
        component: 'reporter_tools',
        queryCategory: 'incident',
        cacheHit: false,
        success: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      }),
      '[Reporter Tools] Knowledge Retrieval Lite telemetry'
    );

    vi.restoreAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSampleRate === undefined) {
      delete process.env.KNOWLEDGE_RETRIEVAL_TELEMETRY_SAMPLE_RATE;
    } else {
      process.env.KNOWLEDGE_RETRIEVAL_TELEMETRY_SAMPLE_RATE =
        previousSampleRate;
    }
  });
});
