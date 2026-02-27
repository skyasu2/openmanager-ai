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
import { resolveWebSearchSetting } from './orchestrator-web-search';
import { preFilterQuery, saveAgentFindingsToContext } from './orchestrator-context';

import {
  getOrchestratorModel,
  getAgentConfig,
  executeForcedRouting,
  executeWithAgentFactory,
  recordHandoff,
  getRecentHandoffs,
} from './orchestrator-routing';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { evaluateAgentResponseQuality } from './response-quality';
import { logger } from '../../../lib/logger';
import {
  decomposeTask,
  executeParallelSubtasks,
  executeParallelSubtasksStream,
  executeSequentialSubtasksStream,
} from './orchestrator-decomposition';
import { executeAgentStream } from './orchestrator-agent-stream';
import { generateObjectWithFallback } from './orchestrator-object-fallback';

export { getRecentHandoffs };

// ============================================================================
// Vision Agent Helper (DRY: Gemini → Analyst fallback)
// ============================================================================

async function executeVisionOrFallback(
  query: string,
  startTime: number,
  webSearchEnabled: boolean,
  ragEnabled: boolean,
  images?: Parameters<typeof executeWithAgentFactory>[5],
  files?: Parameters<typeof executeWithAgentFactory>[6]
): Promise<MultiAgentResponse | null> {
  const result = await executeWithAgentFactory(query, 'vision', startTime, webSearchEnabled, ragEnabled, images, files);
  if (result) return result;

  logger.warn('⚠️ [Vision] Gemini unavailable, falling back to Analyst Agent');
  return executeForcedRouting(query, 'Analyst Agent', startTime, webSearchEnabled, ragEnabled, images, files);
}

// ============================================================================
// Main Execution Functions
// ============================================================================

export async function executeMultiAgent(
  request: MultiAgentRequest
): Promise<MultiAgentResponse | MultiAgentError> {
  const startTime = Date.now();

  const lastUserMessage = request.messages
    .filter((m) => m.role === 'user')
    .pop();

  if (!lastUserMessage) {
    return { success: false, error: 'No user message found', code: 'INVALID_REQUEST' };
  }

  const query = lastUserMessage.content;

  const webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, query);
  const ragEnabled = request.enableRAG !== false; // default: true
  logger.debug(`[WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  logger.debug(`[RAG] Setting resolved: ${ragEnabled} (request: ${request.enableRAG})`);

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);

  // Fast Path
  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  logger.debug(`[PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    const durationMs = Date.now() - startTime;
    const quality = evaluateAgentResponseQuality(
      'Orchestrator',
      preFilterResult.directResponse,
      { durationMs }
    );
    logger.info(`[Fast Path] Direct response in ${durationMs}ms (confidence: ${preFilterResult.confidence})`);

    return {
      success: true,
      response: preFilterResult.directResponse,
      handoffs: [],
      finalAgent: 'Orchestrator (Fast Path)',
      toolsCalled: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'rule-based',
        modelId: 'prefilter',
        totalRounds: 1,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
      },
    };
  }

  // Task Decomposition
  const decomposition = await decomposeTask(query);

  if (decomposition && decomposition.subtasks.length > 1) {
    logger.info(`[Orchestrator] Complex query detected, using Orchestrator-Worker pattern`);

    if (decomposition.requiresSequential) {
      logger.info('[Orchestrator] Executing subtasks sequentially (dependencies detected)');
      let lastResult: MultiAgentResponse | null = null;

      for (const subtask of decomposition.subtasks) {
        lastResult = await executeForcedRouting(subtask.task, subtask.agent, startTime, webSearchEnabled, ragEnabled, request.images, request.files);
        if (!lastResult) {
          logger.warn(`⚠️ [Orchestrator] Sequential subtask failed: ${subtask.agent}`);
          break;
        }
        await saveAgentFindingsToContext(request.sessionId, subtask.agent, lastResult.response);
      }

      if (lastResult) {
        return lastResult;
      }
    } else {
      const parallelResult = await executeParallelSubtasks(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      );

      if (parallelResult) {
        return parallelResult;
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
      forcedResult = await executeForcedRouting(query, suggestedAgentName, startTime, webSearchEnabled, ragEnabled, request.images, request.files);
    }

    if (forcedResult) {
      logger.info(`[Orchestrator] Forced routing succeeded`);
      await saveAgentFindingsToContext(request.sessionId, suggestedAgentName, forcedResult.response);
      return forcedResult;
    }
    logger.warn('[Orchestrator] Forced routing failed, falling back to LLM routing');
  } else {
    logger.debug(`[Orchestrator] Skipping forced routing (conditions not met)`);
  }

  // LLM-based routing
  const orchestratorModelConfig = getOrchestratorModel();

  if (!orchestratorModelConfig) {
    return { success: false, error: 'Orchestrator not available (no AI provider configured)', code: 'MODEL_UNAVAILABLE' };
  }

  try {
    const { model, provider, modelId } = orchestratorModelConfig;

    logger.info(`[Orchestrator] LLM routing with ${provider}/${modelId} (suggested: ${preFilterResult.suggestedAgent || 'none'})`);

    const routingPrompt = buildRoutingPrompt(query);

    let timeoutId: NodeJS.Timeout | null = null;
    let warnTimer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Orchestrator timeout after ${ORCHESTRATOR_CONFIG.timeout}ms`));
      }, ORCHESTRATOR_CONFIG.timeout);
    });

    warnTimer = setTimeout(() => {
      logger.warn(`⚠️ [Orchestrator] Execution exceeding ${ORCHESTRATOR_CONFIG.warnThreshold}ms threshold`);
    }, ORCHESTRATOR_CONFIG.warnThreshold);

    let routingDecision: RoutingDecision;
    try {
      const routingResult = await Promise.race([
        generateObjectWithFallback({
          model,
          schema: routingSchema,
          system: ORCHESTRATOR_INSTRUCTIONS,
          prompt: routingPrompt,
          temperature: 0.1,
          operation: 'orchestrator-routing',
        }),
        timeoutPromise,
      ]);
      routingDecision = routingResult.object;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (warnTimer) clearTimeout(warnTimer);
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
        agentResult = await executeForcedRouting(query, selectedAgent, startTime, webSearchEnabled, ragEnabled, request.images, request.files);
      }

      if (agentResult) {
        await saveAgentFindingsToContext(request.sessionId, selectedAgent, agentResult.response);

        return {
          ...agentResult,
          handoffs: [{
            from: 'Orchestrator',
            to: selectedAgent,
            reason: 'LLM routing decision',
          }],
        };
      }
    }

    const suggestedAgent = preFilterResult.suggestedAgent;
    if (suggestedAgent && preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence) {
      logger.debug(`[Orchestrator] LLM routing inconclusive, falling back to ${suggestedAgent}`);

      const fallbackResult = await executeForcedRouting(query, suggestedAgent, startTime, webSearchEnabled, ragEnabled, request.images, request.files);

      if (fallbackResult) {
        await saveAgentFindingsToContext(request.sessionId, suggestedAgent, fallbackResult.response);

        return {
          ...fallbackResult,
          handoffs: [{
            from: 'Orchestrator',
            to: suggestedAgent,
            reason: 'Fallback routing (LLM inconclusive)',
          }],
        };
      }
    }

    const durationMs = Date.now() - startTime;
    const fallbackResponse = routingDecision.reasoning || '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다.';
    const quality = evaluateAgentResponseQuality('Orchestrator', fallbackResponse, { durationMs });

    return {
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
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Orchestrator] Error after ${durationMs}ms:`, errorMessage);

    let code = 'UNKNOWN_ERROR';
    if (errorMessage.includes('API key')) code = 'AUTH_ERROR';
    else if (errorMessage.includes('rate limit')) code = 'RATE_LIMIT';
    else if (errorMessage.includes('timeout')) code = 'TIMEOUT';
    else if (errorMessage.includes('model')) code = 'MODEL_ERROR';

    return { success: false, error: errorMessage, code };
  }
}

// ============================================================================
// Streaming Execution
// ============================================================================

export async function* executeMultiAgentStream(
  request: MultiAgentRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();

  const lastUserMessage = request.messages
    .filter((m) => m.role === 'user')
    .pop();

  if (!lastUserMessage) {
    yield { type: 'error', data: { code: 'INVALID_REQUEST', error: 'No user message found' } };
    return;
  }

  const query = lastUserMessage.content;

  const webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, query);
  const ragEnabled = request.enableRAG !== false; // default: true
  logger.debug(`[Stream WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  logger.debug(`[Stream RAG] Setting resolved: ${ragEnabled} (request: ${request.enableRAG})`);

  const sessionContext = await getOrCreateSessionContext(request.sessionId, query);
  logger.debug(`[Stream Context] Session ${request.sessionId}: ${sessionContext.handoffs.length} previous handoffs`);

  // Fast Path
  const preFilterResult = preFilterQuery(query, {
    hasImageAttachments: !!(request.images && request.images.length > 0),
    hasFileAttachments: !!(request.files && request.files.length > 0),
  });
  logger.debug(`[Stream PreFilter] Query: "${query.substring(0, 50)}..." → Suggested: ${preFilterResult.suggestedAgent || 'none'} (confidence: ${preFilterResult.confidence})`);

  if (!preFilterResult.shouldHandoff && preFilterResult.directResponse) {
    const durationMs = Date.now() - startTime;
    logger.info(`[Stream Fast Path] Direct response in ${durationMs}ms`);

    yield { type: 'text_delta', data: preFilterResult.directResponse };
    yield {
      type: 'done',
      data: {
        success: true,
        finalAgent: 'Orchestrator (Fast Path)',
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0 },
        metadata: { durationMs, provider: 'rule-based' }
      }
    };
    return;
  }

  // Task Decomposition (Collect-then-Stream pattern)
  const decomposition = await decomposeTask(query);

  if (decomposition && decomposition.subtasks.length > 1) {
    logger.info(`[Stream] Complex query detected, using Orchestrator-Worker stream pattern (${decomposition.subtasks.length} subtasks)`);

    if (decomposition.requiresSequential) {
      yield* executeSequentialSubtasksStream(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      );
    } else {
      yield* executeParallelSubtasksStream(
        decomposition.subtasks, startTime, webSearchEnabled, ragEnabled, request.sessionId, request.images, request.files
      );
    }
    return;
  }

  // Forced Routing
  if (
    preFilterResult.suggestedAgent &&
    preFilterResult.confidence >= ORCHESTRATOR_CONFIG.forcedRoutingConfidence
  ) {
    logger.info(`[Stream] Forced routing to ${preFilterResult.suggestedAgent}`);

    // Phase 2B: Vision Agent fallback — if Gemini unavailable, route to Analyst
    if (preFilterResult.suggestedAgent === 'Vision Agent') {
      const visionConfig = getAgentConfig(preFilterResult.suggestedAgent);
      if (!visionConfig || !visionConfig.getModel()) {
        logger.warn('[Stream] Vision Agent model unavailable, falling back to Analyst Agent');
        yield { type: 'agent_status', data: { status: 'vision_fallback', message: 'Vision Agent 사용 불가, Analyst Agent로 전환 중...' } };
        yield* executeAgentStream(
          query, 'Analyst Agent', startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files
        );
        return;
      }
    }

    yield* executeAgentStream(
      query, preFilterResult.suggestedAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files
    );
    return;
  }

  // LLM-based routing
  const orchestratorModelConfig = getOrchestratorModel();

  if (!orchestratorModelConfig) {
    yield { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } };
    return;
  }

  try {
    const { model, provider, modelId } = orchestratorModelConfig;

    logger.info(`[Stream Orchestrator] Starting with ${provider}/${modelId}`);

    const routingPrompt = buildRoutingPrompt(query);

    // Phase 2D: LLM routing timeout — wrap with Promise.race + clearTimeout
    const routingTimeout = TIMEOUT_CONFIG.orchestrator.routingDecision;
    let routingResult: Awaited<ReturnType<typeof generateObjectWithFallback>>;
    let routingTimeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      routingResult = await Promise.race([
        generateObjectWithFallback({
          model,
          schema: routingSchema,
          system: ORCHESTRATOR_INSTRUCTIONS,
          prompt: routingPrompt,
          temperature: 0.1,
          operation: 'orchestrator-routing',
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
        yield { type: 'agent_status', data: { status: 'routing_fallback', message: `라우팅 타임아웃, ${suggestedAgent}로 전환...` } };
        yield* executeAgentStream(query, suggestedAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files);
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
      if (selectedAgent === 'Vision Agent') {
        const visionConfig = getAgentConfig(selectedAgent);
        if (!visionConfig || !visionConfig.getModel()) {
          logger.warn('[Stream] Vision Agent model unavailable (LLM routing), falling back to Analyst Agent');
          yield* executeAgentStream(query, 'Analyst Agent', startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files);
          return;
        }
      }

      yield* executeAgentStream(query, selectedAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files);
      return;
    }

    const suggestedAgent = preFilterResult.suggestedAgent;
    if (suggestedAgent && preFilterResult.confidence >= ORCHESTRATOR_CONFIG.fallbackRoutingConfidence) {
      logger.debug(`[Stream] Fallback to ${suggestedAgent}`);
      recordHandoff('Orchestrator', suggestedAgent, 'Fallback routing');
      await recordHandoffEvent(request.sessionId, 'Orchestrator', suggestedAgent, 'Fallback routing');
      yield { type: 'handoff', data: { from: 'Orchestrator', to: suggestedAgent, reason: 'Fallback' } };

      yield* executeAgentStream(query, suggestedAgent, startTime, request.sessionId, webSearchEnabled, ragEnabled, request.images, request.files);
      return;
    }

    const durationMs = Date.now() - startTime;
    yield { type: 'text_delta', data: '죄송합니다. 질문을 처리할 적절한 에이전트를 찾지 못했습니다. 서버 상태, 분석, 보고서, 해결 방법 등에 대해 질문해 주세요.' };
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
        metadata: { provider, modelId, durationMs },
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Stream Orchestrator] Error after ${durationMs}ms:`, errorMessage);

    let code = 'UNKNOWN_ERROR';
    if (errorMessage.includes('API key')) code = 'AUTH_ERROR';
    else if (errorMessage.includes('rate limit')) code = 'RATE_LIMIT';
    else if (errorMessage.includes('timeout')) code = 'TIMEOUT';
    else if (errorMessage.includes('model')) code = 'MODEL_ERROR';

    yield { type: 'error', data: { code, error: errorMessage } };
  }
}
