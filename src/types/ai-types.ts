/**
 * 🤖 AI 관련 공통 타입 정의 v2.0
 *
 * ✅ 중앙 집중화된 타입 시스템
 * ✅ 모드 타입 통합 관리
 * ✅ 유지보수성 향상
 */

import type { AIEngineType as CanonicalAIEngineType } from '@/schemas/ai.schema';

// ==============================================
// 🎯 AI 모드 타입 정의 (통합)
// ==============================================

/**
 * AI 모드 정의 v5.0 (Cloud Run Multi-Agent)
 * - UNIFIED: 통합 AI 엔진 (Cloud Run LLM 멀티 에이전트 + Supabase RAG)
 * @since v3.2.0 - 자동 라우팅으로 단일 모드 사용
 * @since v4.0 - 타입 단순화 (LOCAL, GOOGLE_AI, AUTO 제거)
 * @since v5.84.0 - Cloud Run AI Engine (Vercel AI SDK + Cerebras/Groq/Mistral)
 */
export type AIMode = 'UNIFIED';

/**
 * AI 엔진 타입 정의
 * v5.84.0: google-ai → cloud-run-ai로 변경
 */
export type AIEngineType = CanonicalAIEngineType;

/**
 * AI 어시스턴트 모드 (응답 깊이)
 * - basic: 빠른 응답, 기본 분석
 * - advanced: 심화 분석, 예측 기능
 */
export type AIAssistantMode = 'basic' | 'advanced';

/**
 * 전원 관리 모드
 * - active: 활성 상태
 * - idle: 유휴 상태
 * - sleep: 절전 모드
 */
export type PowerMode = 'active' | 'idle' | 'sleep';

/**
 * 응답 깊이 레벨
 */
export type ResponseDepth = 'mini' | 'standard' | 'deep' | 'comprehensive';

/**
 * 우선순위 레벨
 */
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// ==============================================
// 🔧 AI 요청/응답 인터페이스
// ==============================================

export interface AIRequest {
  query: string;
  type?: string; // 요청 타입 (자연어, 명령어, 분석 등)
  mode?: AIMode;
  agentMode?: AIAssistantMode;
  category?: string;
  context?: unknown;
  priority?: Priority;
  timeout?: number;
  enableFallback?: boolean;
  // 추가 프로퍼티
  engineType?: string;
  sessionId?: string;
  data?: unknown;
}

export interface AIResponse {
  success: boolean;
  response: string;
  data?: unknown;
  confidence: number;
  mode: AIMode;
  agentMode?: AIAssistantMode;
  enginePath: string[];
  processingTime: number;
  fallbacksUsed: number;
  metadata: AIResponseMetadata;
  performance?: PerformanceMetrics;
  error?: string;
  warnings?: string[];
  // 추가 프로퍼티
  engine?: string;
  sources?: string[];
  suggestions?: string[];
}

export interface AIResponseMetadata {
  mainEngine?: string;
  supportEngines?: string[];
  ragUsed?: boolean;
  cloudRunAIUsed?: boolean;
  mcpContextUsed?: boolean;
  subEnginesUsed?: string[];
  cacheUsed?: boolean;
  fallbackReason?: string;
  processingTime?: number;
  enginePath?: string[];
  error?: string;
  allEnginesFailed?: boolean;
  requestId?: string;
  duration?: number;
  timestamp?: string;
  confidence?: number;
  combinedResponses?: number;
  vercelPlan?: string;
  nlpUsed?: boolean;
  mcpUsed?: boolean;
  // ThreeTierAIRouter 관련 프로퍼티
  tier?: 'local' | 'gcp' | 'google';
  fallbackUsed?: boolean;
  threeTierRouter?: boolean;
  totalProcessingTime?: number;
  engine?: string;
  // 추가 프로퍼티들
  architecture?: string;
  gcpProcessingTime?: number;
  vercelProcessingTime?: number;
  tierProcessingTime?: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  engineSuccessRates: Record<string, number>;
  cacheHitRate?: number;
  memoryUsage?: number;
}

// ==============================================
// 🎛️ 모드 설정 인터페이스
// ==============================================

export interface AIEngineConfig {
  mode: AIMode;
  fallbackTimeout: number;
  confidenceThreshold: number;
  maxRetries: number;
  enableCaching: boolean;
}
