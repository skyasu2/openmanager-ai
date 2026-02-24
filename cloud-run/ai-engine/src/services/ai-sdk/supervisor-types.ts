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

export interface SupervisorRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  enableTracing?: boolean;
  /**
   * Execution mode:
   * - 'single': Use single-agent with multi-step tool calling (default)
   * - 'multi': Use multi-agent orchestration with handoffs
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
  /** Upstream trace ID (W3C traceparent에서 추출). Langfuse 연동에 사용. */
  traceId?: string;
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
    traceId?: string;
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
    finalAgent?: string;
    /** Provider 불가 시 fallback 응답 여부 */
    fallback?: boolean;
    /** Fallback 사유 (e.g. 'no_provider', 'circuit_open') */
    fallbackReason?: string;
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
