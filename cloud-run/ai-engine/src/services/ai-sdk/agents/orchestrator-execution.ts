/**
 * Orchestrator Execution Logic
 *
 * Main entry points: executeMultiAgent and executeMultiAgentStream.
 *
 * @version 4.0.0
 */

import type { StreamEvent } from '../supervisor';

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
import { getKSTDateTime } from '../../../data/precomputed-state';

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
  getTraceId,
  mapOrchestratorErrorCode,
  resolveVisionFallbackAgent,
  streamFastPathResponse,
  streamWithTrace,
} from './orchestrator-execution-helpers';
import {
  decomposeTask,
  executeParallelSubtasks,
  executeParallelSubtasksStream,
  executeSequentialSubtasksStream,
} from './orchestrator-decomposition';
import { executeAgentStream } from './orchestrator-agent-stream';
import { generateObjectWithFallback } from './orchestrator-object-fallback';
import {
  createSupervisorTrace,
  finalizeTrace,
} from '../../observability/langfuse';

export { getRecentHandoffs };

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

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);
  const contextSummary = await getContextSummary(request.sessionId);

  // Fast Path
  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  logger.debug(`[PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    const response = buildFastPathResponse(preFilterResult.directResponse, startTime);
    logger.info(
      `[Fast Path] Direct response in ${response.metadata.durationMs}ms (confidence: ${preFilterResult.confidence})`
    );
    return finalizeMultiAgentResponse(trace, response);
  }

  // Task Decomposition
  const decomposition = await decomposeTask(query);

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
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      );

      if (parallelResult) {
        return finalizeMultiAgentResponse(trace, parallelResult);
      }
    }

    logger.warn('[Orchestrator] Task decomposition failed, falling back to single-agent routing');
  }

  // Forced Routing
  logger.debug(`[Orchestrator] Forced routing check: suggestedAgent=${preFilterResult.suggestedAgent}, confidence=${preFilterResult.confidence}`);

  if (
    preFilterResult.suggestedAgent &&
    preFilterResult.confidence >= ORCHESTRATOR_CONFIG.forcedRoutingConfidence
  ) {
    const suggestedAgentName = preFilterResult.suggestedAgent;
    logger.info(`[Orchestrator] Triggering forced routing to ${suggestedAgentName}`);

    let forcedResult: MultiAgentResponse | null = null;

    if (suggestedAgentName === 'Vision Agent') {
      logger.info(`[Vision] Using AgentFactory for Vision Agent`);
      forcedResult = await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files);
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
      );
    }

    if (forcedResult) {
      logger.info(`[Orchestrator] Forced routing succeeded`);
      const finalAgentName = forcedResult.finalAgent ?? suggestedAgentName;
      await saveAgentFindingsToContext(
        request.sessionId,
        finalAgentName,
        forcedResult.response
      );
      return finalizeMultiAgentResponse(trace, forcedResult);
    }
    logger.warn('[Orchestrator] Forced routing failed, falling back to LLM routing');
  } else {
    logger.debug(`[Orchestrator] Skipping forced routing (conditions not met)`);
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
        generateObjectWithFallback({
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
                request.files
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
              );

        if (fallbackResult) {
          const finalAgentName = fallbackResult.finalAgent ?? suggestedAgent;
          await saveAgentFindingsToContext(
            request.sessionId,
            finalAgentName,
            fallbackResult.response
          );

          const isTimeoutError = /timeout/i.test(errorMessage);
          return finalizeMultiAgentResponse(trace, {
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
          });
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
        agentResult = await executeVisionOrFallback(query, startTime, webSearchEnabled, ragEnabled, request.images, request.files);
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
        );
      }

      if (agentResult) {
        const finalAgentName = agentResult.finalAgent ?? selectedAgent;
        await saveAgentFindingsToContext(
          request.sessionId,
          finalAgentName,
          agentResult.response
        );

        return finalizeMultiAgentResponse(trace, {
          ...agentResult,
          handoffs: [{
            from: 'Orchestrator',
            to: finalAgentName,
            reason: 'LLM routing decision',
          }],
        });
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
              request.files
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
            );

      if (fallbackResult) {
        const finalAgentName = fallbackResult.finalAgent ?? suggestedAgent;
        await saveAgentFindingsToContext(
          request.sessionId,
          finalAgentName,
          fallbackResult.response
        );

        return finalizeMultiAgentResponse(trace, {
          ...fallbackResult,
          handoffs: [{
            from: 'Orchestrator',
            to: finalAgentName,
            reason: 'Fallback routing (LLM inconclusive)',
          }],
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const fallbackResponse = routingDecision.reasoning || '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다.';
    const quality = evaluateAgentResponseQuality('Orchestrator', fallbackResponse, { durationMs });

    return finalizeMultiAgentResponse(trace, {
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
    });
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

// ============================================================================
// Streaming Execution
// ============================================================================

export async function* executeMultiAgentStream(
  request: MultiAgentRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();

  const query = getLastUserQuery(request);
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

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Stream Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);
  const contextSummary = await getContextSummary(request.sessionId);

  // Fast Path
  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  logger.debug(`[Stream PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    yield* streamWithTrace(trace, startTime, streamFastPathResponse(preFilterResult.directResponse, startTime));
    return;
  }

  // Task Decomposition (Collect-then-Stream pattern)
  const decomposition = await decomposeTask(query);

  if (decomposition && decomposition.subtasks.length > 1) {
    logger.info(`[Stream] Complex query detected, using Orchestrator-Worker stream pattern (${decomposition.subtasks.length} subtasks)`);

    if (decomposition.requiresSequential) {
      yield* streamWithTrace(trace, startTime, executeSequentialSubtasksStream(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      ));
    } else {
      yield* streamWithTrace(trace, startTime, executeParallelSubtasksStream(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      ));
    }
    return;
  }

  // Forced Routing
  if (
    preFilterResult.suggestedAgent &&
    preFilterResult.confidence >= ORCHESTRATOR_CONFIG.forcedRoutingConfidence
  ) {
    logger.info(`[Stream] Forced routing to ${preFilterResult.suggestedAgent}`);

    const forcedTarget = resolveVisionFallbackAgent(
      preFilterResult.suggestedAgent
    );
    if (forcedTarget.degradedFromVision) {
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

    yield* streamWithTrace(trace, startTime, executeAgentStream(
      query, forcedTarget.targetAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files, contextSummary
    ));
    return;
  }

  // LLM-based routing
  const orchestratorModelConfig = getOrchestratorModel();

  if (!orchestratorModelConfig) {
    finalizeTrace(trace, 'Orchestrator not available', false, {
      mode: 'multi',
      code: 'MODEL_UNAVAILABLE',
      durationMs: Date.now() - startTime,
    });
    yield { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } };
    return;
  }

  try {
    const { model, provider, modelId } = orchestratorModelConfig;

    logger.info(`[Stream Orchestrator] Starting with ${provider}/${modelId}`);

    const routingPrompt = buildRoutingPrompt(
      contextSummary ? `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}` : query
    );

    // Phase 2D: LLM routing timeout — wrap with Promise.race + clearTimeout
    const routingTimeout = TIMEOUT_CONFIG.orchestrator.routingDecision;
    let routingResult: Awaited<ReturnType<typeof generateObjectWithFallback>>;
    let routingTimeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      routingResult = await Promise.race([
        generateObjectWithFallback({
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
          routingTimeoutId = setTimeout(() => reject(new Error(`Routing decision timeout after ${routingTimeout}ms`)), routingTimeout);
        }),
      ]);
    } catch (routingError) {
      const errorMsg = routingError instanceof Error ? routingError.message : String(routingError);
      logger.warn(`[Stream] LLM routing failed: ${errorMsg}`);

      // Fallback to preFilter suggestion if available
      const suggestedAgent = preFilterResult.suggestedAgent;
      if (suggestedAgent && preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence) {
        logger.info(`[Stream] Routing timeout fallback to ${suggestedAgent}`);
        yield {
          type: 'agent_status',
          data: {
            agent: 'Orchestrator',
            status: 'processing',
            message: `라우팅 타임아웃, ${suggestedAgent}로 전환...`,
          },
        };

        const timeoutFallbackTarget = resolveVisionFallbackAgent(suggestedAgent);
        if (timeoutFallbackTarget.degradedFromVision) {
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
        yield* streamWithTrace(
          trace,
          startTime,
          executeAgentStream(
            query,
            timeoutFallbackTarget.targetAgent,
            startTime,
            request.sessionId,
            webSearchEnabled,
            ragEnabled,
            request.images,
            request.files,
            contextSummary,
          )
        );
        return;
      }
      throw routingError;
    } finally {
      if (routingTimeoutId !== undefined) clearTimeout(routingTimeoutId);
    }

    const routingDecision = routingResult.object;
    logger.debug(`[Stream] LLM routing decision: ${routingDecision.selectedAgent} (confidence: ${routingDecision.confidence.toFixed(2)})`);

    const selectedAgent = getAgentFromRouting(routingDecision);

    if (selectedAgent) {
      recordHandoff('Orchestrator', selectedAgent, 'LLM routing');
      await recordHandoffEvent(request.sessionId, 'Orchestrator', selectedAgent, 'LLM routing');
      yield { type: 'handoff', data: { from: 'Orchestrator', to: selectedAgent, reason: 'LLM routing' } };

      // Phase 2B: Vision fallback in LLM routing path
      const selectedTarget = resolveVisionFallbackAgent(selectedAgent);
      if (selectedTarget.degradedFromVision) {
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

      yield* streamWithTrace(
        trace,
        startTime,
        executeAgentStream(query, selectedTarget.targetAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files, contextSummary)
      );
      return;
    }

    const suggestedAgent = preFilterResult.suggestedAgent;
    if (suggestedAgent && preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence) {
      logger.debug(`[Stream] Fallback to ${suggestedAgent}`);
      recordHandoff('Orchestrator', suggestedAgent, 'Fallback routing');
      await recordHandoffEvent(request.sessionId, 'Orchestrator', suggestedAgent, 'Fallback routing');
      yield { type: 'handoff', data: { from: 'Orchestrator', to: suggestedAgent, reason: 'Fallback' } };

      const fallbackTarget = resolveVisionFallbackAgent(suggestedAgent);
      if (fallbackTarget.degradedFromVision) {
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

      yield* streamWithTrace(
        trace,
        startTime,
        executeAgentStream(query, fallbackTarget.targetAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files, contextSummary)
      );
      return;
    }

    const durationMs = Date.now() - startTime;
    yield { type: 'text_delta', data: '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다. 서버 상태, 분석, 보고서, 해결 방법 등에 대해 질문해 주세요.' };
    const traceId = getTraceId(trace);
    finalizeTrace(trace, '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다. 서버 상태, 분석, 보고서, 해결 방법 등에 대해 질문해 주세요.', true, {
      mode: 'multi',
      traceId,
      finalAgent: 'Orchestrator',
      toolsCalled: [],
      durationMs,
    });
    yield {
      type: 'done',
      data: {
        success: true,
        finalAgent: 'Orchestrator',
        toolsCalled: [],
        handoffs: [],
        usage: {
          promptTokens: routingResult.usage?.inputTokens ?? 0,
          completionTokens: routingResult.usage?.outputTokens ?? 0,
        },
        metadata: { provider, modelId, handoffCount: 0, durationMs, ...(traceId ? { traceId } : {}) },
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Stream Orchestrator] Error after ${durationMs}ms:`, errorMessage);
    finalizeTrace(trace, errorMessage, false, {
      mode: 'multi',
      code: mapOrchestratorErrorCode(errorMessage),
      durationMs,
    });
    yield {
      type: 'error',
      data: {
        code: mapOrchestratorErrorCode(errorMessage),
        error: errorMessage,
      },
    };
  }
}
