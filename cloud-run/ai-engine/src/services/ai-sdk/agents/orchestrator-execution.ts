/**
 * Orchestrator Execution Logic
 *
 * Main entry points: executeMultiAgent and executeMultiAgentStream.
 *
 * @version 4.0.0
 */

import { routingSchema, getAgentFromRouting, type RoutingDecision } from './schemas';
import {
  getContextSummary,
  getOrCreateSessionContext,
  recordHandoffEvent,
} from './context-store';

import {
  ORCHESTRATOR_CONFIG,
  ORCHESTRATOR_INSTRUCTIONS,
  buildRoutingPrompt,
  type MultiAgentRequest,
  type MultiAgentResponse,
  type MultiAgentError,
} from './orchestrator-types';
import { resolveRAGSetting, resolveWebSearchSetting } from './orchestrator-web-search';
import { preFilterQuery, saveAgentFindingsToContext } from './orchestrator-context';
import { getKSTDateTime } from '../../../lib/time-utils';
import { extractQueryRoutingSignals } from '../routing/query-routing-signals';
import {
  attachAgentDecision,
  attachPreFilterDecision,
  createAgentDecisionFromFallback,
  createAgentDecisionFromLlmRouting,
  createAgentDecisionFromPreFilter,
  createPreFilterDecision,
  createRoutingDecisionTrace,
  sanitizeRoutingDecisionTrace,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';

import {
  getOrchestratorModel,
  executeForcedRouting,
  recordHandoff,
  getRecentHandoffs,
  ORCHESTRATOR_PROVIDER_ORDER,
} from './orchestrator-routing';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { evaluateAgentResponseQuality } from './response-quality';
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
  decomposeTask,
  executeParallelSubtasks,
} from './orchestrator-decomposition';
import { generateStructuredOutputWithFallback } from './orchestrator-object-fallback';
import {
  createSupervisorTrace,
} from '../../observability/langfuse';

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
      analysisMode: request.analysisMode,
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

  let forcedRoutingAttempted = false;

  // Forced Routing: trust high-confidence deterministic specialist signals
  // before spending an Orchestrator decomposition LLM call.
  logger.debug(`[Orchestrator] Forced routing check: suggestedAgent=${preFilterResult.suggestedAgent}, confidence=${preFilterResult.confidence}`);

  if (
    preFilterResult.suggestedAgent &&
    preFilterResult.confidence >= ORCHESTRATOR_CONFIG.forcedRoutingConfidence
  ) {
    forcedRoutingAttempted = true;
    const suggestedAgentName = preFilterResult.suggestedAgent;
    logger.info(`[Orchestrator] Triggering forced routing to ${suggestedAgentName}`);

    let forcedResult: MultiAgentResponse | null = null;

    if (suggestedAgentName === 'Vision Agent') {
      logger.info(`[Vision] Using AgentFactory for Vision Agent`);
      forcedResult = await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files, request.dataSource, request.domainId, request.internalDisclosureMode);
    } else {
      forcedResult = await executeForcedRouting(
        query,
        suggestedAgentName,
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
    }

    if (forcedResult) {
      logger.info(`[Orchestrator] Forced routing succeeded`);
      const finalAgentName = forcedResult.finalAgent ?? suggestedAgentName;
      routingTrace = attachAgentDecision(
        routingTrace,
        createAgentDecisionFromPreFilter({
          selectedAgent: finalAgentName,
          confidence: preFilterResult.confidence,
        })
      );
      await saveAgentFindingsToContext(
        request.sessionId,
        finalAgentName,
        forcedResult.response
      );
      return finalizeMultiAgentResponse(
        trace,
        attachRoutingDecisionTrace(forcedResult, routingTrace)
      );
    }
    logger.warn('[Orchestrator] Forced routing failed, falling back to LLM routing');
  } else {
    logger.debug(`[Orchestrator] Skipping forced routing (conditions not met)`);
  }

  // Task Decomposition
  const decomposition = forcedRoutingAttempted ? null : await decomposeTask(query);
  if (forcedRoutingAttempted) {
    logger.debug(
      '[Orchestrator] Skipping task decomposition after high-confidence forced routing attempt'
    );
  }

  if (decomposition && decomposition.subtasks.length > 1) {
    logger.info(`[Orchestrator] Complex query detected, using Orchestrator-Worker pattern`);

    if (decomposition.requiresSequential) {
      logger.info('[Orchestrator] Executing subtasks sequentially (dependencies detected)');
      let lastResult: MultiAgentResponse | null = null;

      for (const subtask of decomposition.subtasks) {
        lastResult = await executeForcedRouting(
          subtask.task,
          subtask.agent,
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
        if (!lastResult) {
          logger.warn(`⚠️ [Orchestrator] Sequential subtask failed: ${subtask.agent}`);
          break;
        }
        await saveAgentFindingsToContext(request.sessionId, subtask.agent, lastResult.response);
      }

      if (lastResult) {
        return finalizeMultiAgentResponse(trace, lastResult);
      }
    } else {
      const parallelResult = await executeParallelSubtasks(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files, request.dataSource, request.domainId, request.internalDisclosureMode
      );

      if (parallelResult) {
        return finalizeMultiAgentResponse(trace, parallelResult);
      }
    }

    logger.warn('[Orchestrator] Task decomposition failed, falling back to single-agent routing');
  }

  if (
    !forcedRoutingAttempted &&
    decomposition &&
    decomposition.subtasks.length < 2 &&
    preFilterResult.suggestedAgent &&
    preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence
  ) {
    const suggestedAgentName = preFilterResult.suggestedAgent;
    logger.debug(
      `[Orchestrator] Decomposition was not composite, falling back to ${suggestedAgentName} before LLM routing`
    );

    let fallbackResult: MultiAgentResponse | null = null;

    if (suggestedAgentName === 'Vision Agent') {
      fallbackResult = await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files, request.dataSource, request.domainId, request.internalDisclosureMode);
    } else {
      fallbackResult = await executeForcedRouting(
        query,
        suggestedAgentName,
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
    }

    if (fallbackResult) {
      const finalAgentName = fallbackResult.finalAgent ?? suggestedAgentName;
      routingTrace = attachAgentDecision(
        routingTrace,
        createAgentDecisionFromFallback({
          selectedAgent: finalAgentName,
          confidence: preFilterResult.confidence,
        })
      );
      await saveAgentFindingsToContext(
        request.sessionId,
        finalAgentName,
        fallbackResult.response
      );
      return finalizeMultiAgentResponse(
        trace,
        attachRoutingDecisionTrace(
          {
            ...fallbackResult,
            handoffs: [
              {
                from: 'Orchestrator',
                to: finalAgentName,
                reason: 'Fallback routing (decomposition not composite)',
              },
            ],
          },
          routingTrace
        )
      );
    }
  }

  // LLM-based routing
  const orchestratorModelConfig = getOrchestratorModel();

  if (!orchestratorModelConfig) {
    return finalizeMultiAgentError(
      trace,
      { success: false, error: 'Orchestrator not available (no AI provider configured)', code: 'MODEL_UNAVAILABLE' },
      Date.now() - startTime
    );
  }

  try {
    const { model, provider, modelId } = orchestratorModelConfig;

    logger.info(`[Orchestrator] LLM routing with ${provider}/${modelId} (suggested: ${preFilterResult.suggestedAgent || 'none'})`);

    const routingPrompt = buildRoutingPrompt(
      contextSummary ? `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}` : query
    );

    const routingTimeout = TIMEOUT_CONFIG.orchestrator.routingDecision;
    let routingTimeoutId: ReturnType<typeof setTimeout> | undefined;

    let routingDecision: RoutingDecision;
    try {
      const routingResult = await Promise.race([
        generateStructuredOutputWithFallback({
          model,
          schema: routingSchema,
          system: `현재 날짜: ${getKSTDateTime().date} (KST)\n\n${ORCHESTRATOR_INSTRUCTIONS}`,
          prompt: routingPrompt,
          temperature: 0.1,
          operation: 'orchestrator-routing',
          provider,
          modelId,
          providerFallback: {
            agentLabel: 'Orchestrator',
            providerOrder: ORCHESTRATOR_PROVIDER_ORDER,
            cbPrefix: 'orchestrator',
          },
        }),
        new Promise<never>((_, reject) => {
          routingTimeoutId = setTimeout(() => {
            reject(
              new Error(`Routing decision timeout after ${routingTimeout}ms`)
            );
          }, routingTimeout);
        }),
      ]);
      routingDecision = routingResult.object;
    } catch (routingError) {
      const errorMessage =
        routingError instanceof Error ? routingError.message : String(routingError);
      logger.warn(`[Orchestrator] LLM routing failed: ${errorMessage}`);

      const suggestedAgent = preFilterResult.suggestedAgent;
      if (
        suggestedAgent &&
        preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence
      ) {
        const fallbackResult =
          suggestedAgent === 'Vision Agent'
            ? await executeVisionOrFallback(
                query,
                startTime,
                webSearchEnabled,
                ragEnabled,
                request.images,
                request.files,
                request.dataSource,
                request.domainId,
                request.internalDisclosureMode
              )
            : await executeForcedRouting(
                query,
                suggestedAgent,
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

        if (fallbackResult) {
          const finalAgentName = fallbackResult.finalAgent ?? suggestedAgent;
          routingTrace = attachAgentDecision(
            routingTrace,
            createAgentDecisionFromFallback({
              selectedAgent: finalAgentName,
              confidence: preFilterResult.confidence,
            })
          );
          await saveAgentFindingsToContext(
            request.sessionId,
            finalAgentName,
            fallbackResult.response
          );

          const isTimeoutError = /timeout/i.test(errorMessage);
          return finalizeMultiAgentResponse(
            trace,
            attachRoutingDecisionTrace(
              {
                ...fallbackResult,
                handoffs: [
                  {
                    from: 'Orchestrator',
                    to: finalAgentName,
                    reason: isTimeoutError
                      ? 'Fallback routing (routing timeout)'
                      : 'Fallback routing (routing failure)',
                  },
                ],
              },
              routingTrace
            )
          );
        }
      }

      throw routingError;
    } finally {
      if (routingTimeoutId !== undefined) clearTimeout(routingTimeoutId);
    }

    logger.debug(`[Orchestrator] LLM routing decision: ${routingDecision.selectedAgent} (confidence: ${routingDecision.confidence.toFixed(2)}, reason: ${routingDecision.reasoning})`);

    const selectedAgent = getAgentFromRouting(routingDecision);

    if (selectedAgent) {
      recordHandoff('Orchestrator', selectedAgent, 'LLM routing');
      await recordHandoffEvent(request.sessionId, 'Orchestrator', selectedAgent, 'LLM routing');

      let agentResult: MultiAgentResponse | null = null;

      if (selectedAgent === 'Vision Agent') {
        agentResult = await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files, request.dataSource, request.domainId, request.internalDisclosureMode);
      } else {
        agentResult = await executeForcedRouting(
          query,
          selectedAgent,
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
      }

      if (agentResult) {
        const finalAgentName = agentResult.finalAgent ?? selectedAgent;
        routingTrace = attachAgentDecision(
          routingTrace,
          createAgentDecisionFromLlmRouting({
            selectedAgent: finalAgentName,
            confidence: routingDecision.confidence,
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
              handoffs: [{
                from: 'Orchestrator',
                to: finalAgentName,
                reason: 'LLM routing decision',
              }],
            },
            routingTrace
          )
        );
      }
    }

    const suggestedAgent = preFilterResult.suggestedAgent;
    if (suggestedAgent && preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence) {
      logger.debug(`[Orchestrator] LLM routing inconclusive, falling back to ${suggestedAgent}`);

      const fallbackResult =
        suggestedAgent === 'Vision Agent'
          ? await executeVisionOrFallback(
              query,
              startTime,
              webSearchEnabled,
              ragEnabled,
              request.images,
              request.files,
              request.dataSource,
              request.domainId,
              request.internalDisclosureMode
            )
          : await executeForcedRouting(
              query,
              suggestedAgent,
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

      if (fallbackResult) {
        const finalAgentName = fallbackResult.finalAgent ?? suggestedAgent;
        routingTrace = attachAgentDecision(
          routingTrace,
          createAgentDecisionFromFallback({
            selectedAgent: finalAgentName,
            confidence: preFilterResult.confidence,
          })
        );
        await saveAgentFindingsToContext(
          request.sessionId,
          finalAgentName,
          fallbackResult.response
        );

        return finalizeMultiAgentResponse(
          trace,
          attachRoutingDecisionTrace(
            {
              ...fallbackResult,
              handoffs: [{
                from: 'Orchestrator',
                to: finalAgentName,
                reason: 'Fallback routing (LLM inconclusive)',
              }],
            },
            routingTrace
          )
        );
      }
    }

    const durationMs = Date.now() - startTime;
    const fallbackResponse = routingDecision.reasoning || '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다.';
    const quality = evaluateAgentResponseQuality('Orchestrator', fallbackResponse, { durationMs });

    routingTrace = attachAgentDecision(
      routingTrace,
      createAgentDecisionFromFallback({})
    );

    return finalizeMultiAgentResponse(
      trace,
      attachRoutingDecisionTrace(
        {
          success: true,
          response: fallbackResponse,
          handoffs: [],
          finalAgent: 'Orchestrator',
          toolsCalled: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: {
            provider,
            modelId,
            totalRounds: 1,
            handoffCount: 0,
            durationMs,
            responseChars: quality.responseChars,
            formatCompliance: quality.formatCompliance,
            qualityFlags: quality.qualityFlags,
            latencyTier: quality.latencyTier,
          },
        },
        routingTrace
      )
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Orchestrator] Error after ${durationMs}ms:`, errorMessage);
    return finalizeMultiAgentError(trace, {
      success: false,
      error: errorMessage,
      code: mapOrchestratorErrorCode(errorMessage),
    }, durationMs);
  }
}
