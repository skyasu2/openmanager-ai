import type { AIMetadata } from '@/types/ai-service-types';

export interface DocumentMetadata {
  category?: string;
  title?: string;
  tags?: string[];
  source?: string;
  author?: string;
  timestamp?: string;
  priority?: number;
  version?: string;
  [key: string]: unknown;
}

export interface RAGSearchOptions {
  maxResults?: number;
  threshold?: number;
  category?: string;
  includeContext?: boolean;
  cached?: boolean;
  enableKeywordFallback?: boolean; // 키워드 기반 fallback 활성화
  useLocalEmbeddings?: boolean; // 로컬 임베딩 강제 사용
  _intent?: QueryIntent; // Phase 3: 캐시 메타데이터용 (내부 사용)
}

export interface RAGEngineSearchResult {
  success: boolean;
  results: Array<{
    id: string;
    content: string;
    similarity: number;
    metadata?: AIMetadata;
  }>;
  context?: string;
  totalResults: number;
  processingTime: number;
  cached: boolean;
  error?: string;
  metadata?: {
    processingTime?: number;
  };
  queryEmbedding?: number[];
}

export interface _EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

export interface RAGSearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: AIMetadata;
}

/**
 * 🎯 쿼리 의도 타입 (AI analyzeRequest 결과)
 */
export type QueryIntent = 'monitoring' | 'analysis' | 'guide' | 'general';

/**
 * 🔍 컨텍스트 기반 검색 옵션
 */
export interface RAGContextSearchOptions extends RAGSearchOptions {
  /** 쿼리 의도 (자동 카테고리 매핑) */
  intent?: QueryIntent;
  /** 복잡도 힌트 1-5 (자동 maxResults 조정) */
  complexity?: number;
}

/**
 * 📊 컨텍스트 검색 결과 (메타데이터 포함)
 */
export interface RAGContextSearchResult extends RAGEngineSearchResult {
  _meta: {
    intent?: QueryIntent;
    complexity?: number;
    resolvedCategory?: string;
    resolvedMaxResults: number;
  };
}

/**
 * 🕐 Intent 기반 캐시 TTL 설정 (초)
 */
export const INTENT_TTL_SECONDS: Record<QueryIntent, number> = {
  monitoring: 3600, // 1시간 - 서버 메트릭은 자주 변경
  analysis: 21600, // 6시간 - 트러블슈팅 데이터는 안정적
  guide: 86400, // 24시간 - 가이드는 거의 변경 없음
  general: 10800, // 3시간 - 기본값
};

/**
 * 📦 캐시 엔트리 메타데이터
 */
export interface CacheEntryMeta {
  intent?: QueryIntent;
  category?: string;
  scenarioDay: number; // 24시간 로테이션 일자 (Date.now() / 86400000 정수)
}
