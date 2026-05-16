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
} from './orchestrator-types';
import { resolveRAGSetting, resolveWebSearchSetting } from './orchestrator-web-search';
import { preFilterQuery } from './orchestrator-context';
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
  recordHandoff,
  ORCHESTRATOR_PROVIDER_ORDER,
} from './orchestrator-routing';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { logger } from '../../../lib/logger';
import {
  getTraceId,
  mapOrchestratorErrorCode,
  resolveVisionFallbackAgent,
  streamFastPathResponse,
  streamWithTrace,
} from './orchestrator-execution-helpers';
import {
  decomposeTask,
  executeParallelSubtasksStream,
  executeSequentialSubtasksStream,
} from './orchestrator-decomposition';
import { executeAgentStream } from './orchestrator-agent-stream';
import { generateStructuredOutputWithFallback } from './orchestrator-object-fallback';
import {
  createSupervisorTrace,
  finalizeTrace,
} from '../../observability/langfuse';

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

  const decomposition = await decomposeTask(query);

  if (decomposition && decomposition.subtasks.length > 1) {
    logger.info(`[Stream] Complex query detected, using Orchestrator-Worker stream pattern (${decomposition.subtasks.length} subtasks)`);

    if (decomposition.requiresSequential) {
      yield* streamWithTrace(
        trace,
        startTime,
        executeSequentialSubtasksStream(
          decomposition.subtasks,
          startTime,
          webSearchEnabled,
          ragEnabled,
          request.sessionId,
          request.images,
          request.files,
          request.dataSource,
          request.domainId,
          request.internalDisclosureMode,
          request.domainEvidencePrompt
        ),
        buildRoutingTraceMetadata()
      );
    } else {
      yield* streamWithTrace(
        trace,
        startTime,
        executeParallelSubtasksStream(
          decomposition.subtasks,
          startTime,
          webSearchEnabled,
          ragEnabled,
          request.sessionId,
          request.images,
          request.files,
          request.dataSource,
          request.domainId,
          request.internalDisclosureMode,
          request.domainEvidencePrompt
        ),
        buildRoutingTraceMetadata()
      );
    }
    return;
  }

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
    routingTrace = attachAgentDecision(
      routingTrace,
      createAgentDecisionFromPreFilter({
        selectedAgent: forcedTarget.targetAgent,
        confidence: preFilterResult.confidence,
      })
    );

    yield* streamWithTrace(
      trace,
      startTime,
      executeAgentStream(
        query,
        forcedTarget.targetAgent,
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
    return;
  }

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

    const routingTimeout = TIMEOUT_CONFIG.orchestrator.routingDecision;
    let routingResult: Awaited<
      ReturnType<typeof generateStructuredOutputWithFallback>
    >;
    let routingTimeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      routingResult = await Promise.race([
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
          routingTimeoutId = setTimeout(() => reject(new Error(`Routing decision timeout after ${routingTimeout}ms`)), routingTimeout);
        }),
      ]);
    } catch (routingError) {
      const errorMsg = routingError instanceof Error ? routingError.message : String(routingError);
      logger.warn(`[Stream] LLM routing failed: ${errorMsg}`);

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
        routingTrace = attachAgentDecision(
          routingTrace,
          createAgentDecisionFromFallback({
            selectedAgent: timeoutFallbackTarget.targetAgent,
            confidence: preFilterResult.confidence,
          })
        );
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
            request.dataSource,
            request.domainId,
            request.domainEvidencePrompt,
          ),
          buildRoutingTraceMetadata()
        );
        return;
      }
      throw routingError;
    } finally {
      if (routingTimeoutId !== undefined) clearTimeout(routingTimeoutId);
    }

    const routingDecision: RoutingDecision = routingSchema.parse(
      routingResult.object
    );
    logger.debug(`[Stream] LLM routing decision: ${routingDecision.selectedAgent} (confidence: ${routingDecision.confidence.toFixed(2)})`);

    const selectedAgent = getAgentFromRouting(routingDecision);

    if (selectedAgent) {
      recordHandoff('Orchestrator', selectedAgent, 'LLM routing');
      await recordHandoffEvent(request.sessionId, 'Orchestrator', selectedAgent, 'LLM routing');
      yield { type: 'handoff', data: { from: 'Orchestrator', to: selectedAgent, reason: 'LLM routing' } };

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
      routingTrace = attachAgentDecision(
        routingTrace,
        createAgentDecisionFromLlmRouting({
          selectedAgent: selectedTarget.targetAgent,
          confidence: routingDecision.confidence,
        })
      );

      yield* streamWithTrace(
        trace,
        startTime,
        executeAgentStream(
          query,
          selectedTarget.targetAgent,
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
      routingTrace = attachAgentDecision(
        routingTrace,
        createAgentDecisionFromFallback({
          selectedAgent: fallbackTarget.targetAgent,
          confidence: preFilterResult.confidence,
        })
      );

      yield* streamWithTrace(
        trace,
        startTime,
        executeAgentStream(
          query,
          fallbackTarget.targetAgent,
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
        metadata: {
          provider,
          modelId,
          handoffCount: 0,
          durationMs,
          ...(traceId ? { traceId } : {}),
          ...buildRoutingTraceMetadata(),
        },
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
