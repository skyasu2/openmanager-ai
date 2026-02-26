/**
 * AI Fallback Handler
 *
 * @description Cloud Run 장애 시 로컬 폴백 응답 생성
 *
 * @usage
 * - 503 에러 대신 사용자에게 유용한 기본 정보 제공
 * - Circuit Breaker와 함께 사용하여 Graceful Degradation 구현
 *
 * @created 2025-12-30
 */

// ============================================================================
// 타입 정의
// ============================================================================

export type AIEndpointType =
  | 'supervisor'
  | 'intelligent-monitoring'
  | 'incident-report'
  | 'approval';

/**
 * 폴백 응답 인터페이스
 */
export interface FallbackResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  source: 'fallback';
  /** 재시도까지 권장 대기 시간 (ms) */
  retryAfter?: number;
  /** 폴백 응답 생성 시각 */
  generatedAt: string;
  /** 인덱스 시그니처 (Record<string, unknown> 호환성) */
  [key: string]: unknown;
}

/**
 * Supervisor 폴백 데이터
 */
export interface SupervisorFallbackData {
  response: string;
  suggestions: string[];
  serverStatus?: {
    available: boolean;
    message: string;
  };
}

/**
 * Intelligent Monitoring 폴백 데이터
 * Cloud Run 응답 스키마와 일치: anomalyDetection, trendPrediction, patternAnalysis
 */
export interface IntelligentMonitoringFallbackData {
  anomalyDetection: null;
  trendPrediction: null;
  patternAnalysis: null;
  message: string;
}

/**
 * Incident Report 폴백 데이터
 */
export interface IncidentReportFallbackData {
  report: null;
  summary: string;
  recommendation: string;
}

/**
 * Approval 폴백 데이터
 */
export interface ApprovalFallbackData {
  hasPending: false;
  action: null;
  message: string;
}

// ============================================================================
// 폴백 메시지 템플릿
// ============================================================================

const FALLBACK_MESSAGES = {
  supervisor: {
    title: 'AI 서비스 일시 중단',
    message:
      'AI 분석 서비스가 일시적으로 불안정합니다. 기본 시스템 정보를 제공합니다.',
    suggestions: [
      '대시보드에서 서버 상태를 직접 확인하세요',
      '30초 후 다시 질문해 주세요',
      '긴급한 경우 시스템 관리자에게 문의하세요',
    ],
  },
  'intelligent-monitoring': {
    title: '예측 서비스 일시 중단',
    message:
      'AI 예측 분석 서비스가 일시적으로 중단되었습니다. 수동 모니터링을 권장합니다.',
  },
  'incident-report': {
    title: '보고서 생성 일시 중단',
    message: '인시던트 보고서 생성이 일시적으로 불가능합니다.',
    recommendation: '대시보드의 서버 상태 및 최근 로그를 직접 확인해 주세요.',
  },
  approval: {
    title: '승인 시스템 일시 중단',
    message: '승인 상태 확인이 일시적으로 불가능합니다.',
  },
} as const;

// ============================================================================
// 폴백 응답 생성 함수
// ============================================================================

/**
 * 엔드포인트별 폴백 응답 생성
 *
 * @param endpoint - AI 엔드포인트 타입
 * @param context - 추가 컨텍스트 (세션 ID, 쿼리 등)
 * @returns FallbackResponse
 *
 * @example
 * // Supervisor 폴백
 * const response = createFallbackResponse('supervisor', { query: '서버 상태' });
 *
 * @example
 * // Intelligent Monitoring 폴백
 * const response = createFallbackResponse('intelligent-monitoring');
 */
export function createFallbackResponse(
  endpoint: 'supervisor',
  context?: { sessionId?: string; query?: string }
): FallbackResponse<SupervisorFallbackData>;

export function createFallbackResponse(
  endpoint: 'intelligent-monitoring',
  context?: { sessionId?: string }
): FallbackResponse<IntelligentMonitoringFallbackData>;

export function createFallbackResponse(
  endpoint: 'incident-report',
  context?: { sessionId?: string }
): FallbackResponse<IncidentReportFallbackData>;

export function createFallbackResponse(
  endpoint: 'approval',
  context?: { sessionId?: string }
): FallbackResponse<ApprovalFallbackData>;

export function createFallbackResponse(
  endpoint: AIEndpointType,
  _context?: { sessionId?: string; query?: string }
): FallbackResponse {
  const now = new Date().toISOString();
  const retryAfter = 30000; // 30초

  switch (endpoint) {
    case 'supervisor':
      return {
        success: true,
        message: FALLBACK_MESSAGES.supervisor.message,
        data: {
          response: FALLBACK_MESSAGES.supervisor.message,
          suggestions: [...FALLBACK_MESSAGES.supervisor.suggestions],
          serverStatus: {
            available: false,
            message: 'AI 분석 서비스 일시 중단',
          },
        } as SupervisorFallbackData,
        source: 'fallback',
        retryAfter,
        generatedAt: now,
      };

    case 'intelligent-monitoring':
      return {
        success: true,
        message: FALLBACK_MESSAGES['intelligent-monitoring'].message,
        data: {
          anomalyDetection: null,
          trendPrediction: null,
          patternAnalysis: null,
          message: FALLBACK_MESSAGES['intelligent-monitoring'].message,
        } as IntelligentMonitoringFallbackData,
        source: 'fallback',
        retryAfter,
        generatedAt: now,
      };

    case 'incident-report':
      return {
        success: true,
        message: FALLBACK_MESSAGES['incident-report'].message,
        data: {
          report: null,
          summary: FALLBACK_MESSAGES['incident-report'].message,
          recommendation: FALLBACK_MESSAGES['incident-report'].recommendation,
        } as IncidentReportFallbackData,
        source: 'fallback',
        retryAfter,
        generatedAt: now,
      };

    case 'approval':
      return {
        success: true,
        message: FALLBACK_MESSAGES.approval.message,
        data: {
          hasPending: false,
          action: null,
          message: FALLBACK_MESSAGES.approval.message,
        } as ApprovalFallbackData,
        source: 'fallback',
        retryAfter,
        generatedAt: now,
      };
  }
}

/**
 * 폴백 여부 확인 유틸리티
 */
export function isFallbackResponse<T>(
  response: unknown
): response is FallbackResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'source' in response &&
    (response as FallbackResponse).source === 'fallback'
  );
}

/**
 * 폴백 응답을 HTTP Response로 변환
 */
export function createFallbackHttpResponse(
  fallback: FallbackResponse,
  statusCode = 200
): Response {
  return new Response(JSON.stringify(fallback), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Fallback-Response': 'true',
      'X-Retry-After': String(fallback.retryAfter ?? 30000),
    },
  });
}
