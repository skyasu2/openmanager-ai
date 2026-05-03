/**
 * Supervisor Types and Stream Event Definitions
 *
 * @version 2.0.0
 */

import type { ImageAttachment, FileAttachment } from './agents/base-agent';
import type {
  EvidenceCard,
  RetrievalMetadata,
} from '../../lib/retrieval-contract';
import type { QueryAsOf } from '../../data/query-as-of-context';

// Re-export multimodal types
export type { ImageAttachment, FileAttachment };

// ============================================================================
// Types
// ============================================================================

export type SupervisorMode = 'single' | 'multi' | 'auto';
export type AnalysisMode = 'auto' | 'thinking';
export type SupervisorRouteDecisionExecutionPath =
  | 'stream'
  | 'job'
  | 'client-artifact';
export type SupervisorRouteDecisionMode = 'single' | 'multi';
export type SupervisorRouteDecisionComplexity =
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'very_complex';
export type SupervisorRouteDecisionDecider = 'frontend' | 'bff' | 'cloud-run';
export type SupervisorPlannerExecutionMode =
  | 'deterministic'
  | 'single-agent'
  | 'multi-agent';
export type SupervisorPlannerEscalationReasonCode =
  | 'rca_requested'
  | 'incident_report_requested'
  | 'cross_domain_evidence_required'
  | 'advisor_requested'
  | 'vision_input_present'
  | 'analysis_mode_thinking'
  | 'single_path_low_confidence';
export type SupervisorPlannerDriftReasonCode =
  | 'execution_path_mismatch'
  | 'execution_mode_mismatch'
  | 'artifact_kind_mismatch'
  | 'reason_code_mismatch'
  | 'local_decision_missing'
  | 'shadow_plan_unavailable';
export type SupervisorModeSelectionSource =
  | 'explicit'
  | 'auto_complexity'
  | 'auto_default'
  | 'single_disallowed_upgrade'
  | 'analysis_mode_thinking';

export interface SupervisorLocalRouteDecision {
  intent: 'chat' | 'artifact' | 'job' | 'clarification';
  executionPath: SupervisorRouteDecisionExecutionPath;
  mode?: SupervisorRouteDecisionMode;
  artifactKind?:
    | 'server-snapshot'
    | 'incident-report'
    | 'monitoring-analysis';
  complexity?: SupervisorRouteDecisionComplexity;
  reasonCodes: string[];
  ruleVersion: string;
  dataSlot?: string;
  traceId?: string;
  decidedBy: SupervisorRouteDecisionDecider;
}

export interface SupervisorPlannerShadowCandidate {
  kind: 'chat' | 'artifact' | 'clarification';
  executionPath: SupervisorRouteDecisionExecutionPath;
  executionMode: SupervisorPlannerExecutionMode;
  artifactKind?:
    | 'server-snapshot'
    | 'incident-report'
    | 'monitoring-analysis';
  reasonCodes: string[];
  escalationReasonCodes?: SupervisorPlannerEscalationReasonCode[];
  decidedBy: 'cloud-run';
}

export interface SupervisorPlannerShadowLocalDecision {
  intent?: SupervisorLocalRouteDecision['intent'];
  executionPath: SupervisorRouteDecisionExecutionPath;
  mode?: SupervisorRouteDecisionMode;
  complexity?: SupervisorRouteDecisionComplexity;
  reasonCodes: string[];
  decidedBy: SupervisorRouteDecisionDecider;
}

export interface SupervisorPlannerShadowDrift {
  matched: boolean;
  reasonCodes: SupervisorPlannerDriftReasonCode[];
}

export interface SupervisorPlannerShadow {
  plannerVersion?: string;
  candidate: SupervisorPlannerShadowCandidate;
  localDecision?: SupervisorPlannerShadowLocalDecision;
  drift?: SupervisorPlannerShadowDrift;
  latencyMs?: number;
}

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
  /** 사용자 선택 분석 강도 모드 */
  analysisMode?: AnalysisMode;
  /** Upstream trace ID (W3C traceparent에서 추출). Langfuse 연동에 사용. */
  traceId?: string;
  /** Job creation time data slot used to answer "current" metric questions. */
  queryAsOf?: QueryAsOf;
  /** 클라이언트 디바이스 타입 (응답 길이/형식 최적화) */
  deviceType?: 'mobile' | 'desktop';
  /** BFF/frontend route decision captured before Cloud Run planning. */
  localRouteDecision?: SupervisorLocalRouteDecision;
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
  /** New retrieval evidence contract. Kept alongside ragSources during migration. */
  evidenceCards?: EvidenceCard[];
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
    analysisMode?: AnalysisMode;
    routeDecision?: {
      intent: 'chat';
      executionPath: 'stream';
      mode: Exclude<SupervisorMode, 'auto'>;
      reasonCodes: string[];
      ruleVersion: string;
      dataSlot?: string;
      traceId?: string;
      decidedBy: 'cloud-run';
    };
    assistantPlan?: {
      kind: 'chat';
      planVersion: string;
      routeDecision: {
        intent: 'chat';
        executionPath: 'stream';
        mode: Exclude<SupervisorMode, 'auto'>;
        reasonCodes: string[];
        ruleVersion: string;
        dataSlot?: string;
        traceId?: string;
        decidedBy: 'cloud-run';
      };
      executionPath: 'stream';
      executionMode?: 'single-agent' | 'multi-agent';
      stream: true;
      job: false;
      reasonCodes: string[];
      plannerShadow?: SupervisorPlannerShadow;
      dataSlot?: string;
      traceId?: string;
      decidedBy: 'cloud-run';
    };
    assistantResult?: {
      kind: 'chat' | 'error';
      resultVersion: string;
      routeDecision?: {
        intent: 'chat';
        executionPath: 'stream';
        mode: Exclude<SupervisorMode, 'auto'>;
        reasonCodes: string[];
        ruleVersion: string;
        dataSlot?: string;
        traceId?: string;
        decidedBy: 'cloud-run';
      };
      status: 'completed' | 'failed' | 'partial';
      traceId?: string;
      errorCode?: string;
    };
    traceId?: string;
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
    toolResultSummaries?: Array<{
      toolName: string;
      label: string;
      summary: string;
      preview?: string;
      status: 'completed' | 'failed';
    }>;
    finalAgent?: string;
    /** Provider 불가 시 fallback 응답 여부 */
    fallback?: boolean;
    /** Fallback 사유 (e.g. 'no_provider', 'circuit_open') */
    fallbackReason?: string;
    /** Retrieval execution contract for UI/Langfuse: enabled vs used vs suppressed. */
    retrieval?: RetrievalMetadata;
    /** Data slot captured when the async job was created. */
    queryAsOf?: QueryAsOf;
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
