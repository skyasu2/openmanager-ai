/**
 * 🗄️ Supabase 무료 티어 최적화 설정
 *
 * Supabase Free Plan 한도:
 * - 데이터베이스: 500MB
 * - 파일 저장소: 1GB
 * - 월간 대역폭: 5GB
 * - 월간 활성 사용자: 50,000명
 * - API 요청: 무제한 (하지만 연결 제한 있음)
 * - pgvector: 지원 ✅
 *
 * // Reviewed: 2025-12-12
 */

export const SUPABASE_FREE_TIER_CONFIG = {
  // 📊 데이터베이스 최적화
  database: {
    maxConnections: 20, // 무료 티어 연결 제한
    queryTimeout: 10000, // 10초 쿼리 타임아웃
    batchSize: 100, // 배치 작업 최대 100개

    // 자동 정리 설정
    autoCleanup: {
      enabled: true,
      retentionDays: 30, // 30일 이상된 로그 자동 삭제
      maxRows: 10000, // 테이블당 최대 10,000행 유지
    },

    // 인덱스 최적화
    indexOptimization: {
      autoAnalyze: true,
      vacuumSchedule: 'daily', // 일일 VACUUM
    },
  },

  // 🔍 벡터 검색 최적화 (pgvector)
  vector: {
    maxVectors: 5000, // 최대 5,000개 벡터
    dimensions: 384, // 384차원 (효율적인 임베딩)
    indexType: 'ivfflat', // IVFFlat 인덱스 (메모리 효율적)

    // 검색 성능 최적화
    searchLimits: {
      maxResults: 20, // 최대 20개 결과
      similarityThreshold: 0.7, // 유사도 임계값
    },

    // 벡터 압축
    compression: {
      enabled: true,
      quantization: 'pq', // Product Quantization
    },
  },

  // 📁 스토리지 최적화
  storage: {
    maxFileSize: 50 * 1024 * 1024, // 50MB per file
    totalLimit: 800 * 1024 * 1024, // 800MB (무료 한도의 80%)

    // 자동 압축
    compression: {
      enabled: true,
      images: true, // 이미지 압축
      documents: false, // 문서는 원본 유지
    },

    // 정리 정책
    cleanup: {
      enabled: true,
      orphanedFiles: true, // 고아 파일 정리
      temporaryFiles: 7, // 임시 파일 7일 후 삭제
    },
  },

  // 🌐 대역폭 최적화
  bandwidth: {
    monthlyLimit: 4 * 1024 * 1024 * 1024, // 4GB (무료 한도의 80%)

    // 응답 압축
    compression: {
      enabled: true,
      level: 'gzip',
      threshold: 1024, // 1KB 이상 압축
    },

    // 캐싱 전략
    caching: {
      staticData: 3600, // 1시간 캐시
      dynamicData: 300, // 5분 캐시
      apiResponses: 600, // 10분 캐시
    },
  },

  // 🔐 인증 최적화
  auth: {
    maxUsers: 40000, // 40,000명 (무료 한도의 80%)
    sessionTimeout: 24 * 60 * 60, // 24시간 세션

    // 보안 설정
    security: {
      rls: true, // Row Level Security 활성화
      jwtExpiry: 3600, // 1시간 JWT 만료
    },
  },

  // 📊 모니터링 설정
  monitoring: {
    enabled: true,

    // 사용량 알림 임계값
    alerts: {
      database: 0.8, // 80% 사용 시 알림
      storage: 0.8, // 80% 사용 시 알림
      bandwidth: 0.8, // 80% 사용 시 알림
      users: 0.8, // 80% 사용 시 알림
    },

    // 실시간 메트릭
    realtime: {
      enabled: true,
      channels: 5, // 최대 5개 채널
      maxConnections: 100, // 최대 100개 동시 연결
    },
  },

  // 🔄 백업 설정
  backup: {
    enabled: true,
    schedule: 'daily', // 일일 백업
    retention: 7, // 7일 보관

    // 중요 테이블만 백업
    tables: [
      'servers',
      'metrics',
      'users',
      'ai_responses',
      'vector_embeddings',
    ],
  },

  // ⚡ 성능 최적화
  performance: {
    // 쿼리 최적화
    query: {
      enableJITCompilation: true,
      sharedPreloadLibraries: ['pg_stat_statements'],
      maxWorkerProcesses: 2, // 무료 티어 제한
    },

    // 연결 풀링
    connectionPooling: {
      enabled: true,
      maxConnections: 15, // 최대 15개 연결
      poolMode: 'transaction', // 트랜잭션 모드
    },
  },
};

/**
 * 쿼리 최적화 도우미
 */
export function optimizeQuery(
  query: string,
  options?: {
    limit?: number;
    cache?: boolean;
    timeout?: number;
  }
) {
  const { limit = 100, cache = true, timeout = 10000 } = options || {};

  let optimizedQuery = query;

  // 자동 LIMIT 추가
  if (!query.toLowerCase().includes('limit')) {
    optimizedQuery += ` LIMIT ${limit}`;
  }

  // 인덱스 힌트 추가 (필요시)
  if (query.toLowerCase().includes('where')) {
    // PostgreSQL 쿼리 플래너 힌트는 확장이 필요하므로 주석으로 대체
    optimizedQuery = `/* INDEX_HINT */ ${optimizedQuery}`;
  }

  return {
    query: optimizedQuery,
    options: {
      cache,
      timeout,
    },
  };
}

/**
 * 사용량 체크
 */
export function checkUsageThreshold(
  type: 'database' | 'storage' | 'bandwidth' | 'users',
  currentUsage: number,
  maxUsage: number
): {
  isNearLimit: boolean;
  percentage: number;
  recommendation: string;
} {
  const percentage = (currentUsage / maxUsage) * 100;
  const threshold = SUPABASE_FREE_TIER_CONFIG.monitoring.alerts[type] * 100;

  return {
    isNearLimit: percentage >= threshold,
    percentage,
    recommendation:
      percentage >= threshold
        ? `${type} 사용량이 ${percentage.toFixed(1)}%에 도달했습니다. 정리 작업을 고려해보세요.`
        : `${type} 사용량 정상: ${percentage.toFixed(1)}%`,
  };
}
