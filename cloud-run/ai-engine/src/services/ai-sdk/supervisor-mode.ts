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
  request: Pick<SupervisorRequest, 'mode' | 'messages'>,
): ResolvedSupervisorModeDecision {
  const requestedMode = request.mode || 'auto';
  const singleAllowed = isSingleModeAllowed();

  // 1. Explicit Multi-agent request (Golden Path)
  if (requestedMode === 'multi') {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'explicit',
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
      };
    }
    return {
      requestedMode,
      resolvedMode: 'single',
      modeSelectionSource: 'explicit',
    };
  }

  // 3. Auto-detection (follows query complexity)
  const lastUserMessage = request.messages.filter((message) => message.role === 'user').pop();
  if (!lastUserMessage) {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_default',
    };
  }

  const resolvedMode = selectExecutionMode(lastUserMessage.content) === 'multi' ? 'multi' : 'single';

  return {
    requestedMode,
    resolvedMode,
    modeSelectionSource: 'auto_complexity',
    autoSelectedByComplexity: resolvedMode,
  };
}

export function resolveSupervisorMode(
  request: Pick<SupervisorRequest, 'mode' | 'messages'>,
): ResolvedSupervisorMode {
  return resolveSupervisorModeDecision(request).resolvedMode;
}

export function buildSupervisorModeMetadata(
  decision: ResolvedSupervisorModeDecision,
): {
  requestedMode: SupervisorMode;
  resolvedMode: ResolvedSupervisorMode;
  modeSelectionSource: SupervisorModeSelectionSource;
  autoSelectedByComplexity?: ResolvedSupervisorMode;
} {
  return {
    requestedMode: decision.requestedMode,
    resolvedMode: decision.resolvedMode,
    modeSelectionSource: decision.modeSelectionSource,
    ...(decision.autoSelectedByComplexity
      ? { autoSelectedByComplexity: decision.autoSelectedByComplexity }
      : {}),
  };
}
