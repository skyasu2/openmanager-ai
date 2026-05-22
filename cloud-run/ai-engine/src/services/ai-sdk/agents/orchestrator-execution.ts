/**
 * Direct multi-agent router execution logic.
 *
 * Main entry points: executeMultiAgent and executeMultiAgentStream.
 *
 * @version 4.0.0
 */

import {
  getContextSummary,
  getOrCreateSessionContext,
} from './context-store';

import {
  type MultiAgentRequest,
  type MultiAgentResponse,
  type MultiAgentError,
} from './orchestrator-types';
import { resolveRAGSetting, resolveWebSearchSetting } from './orchestrator-web-search';
import { preFilterQuery, saveAgentFindingsToContext } from './orchestrator-context';
import { extractQueryRoutingSignals } from '../routing/query-routing-signals';
import {
  attachAgentDecision,
  attachPreFilterDecision,
  createPreFilterDecision,
  createRoutingDecisionTrace,
  sanitizeRoutingDecisionTrace,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';

import {
  executeForcedRouting,
  getRecentHandoffs,
} from './orchestrator-routing';
import { logger } from '../../../lib/logger';
import {
  buildFastPathResponse,
  executeVisionOrFallback,
  finalizeMultiAgentError,
  finalizeMultiAgentResponse,
  getLastUserQuery,
  mapOrchestratorErrorCode,
} from './orchestrator-execution-helpers';
import {
  createSupervisorTrace,
} from '../../observability/langfuse';
import {
  createDirectAgentDecision,
  resolveDirectRoutingTarget,
} from './orchestrator-direct-routing';
import {
  normalizeSupervisorInputType,
  normalizeSupervisorIntentFrame,
} from '../supervisor-semantic-metadata';

export { getRecentHandoffs };
export { executeMultiAgentStream } from './orchestrator-execution-stream';

function attachRoutingDecisionTrace(
  response: MultiAgentResponse,
  routingTrace: RoutingDecisionTrace
): MultiAgentResponse {
  return {
    ...response,
    metadata: {
      ...response.metadata,
      routingDecisionTrace: sanitizeRoutingDecisionTrace(routingTrace),
    },
  };
}

// ============================================================================
// Main Execution Functions
// ============================================================================

export async function executeMultiAgent(
  request: MultiAgentRequest
): Promise<MultiAgentResponse | MultiAgentError> {
  const startTime = Date.now();

  const query = getLastUserQuery(request);
  if (!query) {
    return { success: false, error: 'No user message found', code: 'INVALID_REQUEST' };
  }

  const trace = createSupervisorTrace({
    sessionId: request.sessionId,
    mode: 'multi',
    query,
    requestedMode: request.requestedMode,
    resolvedMode: request.resolvedMode,
    modeSelectionSource: request.modeSelectionSource,
    autoSelectedByComplexity: request.autoSelectedByComplexity,
    upstreamTraceId: request.traceId,
  });

  const webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, query);
  const ragEnabled = resolveRAGSetting(request.enableRAG, query);
  logger.debug(`[WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  logger.debug(`[RAG] Setting resolved: ${ragEnabled} (request: ${request.enableRAG})`);
  let routingTrace = createRoutingDecisionTrace(
    extractQueryRoutingSignals(query, {
      hasImageAttachments: !!(request.images && request.images.length > 0),
      hasFileAttachments: !!(request.files && request.files.length > 0),
    })
  );

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);
  const contextSummary = await getContextSummary(request.sessionId);

  // Fast Path
  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  routingTrace = attachPreFilterDecision(
    routingTrace,
    createPreFilterDecision(query, preFilterResult)
  );
  logger.debug(`[PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    const response = attachRoutingDecisionTrace(
      buildFastPathResponse(preFilterResult.directResponse, startTime),
      routingTrace
    );
    logger.info(
      `[Fast Path] Direct response in ${response.metadata.durationMs}ms (confidence: ${preFilterResult.confidence})`
    );
    return finalizeMultiAgentResponse(trace, response);
  }

  const directTarget = resolveDirectRoutingTarget(preFilterResult, {
    intentFrame: normalizeSupervisorIntentFrame(request.metadata?.intentFrame),
    inputType: normalizeSupervisorInputType(request.metadata?.inputType),
  });
  logger.info(
    `[Direct Routing] ${directTarget.agentName} selected (source=${directTarget.source}, confidence=${directTarget.confidence})`
  );

  try {
    const agentResult =
      directTarget.agentName === 'Vision Agent'
        ? await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files, request.dataSource, request.domainId, request.internalDisclosureMode)
        : request.domainEvidencePrompt
          ? await executeForcedRouting(
              query,
              directTarget.agentName,
              startTime,
              webSearchEnabled,
              ragEnabled,
              request.images,
              request.files,
              contextSummary,
              request.dataSource,
              request.domainId,
              request.internalDisclosureMode,
              request.domainEvidencePrompt
            )
          : await executeForcedRouting(
              query,
              directTarget.agentName,
              startTime,
              webSearchEnabled,
              ragEnabled,
              request.images,
              request.files,
              contextSummary,
              request.dataSource,
              request.domainId,
              request.internalDisclosureMode
            );

    if (!agentResult) {
      return finalizeMultiAgentError(
        trace,
        {
          success: false,
          error: `Direct routing target unavailable: ${directTarget.agentName}`,
          code: 'DIRECT_ROUTING_UNAVAILABLE',
        },
        Date.now() - startTime
      );
    }

    const finalAgentName = agentResult.finalAgent ?? directTarget.agentName;
    routingTrace = attachAgentDecision(
      routingTrace,
      createDirectAgentDecision({
        ...directTarget,
        agentName: finalAgentName,
      })
    );
    await saveAgentFindingsToContext(
      request.sessionId,
      finalAgentName,
      agentResult.response
    );

    return finalizeMultiAgentResponse(
      trace,
      attachRoutingDecisionTrace(
        {
          ...agentResult,
          handoffs: [
            {
              from: 'Direct Router',
              to: finalAgentName,
              reason: directTarget.reason,
            },
          ],
        },
        routingTrace
      )
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Direct Router] Error after ${durationMs}ms:`, errorMessage);
    return finalizeMultiAgentError(trace, {
      success: false,
      error: errorMessage,
      code: mapOrchestratorErrorCode(errorMessage),
    }, durationMs);
  }
}
