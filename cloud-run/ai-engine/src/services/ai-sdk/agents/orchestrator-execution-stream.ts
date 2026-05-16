import type { StreamEvent } from '../supervisor';

import {
  getContextSummary,
  getOrCreateSessionContext,
} from './context-store';
import {
  type MultiAgentRequest,
} from './orchestrator-types';
import { resolveRAGSetting, resolveWebSearchSetting } from './orchestrator-web-search';
import { preFilterQuery } from './orchestrator-context';
import { extractQueryRoutingSignals } from '../routing/query-routing-signals';
import {
  attachAgentDecision,
  attachPreFilterDecision,
  createPreFilterDecision,
  createRoutingDecisionTrace,
  sanitizeRoutingDecisionTrace,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';
import { logger } from '../../../lib/logger';
import {
  resolveVisionFallbackAgent,
  streamFastPathResponse,
  streamWithTrace,
} from './orchestrator-execution-helpers';
import { executeAgentStream } from './orchestrator-agent-stream';
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

export async function* executeMultiAgentStream(
  request: MultiAgentRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();

  const query = request.messages
    .filter((message) => message.role === 'user')
    .pop()?.content ?? null;
  if (!query) {
    yield { type: 'error', data: { code: 'INVALID_REQUEST', error: 'No user message found' } };
    return;
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
  logger.debug(`[Stream WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  logger.debug(`[Stream RAG] Setting resolved: ${ragEnabled} (request: ${request.enableRAG})`);
  let routingTrace: RoutingDecisionTrace = createRoutingDecisionTrace(
    extractQueryRoutingSignals(query, {
      analysisMode: request.analysisMode,
      hasImageAttachments: !!(request.images && request.images.length > 0),
      hasFileAttachments: !!(request.files && request.files.length > 0),
    })
  );
  const buildRoutingTraceMetadata = () => ({
    routingDecisionTrace: sanitizeRoutingDecisionTrace(routingTrace),
  });

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Stream Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);
  const contextSummary = await getContextSummary(request.sessionId);

  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  routingTrace = attachPreFilterDecision(
    routingTrace,
    createPreFilterDecision(query, preFilterResult)
  );
  logger.debug(`[Stream PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    yield* streamWithTrace(
      trace,
      startTime,
      streamFastPathResponse(preFilterResult.directResponse, startTime),
      buildRoutingTraceMetadata()
    );
    return;
  }

  const directTarget = resolveDirectRoutingTarget(preFilterResult, {
    intentFrame: normalizeSupervisorIntentFrame(request.metadata?.intentFrame),
    inputType: normalizeSupervisorInputType(request.metadata?.inputType),
  });
  logger.info(
    `[Stream Direct Routing] ${directTarget.agentName} selected (source=${directTarget.source}, confidence=${directTarget.confidence})`
  );

  const directResolvedTarget = resolveVisionFallbackAgent(
    directTarget.agentName
  );
  if (directResolvedTarget.degradedFromVision) {
    logger.warn(
      '[Stream] Vision providers unavailable (Gemini/OpenRouter), falling back to Analyst Agent'
    );
    yield {
      type: 'agent_status',
      data: {
        agent: 'Vision Agent',
        status: 'processing',
        message: 'Vision Agent 사용 불가, Analyst Agent로 전환 중...',
      },
    };
  }
  routingTrace = attachAgentDecision(
    routingTrace,
    createDirectAgentDecision({
      ...directTarget,
      agentName: directResolvedTarget.targetAgent,
    })
  );

  yield* streamWithTrace(
    trace,
    startTime,
    executeAgentStream(
      query,
      directResolvedTarget.targetAgent,
      startTime,
      request.sessionId,
      webSearchEnabled,
      ragEnabled,
      request.images,
      request.files,
      contextSummary,
      request.dataSource,
      request.domainId,
      request.domainEvidencePrompt
    ),
    buildRoutingTraceMetadata()
  );
}
