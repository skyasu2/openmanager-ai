/**
 * Supervisor Single-Agent Execution
 *
 * Single-agent mode with multi-step tool calling, retry logic,
 * circuit breaker, and streaming support.
 */

import {
  generateText,
  stepCountIs,
  hasToolCall,
  type ModelMessage,
} from 'ai';
import {
  getSupervisorModel,
  recordModelUsage,
  logProviderStatus,
  type ProviderName,
} from './model-provider';
import {
  TIMEOUT_CONFIG,
} from '../../config/timeout-config';
import { allTools } from '../../tools-ai-sdk';
import { executeMultiAgent, type MultiAgentRequest, type MultiAgentResponse } from './agents';
import { filterToolsByRAG, resolveWebSearchSetting, filterToolsByWebSearch } from './agents/orchestrator-web-search';
import { isTavilyAvailable } from '../../lib/tavily-hybrid-rag';
import {
  createSupervisorTrace,
  logGeneration,
  logToolCall,
  finalizeTrace,
} from '../observability/langfuse';
import { getCircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import { extractToolResultOutput, extractRagSources, type RagSource } from '../../lib/ai-sdk-utils';
import { getPublicErrorMessage, getPublicErrorResponse } from '../../lib/error-handler';

import {
  SupervisorRequest,
  SupervisorResponse,
  SupervisorError,
  SupervisorHealth,
} from './supervisor-types';
import { logger } from '../../lib/logger';
import {
  buildSupervisorModeMetadata,
  resolveSupervisorModeDecision,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import { isSingleModeAllowed } from '../../lib/config-parser';
import {
  applyDegradedMetadata,
  buildDegradedMetadata,
  shouldFallbackFromMultiAgentError,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import {
  createSystemPrompt,
  RETRY_CONFIG,
  getIntentCategory,
  createPrepareStep,
} from './supervisor-routing';

import { evaluateAgentResponseQuality } from './agents/response-quality';
import { shouldRetryForQuality } from './supervisor-quality-retry';

export { executeSupervisorStream } from './supervisor-stream';

// ============================================================================
// Main Entry Point
// ============================================================================

export async function executeSupervisor(
  request: SupervisorRequest
): Promise<SupervisorResponse | SupervisorError> {
  const startTime = Date.now();
  const modeDecision = resolveSupervisorModeDecision(request);
  const mode = modeDecision.resolvedMode;

  logger.info({
    sessionId: request.sessionId,
    requestedMode: modeDecision.requestedMode,
    resolvedMode: modeDecision.resolvedMode,
    modeSelectionSource: modeDecision.modeSelectionSource,
    autoSelectedByComplexity: modeDecision.autoSelectedByComplexity,
  }, '[Supervisor] Mode resolved');

  if (mode === 'multi') {
    return executeMultiAgentMode(request, startTime, modeDecision);
  }

  return executeSingleAgentMode(request, startTime, undefined, modeDecision);
}

// ============================================================================
// Multi-Agent Mode
// ============================================================================

async function executeMultiAgentMode(
  request: SupervisorRequest,
  startTime: number,
  modeDecision: ResolvedSupervisorModeDecision,
): Promise<SupervisorResponse | SupervisorError> {
  try {
    const multiAgentRequest: MultiAgentRequest = {
      messages: request.messages,
      sessionId: request.sessionId,
      ...buildSupervisorModeMetadata(modeDecision),
      traceId: request.traceId,
      enableTracing: request.enableTracing,
      enableWebSearch: request.enableWebSearch,
      enableRAG: request.enableRAG,
      images: request.images,
      files: request.files,
    };

    const result = await executeMultiAgent(multiAgentRequest);

    if (!result.success) {
      const multiAgentError = result as SupervisorError;
      if (
        isSingleModeAllowed() &&
        shouldFallbackFromMultiAgentError(multiAgentError.code)
      ) {
        logger.info(
          `[Supervisor] Falling back to single-agent mode (degraded) after multi-agent error: ${multiAgentError.code}`
        );
        return executeSingleAgentMode(request, startTime, {
          degradedFromMode: 'multi',
          degradedReason: 'multi_agent_model_unavailable',
        }, modeDecision);
      }
      return multiAgentError;
    }

    const multiResult = result as MultiAgentResponse;

    if (multiResult.usage.totalTokens > 0) {
      await recordModelUsage(
        multiResult.metadata.provider as ProviderName,
        multiResult.usage.totalTokens,
        'multi-agent'
      );
    }

    const sanitizedResponse = {
      success: true,
      response: multiResult.response,
      toolsCalled: multiResult.toolsCalled,
      toolResults: [],
      ragSources: multiResult.ragSources,
      usage: multiResult.usage,
      metadata: {
        provider: multiResult.metadata.provider,
        modelId: multiResult.metadata.modelId,
        stepsExecuted: multiResult.metadata.totalRounds,
        durationMs: multiResult.metadata.durationMs,
        traceId: multiResult.metadata.traceId,
        responseChars: multiResult.metadata.responseChars,
        formatCompliance: multiResult.metadata.formatCompliance,
        qualityFlags: multiResult.metadata.qualityFlags,
        latencyTier: multiResult.metadata.latencyTier,
        mode: 'multi',
        ...buildSupervisorModeMetadata(modeDecision),
        handoffs: multiResult.handoffs,
        finalAgent: multiResult.finalAgent,
      },
    };

    return sanitizedResponse as SupervisorResponse;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Supervisor] Multi-agent error after ${durationMs}ms:`, errorMessage);

    if (isSingleModeAllowed()) {
      logger.info(`[Supervisor] Falling back to single-agent mode (degraded)`);
      return executeSingleAgentMode(request, startTime, {
        degradedFromMode: 'multi',
        degradedReason: 'multi_agent_runtime_error',
      }, modeDecision);
    }

    logger.error(`[Supervisor] Single-agent fallback NOT allowed. Failing fast.`);
    return {
      success: false,
      error: errorMessage,
      code: 'MULTI_AGENT_FAILED',
    };
  }
}

// ============================================================================
// Single-Agent Mode
// ============================================================================

async function executeSingleAgentMode(
  request: SupervisorRequest,
  startTime: number,
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
): Promise<SupervisorResponse | SupervisorError> {
  let lastError: SupervisorError | null = null;
  const failedProviders: ProviderName[] = [];
  const queryText = request.messages.filter((m) => m.role === 'user').pop()?.content ?? '';
  const queryIntent = getIntentCategory(queryText);

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      logger.info(`[Supervisor] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries}, excluding: [${failedProviders.join(', ')}]`);
      await new Promise((r) => setTimeout(r, RETRY_CONFIG.retryDelayMs * attempt));
    }

    const result = await executeSupervisorAttempt(
      request,
      startTime,
      failedProviders,
      degradedFallbackContext,
      modeDecision
    );

    if (result.success) {
      const successResult = result as SupervisorResponse;

      if (attempt < RETRY_CONFIG.maxRetries && shouldRetryForQuality(successResult, queryIntent)) {
        const degradedProvider = successResult.metadata.provider as ProviderName;
        if (degradedProvider && !failedProviders.includes(degradedProvider)) {
          failedProviders.push(degradedProvider);
        }
        logger.warn(
          `[Supervisor] Quality-based retry triggered (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}): ` +
          `provider=${successResult.metadata.provider}, flags=[${(successResult.metadata.qualityFlags ?? []).join(', ')}]`
        );
        continue;
      }

      successResult.metadata.mode = 'single';
      if (modeDecision) {
        Object.assign(successResult.metadata, buildSupervisorModeMetadata(modeDecision));
      }
      return applyDegradedMetadata(successResult, degradedFallbackContext);
    }

    lastError = result as SupervisorError;

    const failedProvider = (lastError as unknown as { provider?: ProviderName }).provider;
    if (failedProvider && !failedProviders.includes(failedProvider)) {
      failedProviders.push(failedProvider);
      logger.debug(`[Supervisor] Marking ${failedProvider} as failed for retry`);
    }

    if (!RETRY_CONFIG.retryableErrors.includes(lastError.code)) {
      logger.warn(`[Supervisor] Non-retryable error: ${lastError.code}`);
      return lastError;
    }
  }

  return lastError || { success: false, error: 'Unknown error', code: 'UNKNOWN_ERROR' };
}

async function executeSupervisorAttempt(
  request: SupervisorRequest,
  startTime: number,
  excludeProviders: ProviderName[] = [],
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
): Promise<SupervisorResponse | (SupervisorError & { provider?: ProviderName })> {
  const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
  const trace = createSupervisorTrace({
    sessionId: request.sessionId,
    mode: 'single',
    query: lastUserMessage?.content || '',
    upstreamTraceId: request.traceId,
    ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
  });

  let provider: ProviderName;
  let modelId: string;
  let model;

  try {
    const modelResult = getSupervisorModel(excludeProviders);
    model = modelResult.model;
    provider = modelResult.provider;
    modelId = modelResult.modelId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Supervisor] No available providers:', errorMessage);

    // Graceful fallback: 사용자 친화적 응답 반환 (에러 대신)
    const durationMs = Date.now() - startTime;
    const fallbackResponse = '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.';
    const quality = evaluateAgentResponseQuality('Supervisor', fallbackResponse, {
      durationMs,
      fallbackReason: 'NO_PROVIDER',
    });
    finalizeTrace(trace, 'Provider unavailable - fallback response', false, {
      durationMs,
      excludedProviders: excludeProviders,
      ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
      ...buildDegradedMetadata(degradedFallbackContext, {
        fallback: true,
        fallbackReason: 'no_provider',
      }),
    });

    return {
      success: true,
      response: fallbackResponse,
      toolsCalled: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'none' as ProviderName,
        modelId: 'none',
        stepsExecuted: 0,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {
          fallback: true,
          fallbackReason: 'no_provider',
        }),
      },
    };
  }

  const circuitBreaker = getCircuitBreaker(`supervisor-${provider}`);

  if (!circuitBreaker.isAllowed()) {
    const cbStats = circuitBreaker.getStats();
    logger.warn(`[Supervisor] Circuit OPEN for ${provider}, will try next provider on retry`);

    // Langfuse에 circuit breaker 상태 기록
    trace.event({
      name: 'circuit-breaker-open',
      metadata: {
        provider,
        failures: cbStats.failures,
        totalFailures: cbStats.totalFailures,
        lastFailure: cbStats.lastFailure?.toISOString(),
      },
    });

    return {
      success: false,
      error: `Provider ${provider} circuit breaker is OPEN`,
      code: 'CIRCUIT_OPEN',
      provider,
    };
  }

  try {
    return await circuitBreaker.execute(async () => {
      logProviderStatus();

      logger.info(`[Supervisor] Using ${provider}/${modelId}`);

      const queryText = lastUserMessage?.content || '';
      const intentCategory = getIntentCategory(queryText);

      let webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
      if (webSearchEnabled && !isTavilyAvailable()) {
        logger.warn('[Single] Web search requested but Tavily unavailable, falling back to internal data');
        webSearchEnabled = false;
      }
      logger.debug(`[Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
      const ragEnabled = request.enableRAG ?? false;
      let filteredTools = filterToolsByWebSearch(allTools, webSearchEnabled);
      filteredTools = filterToolsByRAG(filteredTools, ragEnabled);

      const modelMessages: ModelMessage[] = [
        { role: 'system', content: createSystemPrompt(request.deviceType) },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const result = await generateText({
        model,
        messages: modelMessages,
        tools: filteredTools,
        prepareStep: createPrepareStep(queryText, {
          enableWebSearch: webSearchEnabled,
          enableRAG: ragEnabled,
        }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(5)],
        temperature: 0.3,
        maxOutputTokens: 2048,
        timeout: {
          totalMs: TIMEOUT_CONFIG.supervisor.hard,
          stepMs: TIMEOUT_CONFIG.agent.hard,
        },
        maxRetries: 1,
        onStepFinish: ({ finishReason, toolCalls, toolResults }) => {
          const toolNames = toolCalls?.map((tc) => tc.toolName) || [];
          logger.debug(`[Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`);

          if (trace && toolCalls?.length) {
            for (const tc of toolCalls) {
              const tr = toolResults?.find((r) => r.toolCallId === tc.toolCallId);
              logToolCall(trace, tc.toolName, tc.input, tr?.output, 0);
            }
          }
        },
      });

      const toolsCalled: string[] = [];
      const toolResults: Record<string, unknown>[] = [];
      let finalAnswerResult: { answer: string } | null = null;

      const ragSources: RagSource[] = [];

      for (const step of result.steps) {
        for (const toolCall of step.toolCalls) {
          toolsCalled.push(toolCall.toolName);
        }
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            const trOutput = extractToolResultOutput(tr);
            if (trOutput) {
              toolResults.push(trOutput as Record<string, unknown>);
              logToolCall(trace, tr.toolName, {}, trOutput, 0);
            }

            ragSources.push(...extractRagSources(tr.toolName, trOutput));

            if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
              const finalResult = trOutput as Record<string, unknown>;
              if ('answer' in finalResult && typeof finalResult.answer === 'string') {
                finalAnswerResult = { answer: finalResult.answer };
              }
            }
          }
        }
      }

      const response = finalAnswerResult?.answer ?? result.text;

      const durationMs = Date.now() - startTime;
      const quality = evaluateAgentResponseQuality('Supervisor', response, {
        durationMs,
      });

      logGeneration(trace, {
        model: modelId,
        provider,
        input: lastUserMessage?.content || '',
        output: response,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
        duration: durationMs,
        metadata: { intent: intentCategory, usedFinalAnswer: !!finalAnswerResult, usedPrepareStep: true },
      });

      finalizeTrace(trace, response, true, {
        toolsCalled,
        stepsExecuted: result.steps.length,
        durationMs,
        intent: intentCategory,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
      });

      logger.info(
        `[Supervisor] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]${finalAnswerResult ? ' (via finalAnswer)' : ''}, ragSources: ${ragSources.length}`
      );

      const totalTokens = result.usage?.totalTokens ?? 0;
      if (totalTokens > 0) {
        await recordModelUsage(provider, totalTokens, 'supervisor');
      }

      return {
        success: true,
        response,
        toolsCalled,
        toolResults,
        ragSources: ragSources.length > 0 ? ragSources : undefined,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
          totalTokens,
        },
        metadata: {
          provider,
          modelId,
          stepsExecuted: result.steps.length,
          durationMs,
          responseChars: quality.responseChars,
          formatCompliance: quality.formatCompliance,
          qualityFlags: quality.qualityFlags,
          latencyTier: quality.latencyTier,
          traceId: trace.id,
          ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
          ...buildDegradedMetadata(degradedFallbackContext, {}),
        },
      };
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Supervisor] Error after ${durationMs}ms:`, errorMessage);

    finalizeTrace(trace, errorMessage, false, {
      durationMs,
      ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
    });

    const publicError = error instanceof CircuitOpenError
      ? { code: 'CIRCUIT_OPEN', message: getPublicErrorMessage('CIRCUIT_OPEN') }
      : getPublicErrorResponse(error);

    return { success: false, error: publicError.message, code: publicError.code, provider };
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkSupervisorHealth(): Promise<SupervisorHealth> {
  try {
    const { provider, modelId } = getSupervisorModel();
    const toolCount = Object.keys(allTools).length;

    return {
      status: 'ok',
      provider,
      modelId,
      toolsAvailable: toolCount,
    };
  } catch {
    return {
      status: 'error',
      provider: 'none',
      modelId: 'none',
      toolsAvailable: 0,
    };
  }
}
