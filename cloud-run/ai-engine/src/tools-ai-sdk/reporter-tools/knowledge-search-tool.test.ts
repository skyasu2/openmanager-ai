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

vi.mock('../../lib/llamaindex-rag-service', () => ({
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

import { searchKnowledgeBase } from './knowledge-search-tool';

describe('searchKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
