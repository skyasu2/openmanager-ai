/**
 * Types for useHybridAIQuery hook
 *
 * @description 하이브리드 AI 쿼리 훅의 타입 정의
 */

import type { UIMessage } from '@ai-sdk/react';
import type {
  ClarificationOption,
  ClarificationRequest,
} from '@/lib/ai/clarification-generator';
import type { QueryComplexity } from '@/lib/ai/utils/query-complexity';
import type { AsyncQueryProgress, AsyncQueryResult } from '../useAsyncAIQuery';
import type { FileAttachment } from '../useFileAttachments';

// Re-export clarification types for convenience
export type { ClarificationRequest, ClarificationOption };

export type QueryMode = 'streaming' | 'job-queue';

export interface HybridQueryState {
  /** 현재 쿼리 모드 */
  mode: QueryMode;
  /** 쿼리 복잡도 */
  complexity: QueryComplexity | null;
  /** Job Queue 진행률 (job-queue 모드에서만) */
  progress: AsyncQueryProgress | null;
  /** Job ID (job-queue 모드에서만) */
  jobId: string | null;
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 명확화 요청 (모호한 쿼리일 때) */
  clarification: ClarificationRequest | null;
  /** 처리 지연 경고 메시지 (25초 초과 시) */
  warning: string | null;
  /** 현재 처리 경과 시간 (ms) */
  processingTime: number;
  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds: number;
}

/**
 * 스트리밍 이벤트 타입
 * Cloud Run AI Engine의 StreamEventType과 동기화
 */
export type StreamEventType =
  | 'text_delta'
  | 'tool_call'
  | 'tool_result'
  | 'step_finish'
  | 'handoff'
  | 'agent_status'
  | 'warning' // 처리 지연 경고 (25초 초과 시) (2026-01-19)
  | 'redirect' // Job Queue 리다이렉트 이벤트 (2026-01-18)
  | 'done'
  | 'error';

/**
 * Agent Status 타입
 */
export type AgentStatus = 'thinking' | 'processing' | 'completed' | 'idle';

/**
 * Handoff 이벤트 데이터
 */
export interface HandoffEventData {
  from: string;
  to: string;
  reason?: string;
}

/**
 * Agent Status 이벤트 데이터
 */
export interface AgentStatusEventData {
  agent: string;
  status: AgentStatus;
}

/**
 * Redirect 이벤트 데이터 (Job Queue 전환)
 */
export interface RedirectEventData {
  mode: 'job-queue';
  complexity: QueryComplexity;
  estimatedTime: number;
  message: string;
}

/**
 * Warning 이벤트 데이터 (처리 지연 또는 스트림 에러)
 */
export type WarningEventData =
  | {
      code: 'SLOW_PROCESSING';
      message: string;
      elapsed: number;
      threshold: number;
    }
  | {
      code: 'STREAM_ERROR_OCCURRED';
      message: string;
    };

/**
 * 스트리밍 데이터 파트 타입
 * AI SDK v5 onData 콜백으로 받는 데이터
 */
export interface StreamDataPart {
  type: StreamEventType | string;
  data?: unknown;
  /** 텍스트 청크 (type: 'text_delta') */
  text?: string;
  /** 도구 호출 (type: 'tool_call') */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  /** 사용자 정의 데이터 알림 (type: 'data-notification') */
  message?: string;
  level?: 'info' | 'warning' | 'error';
  /** Handoff 이벤트 데이터 (type: 'handoff') */
  handoff?: HandoffEventData;
  /** Agent Status 이벤트 데이터 (type: 'agent_status') */
  agentStatus?: AgentStatusEventData;
  /** Warning 이벤트 데이터 (type: 'warning') */
  warning?: WarningEventData;
  /** Redirect 이벤트 데이터 (type: 'redirect') */
  redirect?: RedirectEventData;
}

export interface UseHybridAIQueryOptions {
  /** 세션 ID */
  sessionId?: string;
  /** API 엔드포인트 */
  apiEndpoint?: string;
  /** 복잡도 임계값 (이 점수 초과시 Job Queue 사용) */
  complexityThreshold?: number;
  /** 스트리밍 완료 콜백 */
  onStreamFinish?: () => void;
  /** Job 결과 콜백 */
  onJobResult?: (result: AsyncQueryResult) => void;
  /** 진행률 업데이트 콜백 */
  onProgress?: (progress: AsyncQueryProgress) => void;
  /** 웹 검색 활성화 여부 (Tavily) */
  webSearchEnabled?: boolean;
  /** RAG (Knowledge Base 검색) 활성화 여부 */
  ragEnabled?: boolean;
  /**
   * 스트리밍 데이터 콜백 (AI SDK v6 베스트 프랙티스)
   * 실시간으로 데이터 파트를 받아 처리
   * @example
   * ```tsx
   * onData: (dataPart) => {
   *   if (dataPart.type === 'data-notification') {
   *     showToast(dataPart.message, dataPart.level);
   *   }
   * }
   * ```
   */
  onData?: (dataPart: StreamDataPart) => void;
}

export interface UseHybridAIQueryReturn {
  /** 쿼리 전송 (자동 라우팅), 파일 첨부 지원 */
  sendQuery: (query: string, attachments?: FileAttachment[]) => void;
  /** 현재 상태 */
  state: HybridQueryState;
  /** 메시지 목록 (스트리밍 모드) */
  messages: UIMessage[];
  /** 메시지 설정 */
  setMessages: (messages: UIMessage[]) => void;
  /** 진행률 (0-100) */
  progressPercent: number;
  /** 진행 메시지 */
  progressMessage: string;
  /** 스트리밍/Job Queue 로딩 중 */
  isLoading: boolean;
  /** 생성 중단 */
  stop: () => void;
  /** 취소 (Job Queue 전용) */
  cancel: () => Promise<void>;
  /** 상태 리셋 */
  reset: () => void;
  /** 에러 상태만 초기화 */
  clearError: () => void;
  /** 현재 모드 */
  currentMode: QueryMode;
  /** 복잡도 미리 분석 (UI에서 힌트 표시용) */
  previewComplexity: (query: string) => QueryComplexity;
  /** 쿼리 직접 실행 (분류/명확화 건너뛰기, 재시도용) */
  executeQuery: (
    query: string,
    attachments?: FileAttachment[],
    isRetry?: boolean
  ) => void;
  /** 명확화 옵션 선택 */
  selectClarification: (option: ClarificationOption) => void;
  /** 커스텀 명확화 입력 */
  submitCustomClarification: (customInput: string) => void;
  /** 명확화 건너뛰기 (원본 쿼리 그대로 전송) */
  skipClarification: () => void;
  /** 명확화 취소 (쿼리 미실행, 상태 정리만) */
  dismissClarification: () => void;
}
