/**
 * AI Job Queue 타입 정의
 *
 * @description 비동기 AI 작업 처리를 위한 타입 정의
 * @version 1.0.0
 */

// ============================================
// Job 상태 및 타입
// ============================================

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobType =
  | 'analysis'
  | 'report'
  | 'optimization'
  | 'prediction'
  | 'general';

export type JobPriority = 'low' | 'normal' | 'high';

// ============================================
// API Request/Response 타입
// ============================================

/** Job 생성 요청 */
export interface CreateJobRequest {
  type: JobType;
  query: string;
  options?: {
    priority?: JobPriority;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  };
}

/** Worker 트리거 상태 */
export type TriggerStatus = 'sent' | 'timeout' | 'failed' | 'skipped';

/** Job 생성 응답 */
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  pollUrl: string;
  estimatedTime: number; // seconds
  /** Worker 트리거 결과 (sent: 전송됨, timeout: 타임아웃, failed: 실패, skipped: 건너뜀) */
  triggerStatus?: TriggerStatus;
}

/** Job 상태 조회 응답 */
export interface JobStatusResponse {
  jobId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  result: AIJobResult | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** Job 목록 조회 응답 */
export interface JobListResponse {
  jobs: JobStatusResponse[];
  total: number;
  hasMore: boolean;
}

// ============================================
// 내부 타입
// ============================================

/** Redis 저장용 Job 엔티티 */
export interface AIJob {
  id: string;
  sessionId: string | null;
  type: JobType;
  query: string;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  result: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  metadata: {
    complexity: string;
    estimatedTime: number;
    factors: Record<string, unknown>;
    retryCount?: number;
  };
}

/** AI Job 결과 */
export interface AIJobResult {
  content: string;
  summary?: string;
  data?: Record<string, unknown>;
  sources?: string[];
  confidence?: number;
  processingTime?: number;
}

// ============================================
// 쿼리 복잡도 분석
// ============================================

export type QueryComplexity = 'simple' | 'medium' | 'complex';

export interface ComplexityAnalysis {
  level: QueryComplexity;
  estimatedTime: number; // seconds
  factors: {
    dataVolume: 'low' | 'medium' | 'high';
    analysisDepth: 'shallow' | 'deep';
    multiStep: boolean;
    keywordCount: number;
  };
  useJobQueue: boolean;
}

// ============================================
// Worker 관련 타입
// ============================================

/** Redis에 저장되는 Job 진행 상태 */
export interface RedisJobProgress {
  stage: string;
  progress: number;
  message?: string;
  updatedAt: string;
}

/** Worker에서 진행률 업데이트 */
export interface JobProgressUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
}

/** Worker 처리 완료 */
export interface JobCompletionUpdate {
  jobId: string;
  status: 'completed' | 'failed';
  result?: AIJobResult;
  error?: string;
}

// ============================================
// 유틸리티 함수 타입
// ============================================

/** 복잡도 분석 함수 시그니처 */
export type AnalyzeComplexityFn = (query: string) => ComplexityAnalysis;

/** 예상 시간 계산 함수 시그니처 */
export type EstimateTimeFn = (complexity: QueryComplexity) => number;
