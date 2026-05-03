import { isSingleModeAllowed } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import type {
  SupervisorMode,
  SupervisorModeSelectionSource,
  SupervisorRequest,
} from './supervisor-types';
import { selectExecutionMode } from './supervisor-routing';

export type ResolvedSupervisorMode = Exclude<SupervisorMode, 'auto'>;
export interface ResolvedSupervisorModeDecision {
  requestedMode: SupervisorMode;
  resolvedMode: ResolvedSupervisorMode;
  modeSelectionSource: SupervisorModeSelectionSource;
  autoSelectedByComplexity?: ResolvedSupervisorMode;
  analysisMode?: SupervisorRequest['analysisMode'];
}

const ROUTE_DECISION_RULE_VERSION = '2026-05-03-v1';

export interface SupervisorRouteDecision {
  intent: 'chat';
  executionPath: 'stream';
  mode: ResolvedSupervisorMode;
  reasonCodes: string[];
  ruleVersion: string;
  dataSlot?: string;
  traceId?: string;
  decidedBy: 'cloud-run';
}

export interface SupervisorAssistantPlan {
  kind: 'chat';
  planVersion: string;
  routeDecision: SupervisorRouteDecision;
  executionPath: 'stream';
  stream: true;
  job: false;
  reasonCodes: string[];
  dataSlot?: string;
  traceId?: string;
  decidedBy: 'cloud-run';
}

export interface SupervisorAssistantResult {
  kind: 'chat' | 'error';
  resultVersion: string;
  routeDecision?: SupervisorRouteDecision;
  status: 'completed' | 'failed' | 'partial';
  traceId?: string;
  errorCode?: string;
}

/**
 * Resolve final execution mode for the request.
 * 
 * 🎯 Strategy (2026-04-04):
 * 1. Multi-agent is the DEFAULT operational mode for OpenManager AI.
 * 2. Explicit single-agent requests are restricted and only allowed if ALLOW_DEGRADED_SINGLE=true.
 * 3. Auto mode follows query complexity so low-cost requests can stay single-agent on free tier.
 * 
 * @version 2.0.0
 */
export function resolveSupervisorModeDecision(
  request: Pick<SupervisorRequest, 'mode' | 'messages' | 'analysisMode'>,
): ResolvedSupervisorModeDecision {
  const requestedMode = request.mode || 'auto';
  const singleAllowed = isSingleModeAllowed();

  // 1. Explicit Multi-agent request (Golden Path)
  if (requestedMode === 'multi') {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'explicit',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  // 2. Explicit Single-agent request (Restricted)
  if (requestedMode === 'single') {
    if (!singleAllowed) {
      logger.warn('[SupervisorMode] Single-agent requested but NOT allowed in production. Upgrading to Multi-agent.');
      return {
        requestedMode,
        resolvedMode: 'multi',
        modeSelectionSource: 'single_disallowed_upgrade',
        ...(request.analysisMode
          ? { analysisMode: request.analysisMode }
          : {}),
      };
    }
    return {
      requestedMode,
      resolvedMode: 'single',
      modeSelectionSource: 'explicit',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  // 3. Auto-detection (follows query complexity)
  const lastUserMessage = request.messages.filter((message) => message.role === 'user').pop();
  if (!lastUserMessage) {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_default',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  const resolvedMode =
    selectExecutionMode(lastUserMessage.content, request.analysisMode) ===
    'multi'
      ? 'multi'
      : 'single';
  const modeSelectionSource =
    request.analysisMode === 'thinking' && resolvedMode === 'multi'
      ? 'analysis_mode_thinking'
      : 'auto_complexity';

  return {
    requestedMode,
    resolvedMode,
    modeSelectionSource,
    autoSelectedByComplexity: resolvedMode,
    ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
  };
}

export function resolveSupervisorMode(
  request: Pick<SupervisorRequest, 'mode' | 'messages' | 'analysisMode'>,
): ResolvedSupervisorMode {
  return resolveSupervisorModeDecision(request).resolvedMode;
}

export function buildSupervisorModeMetadata(
  decision: ResolvedSupervisorModeDecision,
  analysisMode?: SupervisorRequest['analysisMode'],
): {
  requestedMode: SupervisorMode;
  resolvedMode: ResolvedSupervisorMode;
  modeSelectionSource: SupervisorModeSelectionSource;
  autoSelectedByComplexity?: ResolvedSupervisorMode;
  analysisMode?: SupervisorRequest['analysisMode'];
} {
  return {
    requestedMode: decision.requestedMode,
    resolvedMode: decision.resolvedMode,
    modeSelectionSource: decision.modeSelectionSource,
    ...(decision.autoSelectedByComplexity
      ? { autoSelectedByComplexity: decision.autoSelectedByComplexity }
      : {}),
    ...((analysisMode ?? decision.analysisMode)
      ? { analysisMode: analysisMode ?? decision.analysisMode }
      : {}),
  };
}

export function buildSupervisorRouteDecision(
  decision: ResolvedSupervisorModeDecision,
  options?: {
    traceId?: string;
    queryAsOf?: SupervisorRequest['queryAsOf'];
  },
): SupervisorRouteDecision {
  return {
    intent: 'chat',
    executionPath: 'stream',
    mode: decision.resolvedMode,
    reasonCodes: [decision.modeSelectionSource],
    ruleVersion: ROUTE_DECISION_RULE_VERSION,
    ...(options?.queryAsOf?.dataSlot?.timeLabel && {
      dataSlot: options.queryAsOf.dataSlot.timeLabel,
    }),
    ...(options?.traceId && { traceId: options.traceId }),
    decidedBy: 'cloud-run',
  };
}

export function buildSupervisorAssistantPlan(
  routeDecision: SupervisorRouteDecision
): SupervisorAssistantPlan {
  return {
    kind: 'chat',
    planVersion: ROUTE_DECISION_RULE_VERSION,
    routeDecision,
    executionPath: 'stream',
    stream: true,
    job: false,
    reasonCodes: [...routeDecision.reasonCodes],
    ...(routeDecision.dataSlot && { dataSlot: routeDecision.dataSlot }),
    ...(routeDecision.traceId && { traceId: routeDecision.traceId }),
    decidedBy: 'cloud-run',
  };
}

export function buildSupervisorAssistantResult(
  routeDecision: SupervisorRouteDecision | undefined,
  options?: {
    status?: SupervisorAssistantResult['status'];
    errorCode?: string;
  }
): SupervisorAssistantResult {
  const status = options?.status ?? 'completed';
  return {
    kind: status === 'failed' ? 'error' : 'chat',
    resultVersion: ROUTE_DECISION_RULE_VERSION,
    ...(routeDecision && { routeDecision }),
    status,
    ...(routeDecision?.traceId && { traceId: routeDecision.traceId }),
    ...(options?.errorCode && { errorCode: options.errorCode }),
  };
}
