import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSupabaseClient,
  mockEmbedText,
  mockSearchWithEmbedding,
  mockHybridGraphSearch,
} = vi.hoisted(() => ({
  mockGetSupabaseClient: vi.fn(),
  mockEmbedText: vi.fn(),
  mockSearchWithEmbedding: vi.fn(),
  mockHybridGraphSearch: vi.fn(),
}));

vi.mock('./knowledge-client', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

vi.mock('../../lib/embedding', () => ({
  embedText: mockEmbedText,
  searchWithEmbedding: mockSearchWithEmbedding,
}));

vi.mock('../../lib/graphrag-service', () => ({
  hybridGraphSearch: mockHybridGraphSearch,
}));

vi.mock('../../lib/tavily-hybrid-rag', () => ({
  enhanceWithWebSearch: vi.fn(),
  isTavilyAvailable: vi.fn(() => false),
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
      useGraphRAG: 'false',
      fastMode: 'true',
      includeWebSearch: 'false',
    });

    expect(parsed.useGraphRAG).toBe(false);
    expect(parsed.fastMode).toBe(true);
    expect(parsed.includeWebSearch).toBe(false);
  });

  it('returns graceful fallback when Supabase client is unavailable', async () => {
    mockGetSupabaseClient.mockResolvedValue(null);

    const result = await searchKnowledgeBase.execute({ query: 'Redis OOM 조치 방법' });

    expect(result).toMatchObject({
      success: false,
      results: [],
      totalFound: 0,
      _source: 'Fallback (No Supabase)',
    });
    expect(result.systemMessage).toContain('Supabase 데이터베이스 연결 실패');
    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockHybridGraphSearch).not.toHaveBeenCalled();
  });

  it('returns success result from GraphRAG path', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockHybridGraphSearch.mockResolvedValue([
      {
        id: 'kb-1',
        title: 'Redis OOM 대응 가이드',
        content: '메모리 사용률 임계치 초과 시 ...',
        score: 0.93,
        sourceType: 'vector',
        hopDistance: 0,
        category: 'incident',
      },
      {
        id: 'kb-2',
        title: 'Redis 캐시 정책',
        content: 'eviction-policy 설정 확인',
        score: 0.88,
        sourceType: 'graph',
        hopDistance: 1,
        category: 'troubleshooting',
      },
    ]);

    const result = await searchKnowledgeBase.execute({
      query: 'Redis OOM 원인 분석',
      category: 'incident',
    });

    expect(result).toMatchObject({
      success: true,
      _source: 'GraphRAG Hybrid (Vector + Graph)',
    });
    expect(result.totalFound).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      id: 'kb-1',
      title: 'Redis OOM 대응 가이드',
      sourceType: 'vector',
      category: 'incident',
    });
  });

  it('returns error fallback when vector search fails', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockEmbedText.mockResolvedValue([0.5, 0.2, 0.1]);
    mockSearchWithEmbedding.mockResolvedValue({
      success: false,
      results: [],
      error: 'vector search unavailable',
    });

    const result = await searchKnowledgeBase.execute({
      query: 'redis 설정 확인',
      useGraphRAG: false,
    });

    expect(result).toMatchObject({
      success: false,
      _source: 'Error Fallback',
      totalFound: 0,
      results: [],
    });
    expect(result.systemMessage).toContain('지식 베이스 검색 중 오류가 발생했습니다');
  });

  it('reuses cached result for duplicate KB searches', async () => {
    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockHybridGraphSearch.mockResolvedValue([
      {
        id: 'kb-1',
        title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
        content: 'APP, DB, CACHE 트래픽 구조 설명',
        score: 0.91,
        sourceType: 'vector',
        hopDistance: 0,
        category: 'architecture',
      },
    ]);

    const first = await searchKnowledgeBase.execute({
      query: '현재 인프라 토폴로지 알려줘',
      category: 'architecture',
    });
    const second = await searchKnowledgeBase.execute({
      query: '현재 인프라 토폴로지 알려줘',
      category: 'architecture',
    });

    expect(first).toEqual(second);
    expect(mockEmbedText).toHaveBeenCalledTimes(1);
    expect(mockHybridGraphSearch).toHaveBeenCalledTimes(1);
  });

  it('emits sampled structured telemetry for production GraphRAG usage', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSampleRate = process.env.GRAPH_RAG_TELEMETRY_SAMPLE_RATE;
    process.env.NODE_ENV = 'production';
    process.env.GRAPH_RAG_TELEMETRY_SAMPLE_RATE = '1';
    vi.spyOn(Math, 'random').mockReturnValue(0);

    mockGetSupabaseClient.mockResolvedValue({} as never);
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockHybridGraphSearch.mockResolvedValue([
      {
        id: 'kb-1',
        title: 'Redis OOM 대응 가이드',
        content: '메모리 사용률 임계치 초과 시 ...',
        score: 0.93,
        sourceType: 'vector',
        hopDistance: 0,
        category: 'incident',
      },
      {
        id: 'kb-2',
        title: 'Redis 캐시 정책',
        content: 'eviction-policy 설정 확인',
        score: 0.88,
        sourceType: 'graph',
        hopDistance: 1,
        category: 'troubleshooting',
      },
    ]);

    await searchKnowledgeBase.execute({
      query: 'Redis OOM 원인 분석',
      category: 'incident',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'graph_rag_search',
        component: 'reporter_tools',
        queryCategory: 'incident',
        cacheHit: false,
        success: true,
        vectorResults: 1,
        graphResults: 1,
      }),
      '[Reporter Tools] GraphRAG telemetry',
    );

    vi.restoreAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSampleRate === undefined) {
      delete process.env.GRAPH_RAG_TELEMETRY_SAMPLE_RATE;
    } else {
      process.env.GRAPH_RAG_TELEMETRY_SAMPLE_RATE = previousSampleRate;
    }
  });
});
