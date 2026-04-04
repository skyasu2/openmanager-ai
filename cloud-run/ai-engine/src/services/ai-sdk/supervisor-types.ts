/**
 * Supervisor Types and Stream Event Definitions
 *
 * @version 2.0.0
 */

import type { ImageAttachment, FileAttachment } from './agents/base-agent';

// Re-export multimodal types
export type { ImageAttachment, FileAttachment };

// ============================================================================
// Types
// ============================================================================

export type SupervisorMode = 'single' | 'multi' | 'auto';
export type SupervisorModeSelectionSource =
  | 'explicit'
  | 'auto_complexity'
  | 'auto_default'
  | 'single_disallowed_upgrade';

export interface SupervisorRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  enableTracing?: boolean;
  /**
   * Execution mode:
   * - 'multi': Use multi-agent orchestration with handoffs (Standard default)
   * - 'single': Use single-agent (Restricted, for emergency/degraded ops)
   * - 'auto': Automatically select based on query complexity
   */
  mode?: SupervisorMode;
  /**
   * Image attachments for multimodal queries (Vision Agent)
   */
  images?: ImageAttachment[];
  /**
   * File attachments for multimodal queries (PDF, audio, etc.)
   */
  files?: FileAttachment[];
  /**
   * Web search control:
   * - true: Always enable web search
   * - false: Disable web search
   * - 'auto': Auto-detect based on query keywords (default)
   */
  enableWebSearch?: boolean | 'auto';
  /**
   * RAG (Knowledge Base) control:
   * - true: Enable searchKnowledgeBase tool
   * - false: Disable RAG tool (default)
   */
  enableRAG?: boolean;
  /** Upstream trace ID (W3C traceparent에서 추출). Langfuse 연동에 사용. */
  traceId?: string;
  /** 클라이언트 디바이스 타입 (응답 길이/형식 최적화) */
  deviceType?: 'mobile' | 'desktop';
}

export interface SupervisorResponse {
  success: boolean;
  response: string;
  toolsCalled: string[];
  toolResults: Record<string, unknown>[];
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
    url?: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    provider: string;
    modelId: string;
    stepsExecuted: number;
    durationMs: number;
    responseChars?: number;
    formatCompliance?: boolean;
    qualityFlags?: string[];
    latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
    mode?: SupervisorMode;
    requestedMode?: SupervisorMode;
    resolvedMode?: Exclude<SupervisorMode, 'auto'>;
    modeSelectionSource?: SupervisorModeSelectionSource;
    autoSelectedByComplexity?: Exclude<SupervisorMode, 'auto'>;
    traceId?: string;
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
    finalAgent?: string;
    /** Provider 불가 시 fallback 응답 여부 */
    fallback?: boolean;
    /** Fallback 사유 (e.g. 'no_provider', 'circuit_open') */
    fallbackReason?: string;
    /** 상위 실행 모드에서 강등된 경우의 원래 모드 */
    degradedFromMode?: 'multi';
    /** 강등(Degraded)된 직접 원인 */
    degradedReason?: string;
  };
}

export interface SupervisorError {
  success: false;
  error: string;
  code: string;
}

export type StreamEventType =
  | 'tool_call'
  | 'tool_result'
  | 'text_delta'
  | 'step_finish'
  | 'handoff'
  | 'agent_status'
  | 'warning'
  | 'done'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

export interface SupervisorHealth {
  status: 'ok' | 'degraded' | 'error';
  provider: string;
  modelId: string;
  toolsAvailable: number;
}
