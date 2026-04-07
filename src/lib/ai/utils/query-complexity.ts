/**
 * Query Complexity Analyzer
 *
 * @description 사용자 쿼리의 복잡도를 분석하여 동적 타임아웃 계산
 *
 * @created 2025-12-30
 * @updated 2026-02-03 - P1: 카테고리 가중치 설정 외부화
 */

import { getComplexityCategoryWeights } from '@/config/ai-proxy.config';

// ============================================================================
// 타입 정의
// ============================================================================

export type QueryComplexity =
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'very_complex';

export interface ComplexityAnalysis {
  level: QueryComplexity;
  score: number; // 0-100
  factors: string[];
  recommendedTimeout: number; // ms
}

// ============================================================================
// 복잡도 키워드 패턴
// ============================================================================

/**
 * 복잡도 증가 키워드 (한국어 + 영어)
 */
const COMPLEXITY_KEYWORDS = {
  // 분석 관련 (복잡도 +20)
  analysis: [
    '분석',
    '패턴',
    'analyze',
    'analysis',
    'pattern',
    '추세',
    'trend',
    '비교',
    'compare',
    '상관관계',
    'correlation',
  ],
  // 예측 관련 (복잡도 +25)
  prediction: [
    '예측',
    'predict',
    'forecast',
    '전망',
    '미래',
    'future',
    '예상',
    'expect',
  ],
  // 집계 관련 (복잡도 +15)
  aggregation: [
    '전체',
    '모든',
    'all',
    'every',
    '평균',
    'average',
    '합계',
    'sum',
    'total',
    '최대',
    'max',
    '최소',
    'min',
  ],
  // 시간 범위 (복잡도 +10~30)
  timeRange: [
    '지난 주',
    'last week',
    '지난 달',
    'last month',
    '최근',
    'recent',
    '기간',
    'period',
    '24시간',
    '7일',
    '30일',
    '1년',
  ],
  // 다중 서버 (복잡도 +15)
  multiServer: [
    '서버들',
    'servers',
    '모든 서버',
    'all servers',
    '클러스터',
    'cluster',
    '그룹',
    'group',
  ],
  // 보고서 생성 (복잡도 +20)
  report: [
    '보고서',
    'report',
    '리포트',
    '요약',
    'summary',
    '정리',
    '문서',
    'document',
  ],
  // 원인 분석 (복잡도 +30)
  rootCause: [
    '원인',
    'cause',
    '왜',
    'why',
    '이유',
    'reason',
    '근본',
    'root',
    '진단',
    'diagnose',
  ],
  // RAG 검색 (복잡도 +25) - KB 기반 검색은 HyDE + Rerank으로 지연 발생
  ragSearch: [
    '과거 장애',
    '장애 이력',
    '유사 사례',
    '이전 사례',
    '해결 사례',
    'past incident',
    'similar case',
    'knowledge base',
  ],
};

/**
 * 단순 쿼리 패턴 (복잡도 감소)
 */
const SIMPLE_PATTERNS = [
  /^(안녕|hello|hi|hey)/i,
  /^(상태|status)(\s*(확인|check))?$/i,
  /^(현재|now|current)\s*(상태|status)/i,
  /^(도움|help|도와)/i,
  /^(뭐|what)\s*(해|할)/i,
];

const STREAMING_SUMMARY_KEYWORDS = ['상태', '현황', '개요', '요약'] as const;
const DEEP_ANALYSIS_KEYWORDS = [
  '분석',
  '비교',
  '예측',
  '추천',
  '원인',
  '패턴',
  '트렌드',
  '상관관계',
  '리포트',
  '보고서',
  '최적화',
  '개선',
  '이력',
  '히스토리',
  '기간',
  '7일',
  '30일',
  '근본 원인',
] as const;
const MULTI_STEP_INTENT_KEYWORDS = [
  '그리고',
  '후에',
  '다음에',
  '기반으로',
  '먼저',
  '마지막으로',
  '추가로',
] as const;

const STREAMING_ALERT_ANALYSIS_METRIC_PATTERN =
  /(cpu|메모리|memory|mem|디스크|disk)\s*사용률.*\d{1,3}%/i;
const STREAMING_ALERT_ANALYSIS_CAUSE_PATTERN = /(현재\s*)?(원인|발생 원인)/i;
const STREAMING_ALERT_ANALYSIS_ACTION_PATTERN =
  /(우선\s*조치|조치\s*방법|대응\s*방안|재발\s*방지)/i;
const STREAMING_ALERT_ANALYSIS_BROAD_SCOPE_PATTERN =
  /(전체|모든|비교|예측|리포트|보고서|7일|30일|히스토리|이력|클러스터|group|cluster)/i;

function shouldPreferStreamingSummaryQuery(query: string): boolean {
  if (query.length > 80) return false;

  const hasSummaryIntent = STREAMING_SUMMARY_KEYWORDS.some((keyword) =>
    query.includes(keyword)
  );
  if (!hasSummaryIntent) return false;

  const hasDeepAnalysisIntent = DEEP_ANALYSIS_KEYWORDS.some((keyword) =>
    query.includes(keyword)
  );
  if (hasDeepAnalysisIntent) return false;

  const hasMultiStepIntent = MULTI_STEP_INTENT_KEYWORDS.some((keyword) =>
    query.includes(keyword)
  );
  if (hasMultiStepIntent) return false;

  return /(알려줘|보여줘|정리해줘|요약해줘|확인해줘|체크해줘)/.test(query);
}

function shouldPreferStreamingAlertAnalysisQuery(query: string): boolean {
  if (query.length > 140) return false;
  if (!query.includes('서버')) return false;
  if (STREAMING_ALERT_ANALYSIS_BROAD_SCOPE_PATTERN.test(query)) return false;
  if (!STREAMING_ALERT_ANALYSIS_METRIC_PATTERN.test(query)) return false;
  if (!STREAMING_ALERT_ANALYSIS_CAUSE_PATTERN.test(query)) return false;

  return (
    STREAMING_ALERT_ANALYSIS_ACTION_PATTERN.test(query) ||
    /분석해줘|분석해\s*줘/.test(query)
  );
}

// ============================================================================
// 복잡도 분석 함수
// ============================================================================

/**
 * 쿼리 복잡도 분석
 *
 * @param query - 사용자 쿼리 텍스트
 * @returns 복잡도 분석 결과
 */
export function analyzeQueryComplexity(query: string): ComplexityAnalysis {
  const normalizedQuery = query.toLowerCase().trim();
  let score = 0;
  const factors: string[] = [];

  if (shouldPreferStreamingSummaryQuery(normalizedQuery)) {
    return {
      level: 'simple',
      score: 15,
      factors: ['streaming_summary_query'],
      recommendedTimeout: 15000,
    };
  }

  if (shouldPreferStreamingAlertAnalysisQuery(normalizedQuery)) {
    return {
      level: 'moderate',
      // Routing uses the numeric threshold (default 19), not the level label.
      // Keep single-server alert prefill prompts on streaming by staying below it.
      score: 18,
      factors: ['streaming_alert_analysis_query'],
      recommendedTimeout: 30000,
    };
  }

  // 1. 단순 패턴 체크
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        level: 'simple',
        score: 10,
        factors: ['simple_greeting_or_status'],
        recommendedTimeout: 15000, // 15초
      };
    }
  }

  // 2. 쿼리 길이 기반 점수
  const queryLength = normalizedQuery.length;
  if (queryLength > 200) {
    score += 20;
    factors.push('long_query');
  } else if (queryLength > 100) {
    score += 10;
    factors.push('medium_query');
  }

  // 3. 복잡도 키워드 체크 (v7.1.1: 가중치 설정 외부화)
  const categoryWeights = getComplexityCategoryWeights();
  for (const [category, keywords] of Object.entries(COMPLEXITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        // 설정된 가중치 사용 (미설정 시 기본값 10)
        const weight =
          categoryWeights[category as keyof typeof categoryWeights] ?? 10;
        score += weight;
        factors.push(`keyword_${category}`);
        break; // 카테고리당 한 번만 카운트
      }
    }
  }

  // 4. 질문 복잡도 (다중 질문)
  const questionMarks = (normalizedQuery.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    score += questionMarks * 5;
    factors.push(`multiple_questions_${questionMarks}`);
  }

  // 5. 숫자/날짜 범위 체크
  const hasDateRange = /\d{4}[-/]\d{2}[-/]\d{2}/.test(normalizedQuery);
  const hasTimeRange =
    /\d+\s*(시간|일|주|달|년|hour|day|week|month|year)/i.test(normalizedQuery);
  if (hasDateRange || hasTimeRange) {
    score += 10;
    factors.push('date_time_range');
  }

  // 6. 복잡도 레벨 결정
  let level: QueryComplexity;
  let recommendedTimeout: number;

  if (score <= 20) {
    level = 'simple';
    recommendedTimeout = 15000; // 15초
  } else if (score <= 45) {
    level = 'moderate';
    recommendedTimeout = 30000; // 30초
  } else if (score <= 70) {
    level = 'complex';
    recommendedTimeout = 45000; // 45초
  } else {
    level = 'very_complex';
    recommendedTimeout = 55000; // Vercel 60초 제한으로 상한 조정 (Job Queue 전환 대상)
  }

  return {
    level,
    score: Math.min(score, 100),
    factors,
    recommendedTimeout,
  };
}

/**
 * 동적 타임아웃 계산
 *
 * @param query - 사용자 쿼리 텍스트
 * @param options - 추가 옵션
 * @returns 권장 타임아웃 (ms)
 */
export function calculateDynamicTimeout(
  query: string,
  options?: {
    minTimeout?: number;
    maxTimeout?: number;
    messageCount?: number;
  }
): number {
  const {
    minTimeout = 10000,
    maxTimeout = 55000, // Vercel 60초 제한 고려 (5초 안전 마진)
    messageCount = 1,
  } = options || {};

  const analysis = analyzeQueryComplexity(query);
  let timeout = analysis.recommendedTimeout;

  // 메시지 수에 따른 추가 시간 (대화 컨텍스트 처리)
  if (messageCount > 10) {
    timeout += 5000; // +5초
  }
  if (messageCount > 20) {
    timeout += 10000; // +10초
  }

  // 최소/최대 제한 적용
  return Math.max(minTimeout, Math.min(timeout, maxTimeout));
}

// ============================================================================
// 의도 기반 Job Queue 강제 라우팅
// ============================================================================

/**
 * Job Queue 강제 라우팅 키워드
 * 이 키워드가 포함된 쿼리는 점수와 무관하게 Job Queue로 라우팅
 *
 * @description
 * - 보고서/리포트: 복잡한 마크다운 생성 필요
 * - 예측/전망: 시계열 분석 필요
 * - 장애/근본원인: 다단계 분석 필요
 *
 * @updated 2026-01-21 - 근본 원인 해결을 위해 추가
 */
const JOB_QUEUE_FORCE_KEYWORDS = [
  // 보고서 관련
  '보고서',
  '리포트',
  'report',
  // 예측 관련
  '예측',
  '전망',
  'forecast',
  'predict',
  // 장애 분석 관련
  '장애',
  '근본 원인',
  'root cause',
  // 종합 분석 관련
  '종합 분석',
  '전체 분석',
  '심층 분석',
  // RAG 심층 검색 관련 (HyDE + Rerank으로 14초+ 소요)
  '과거 장애 이력 분석',
  '유사 사례 비교',
] as const;

/**
 * 의도 기반 Job Queue 강제 라우팅 판단
 *
 * @description
 * 특정 키워드가 포함된 쿼리는 점수(threshold)와 무관하게
 * Job Queue로 라우팅해야 함. 이는 다음 이유 때문:
 * 1. 보고서 생성은 복잡한 마크다운 구조화 필요
 * 2. 예측 쿼리는 시계열 데이터 분석 필요
 * 3. 장애 분석은 다단계 원인 추적 필요
 *
 * @param query - 사용자 쿼리 텍스트
 * @returns Job Queue 강제 라우팅 여부와 매칭된 키워드
 *
 * @example
 * shouldForceJobQueue("장애 보고서 작성해줘") // { force: true, matchedKeyword: "보고서" }
 * shouldForceJobQueue("CPU 사용률 알려줘") // { force: false, matchedKeyword: null }
 */
export function shouldForceJobQueue(query: string): {
  force: boolean;
  matchedKeyword: string | null;
  reason: string | null;
} {
  const normalizedQuery = query.toLowerCase().trim();

  for (const keyword of JOB_QUEUE_FORCE_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      return {
        force: true,
        matchedKeyword: keyword,
        reason: `Query contains "${keyword}" which requires extended processing time`,
      };
    }
  }

  return {
    force: false,
    matchedKeyword: null,
    reason: null,
  };
}

/**
 * 타임아웃 추천 메시지 생성
 *
 * @param analysis - 복잡도 분석 결과
 * @returns 사용자 안내 메시지
 */
// ============================================================================
// Job Queue용 복잡도 분석 (ai-jobs 타입 호환)
// ============================================================================

import type {
  ComplexityAnalysis as JobComplexityAnalysis,
  QueryComplexity as JobQueryComplexity,
} from '@/types/ai-jobs';

const JOB_SIMPLE_KEYWORDS = [
  '상태',
  '현재',
  '알려줘',
  '보여줘',
  '요약',
  '현황',
  '개요',
  '정리',
  '뭐야',
  '어때',
  '몇',
  '있어',
  '확인',
];
const JOB_COMPLEX_KEYWORDS = [
  '분석',
  '최적화',
  '리포트',
  '보고서',
  '전체',
  '모든',
  '비교',
  '예측',
  '추천',
  '개선',
  '원인',
  '패턴',
  '트렌드',
  '상관관계',
  '종합',
];
const JOB_MULTI_STEP_KEYWORDS = [
  '그리고',
  '후에',
  '다음에',
  '기반으로',
  '먼저',
  '마지막으로',
  '추가로',
];
const JOB_DATA_HEAVY_KEYWORDS = [
  '7일',
  '30일',
  '일주일',
  '한달',
  '기간',
  '히스토리',
  '이력',
  '기록',
  '전체 서버',
  '모든 서버',
];

const JOB_ESTIMATED_TIMES: Record<JobQueryComplexity, number> = {
  simple: 5,
  medium: 30,
  complex: 55,
};

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
}

/**
 * Job Queue용 쿼리 복잡도 분석 (ai-jobs 타입 호환)
 */
export function analyzeJobQueryComplexity(
  query: string
): JobComplexityAnalysis {
  const q = query.toLowerCase().trim();
  const dataKeywordMatches = countKeywordMatches(q, JOB_DATA_HEAVY_KEYWORDS);
  const broadScopeMatchCount = Number(
    q.includes('전체 서버') || q.includes('모든 서버')
  );

  if (shouldPreferStreamingSummaryQuery(q)) {
    return {
      level: 'simple',
      estimatedTime: 8,
      factors: {
        dataVolume:
          dataKeywordMatches > broadScopeMatchCount ? 'medium' : 'low',
        analysisDepth: 'shallow',
        multiStep: false,
        keywordCount: countKeywordMatches(q, JOB_SIMPLE_KEYWORDS),
      },
      useJobQueue: false,
    };
  }

  if (shouldPreferStreamingAlertAnalysisQuery(q)) {
    return {
      level: 'simple',
      estimatedTime: 12,
      factors: {
        dataVolume: 'low',
        analysisDepth: 'shallow',
        multiStep: false,
        keywordCount: 1,
      },
      useJobQueue: false,
    };
  }

  const s = countKeywordMatches(q, JOB_SIMPLE_KEYWORDS);
  const c = countKeywordMatches(q, JOB_COMPLEX_KEYWORDS);
  const m = countKeywordMatches(q, JOB_MULTI_STEP_KEYWORDS);
  const d = dataKeywordMatches;
  const score = c * 2 + m * 1.5 + d * 1.5 - s * 0.5;
  let level: JobQueryComplexity =
    score <= 0 ? 'simple' : score <= 3 ? 'medium' : 'complex';
  if (q.length > 100 && level === 'simple') level = 'medium';
  return {
    level,
    estimatedTime: JOB_ESTIMATED_TIMES[level],
    factors: {
      dataVolume: d >= 2 ? 'high' : d >= 1 || c >= 2 ? 'medium' : 'low',
      analysisDepth: c >= 2 || d >= 1 ? 'deep' : 'shallow',
      multiStep: m > 0,
      keywordCount: c + m,
    },
    useJobQueue: level !== 'simple',
  };
}

/**
 * 쿼리에서 Job 타입 자동 추론
 */
export function inferJobType(
  query: string
): 'analysis' | 'report' | 'optimization' | 'prediction' | 'general' {
  const q = query.toLowerCase();
  if (/리포트|보고서|report/i.test(q)) return 'report';
  if (/최적화|개선|optimize/i.test(q)) return 'optimization';
  if (/예측|forecast|predict/i.test(q)) return 'prediction';
  if (/분석|분석해|analyze/i.test(q)) return 'analysis';
  return 'general';
}

export function getTimeoutGuidance(analysis: ComplexityAnalysis): string {
  const timeoutSec = Math.round(analysis.recommendedTimeout / 1000);

  switch (analysis.level) {
    case 'simple':
      return `빠른 응답이 예상됩니다 (~${timeoutSec}초)`;
    case 'moderate':
      return `분석 중입니다... (~${timeoutSec}초 소요 예상)`;
    case 'complex':
      return `복잡한 분석 중입니다... (~${timeoutSec}초 소요 예상)`;
    case 'very_complex':
      return `심층 분석 중입니다... 최대 ${timeoutSec}초 소요될 수 있습니다`;
    default:
      return `처리 중... (~${timeoutSec}초)`;
  }
}
