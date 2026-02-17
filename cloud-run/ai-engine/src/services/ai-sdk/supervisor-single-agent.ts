/**
 * Supervisor Single-Agent Execution
 *
 * Single-agent mode with multi-step tool calling, retry logic,
 * circuit breaker, and streaming support.
 *
 * @version 2.0.0
 */

import {
  generateText,
  streamText,
  stepCountIs,
  hasToolCall,
  type ModelMessage,
  type ToolSet,
  type UserContent,
} from 'ai';
import {
  getSupervisorModel,
  getVisionAgentModel,
  recordModelUsage,
  logProviderStatus,
  type ProviderName,
} from './model-provider';
import {
  TIMEOUT_CONFIG,
} from '../../config/timeout-config';
import { allTools } from '../../tools-ai-sdk';
import { executeMultiAgent, executeMultiAgentStream, type MultiAgentRequest, type MultiAgentResponse } from './agents';
import { resolveWebSearchSetting, filterToolsByWebSearch } from './agents/orchestrator-web-search';
import {
  createSupervisorTrace,
  logGeneration,
  logToolCall,
  finalizeTrace,
} from '../observability/langfuse';
import { getCircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import { extractToolResultOutput, extractRagSources, buildMultimodalContent, type RagSource } from '../../lib/ai-sdk-utils';

import type {
  SupervisorRequest,
  SupervisorResponse,
  SupervisorError,
  SupervisorHealth,
  StreamEvent,
} from './supervisor-types';
import { logger } from '../../lib/logger';
import {
  SYSTEM_PROMPT,
  RETRY_CONFIG,
  selectExecutionMode,
  getIntentCategory,
  createPrepareStep,
} from './supervisor-routing';

// ============================================================================
// Main Entry Point
// ============================================================================

export async function executeSupervisor(
  request: SupervisorRequest
): Promise<SupervisorResponse | SupervisorError> {
  const startTime = Date.now();

  let mode = request.mode || 'auto';
  if (mode === 'auto') {
    const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
    mode = lastUserMessage ? selectExecutionMode(lastUserMessage.content) : 'single';
  }

  logger.info(`[Supervisor] Mode: ${mode}`);

  if (mode === 'multi') {
    return executeMultiAgentMode(request, startTime);
  }

  return executeSingleAgentMode(request, startTime);
}

// ============================================================================
// Multi-Agent Mode
// ============================================================================

async function executeMultiAgentMode(
  request: SupervisorRequest,
  startTime: number
): Promise<SupervisorResponse | SupervisorError> {
  try {
    const multiAgentRequest: MultiAgentRequest = {
      messages: request.messages,
      sessionId: request.sessionId,
      enableTracing: request.enableTracing,
      enableWebSearch: request.enableWebSearch,
      images: request.images,
      files: request.files,
    };

    const result = await executeMultiAgent(multiAgentRequest);

    if (!result.success) {
      return result as SupervisorError;
    }

    const multiResult = result as MultiAgentResponse;

    if (multiResult.usage.totalTokens > 0) {
      await recordModelUsage(
        multiResult.metadata.provider as ProviderName,
        multiResult.usage.totalTokens,
        'multi-agent'
      );
    }

    return {
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
        mode: 'multi',
        handoffs: multiResult.handoffs,
        finalAgent: multiResult.finalAgent,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Supervisor] Multi-agent error after ${durationMs}ms:`, errorMessage);

    logger.info(`[Supervisor] Falling back to single-agent mode`);
    return executeSingleAgentMode(request, startTime);
  }
}

// ============================================================================
// Single-Agent Mode
// ============================================================================

async function executeSingleAgentMode(
  request: SupervisorRequest,
  startTime: number
): Promise<SupervisorResponse | SupervisorError> {
  let lastError: SupervisorError | null = null;
  const failedProviders: ProviderName[] = [];

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      logger.info(`[Supervisor] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries}, excluding: [${failedProviders.join(', ')}]`);
      await new Promise((r) => setTimeout(r, RETRY_CONFIG.retryDelayMs * attempt));
    }

    const result = await executeSupervisorAttempt(request, startTime, failedProviders);

    if (result.success) {
      (result as SupervisorResponse).metadata.mode = 'single';
      return result;
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
  excludeProviders: ProviderName[] = []
): Promise<SupervisorResponse | (SupervisorError & { provider?: ProviderName })> {
  const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
  const trace = createSupervisorTrace({
    sessionId: request.sessionId,
    mode: 'single',
    query: lastUserMessage?.content || '',
    upstreamTraceId: request.traceId,
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
    finalizeTrace(trace, 'Provider unavailable - fallback response', false, {
      durationMs,
      fallback: true,
      reason: 'no_provider',
      excludedProviders: excludeProviders,
    });

    return {
      success: true,
      response: '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.',
      toolsCalled: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'none' as ProviderName,
        modelId: 'none',
        stepsExecuted: 0,
        durationMs,
        fallback: true,
        fallbackReason: 'no_provider',
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

      const webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
      logger.debug(`[Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
      const filteredTools = filterToolsByWebSearch(allTools, webSearchEnabled);

      const modelMessages: ModelMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const result = await generateText({
        model,
        messages: modelMessages,
        tools: filteredTools as ToolSet,
        prepareStep: createPrepareStep(queryText, { enableWebSearch: webSearchEnabled }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(3)],
        temperature: 0.4,
        maxOutputTokens: 1536,
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
          traceId: trace.id,
        },
      };
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Supervisor] Error after ${durationMs}ms:`, errorMessage);

    finalizeTrace(trace, errorMessage, false, { durationMs });

    let code = 'UNKNOWN_ERROR';
    if (error instanceof CircuitOpenError) {
      code = 'CIRCUIT_OPEN';
    } else if (errorMessage.includes('API key')) {
      code = 'AUTH_ERROR';
    } else if (errorMessage.includes('rate limit')) {
      code = 'RATE_LIMIT';
    } else if (errorMessage.includes('timeout')) {
      code = 'TIMEOUT';
    } else if (errorMessage.includes('model')) {
      code = 'MODEL_ERROR';
    }

    return { success: false, error: errorMessage, code, provider };
  }
}

// ============================================================================
// Streaming Supervisor
// ============================================================================

export async function* executeSupervisorStream(
  request: SupervisorRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();

  let mode = request.mode || 'auto';
  if (mode === 'auto') {
    const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
    mode = lastUserMessage ? selectExecutionMode(lastUserMessage.content) : 'single';
  }

  logger.info(`[SupervisorStream] Mode: ${mode}`);

  if (mode === 'multi') {
    yield* executeMultiAgentStream({
      messages: request.messages,
      sessionId: request.sessionId,
      enableTracing: request.enableTracing,
      enableWebSearch: request.enableWebSearch,
      images: request.images,
      files: request.files,
    });
    return;
  }

  yield* streamSingleAgent(request, startTime);
}

// ============================================================================
// Stream Single Agent
// ============================================================================

async function* streamSingleAgent(
  request: SupervisorRequest,
  startTime: number
): AsyncGenerator<StreamEvent> {
  let provider: ProviderName;
  let modelId: string;
  let model;

  const hasImages = request.images && request.images.length > 0;

  try {
    logProviderStatus();

    if (hasImages) {
      const visionModel = getVisionAgentModel();
      if (!visionModel) {
        yield {
          type: 'error',
          data: { code: 'NO_VISION_PROVIDER', message: 'Gemini unavailable for image analysis. Vision features disabled.' },
        };
        return;
      }
      model = visionModel.model;
      provider = visionModel.provider;
      modelId = visionModel.modelId;
      logger.info(`[SingleAgent] Using Vision Agent (Gemini) for ${request.images!.length} image(s)`);
    } else {
      const modelResult = getSupervisorModel();
      model = modelResult.model;
      provider = modelResult.provider;
      modelId = modelResult.modelId;
    }
  } catch (error) {
    // Graceful fallback: 스트리밍에서도 사용자 친화적 응답
    const fallbackMessage = '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.';
    yield { type: 'text_delta', data: fallbackMessage };
    yield {
      type: 'done',
      data: {
        success: true,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'none',
          modelId: 'none',
          stepsExecuted: 0,
          durationMs: Date.now() - startTime,
          mode: 'single',
          fallback: true,
          fallbackReason: 'no_provider',
        },
      },
    };
    return;
  }

  const circuitBreaker = getCircuitBreaker(`stream-${provider}`);

  if (!circuitBreaker.isAllowed()) {
    const cbStats = circuitBreaker.getStats();
    logger.warn(`[SupervisorStream] Circuit OPEN for ${provider}`, {
      failures: cbStats.failures,
      totalFailures: cbStats.totalFailures,
      lastFailure: cbStats.lastFailure?.toISOString(),
    });
    yield {
      type: 'error',
      data: {
        code: 'CIRCUIT_OPEN',
        message: `Provider ${provider} circuit breaker is OPEN`,
        metadata: {
          provider,
          failures: cbStats.totalFailures,
          lastFailure: cbStats.lastFailure?.toISOString(),
        },
      },
    };
    return;
  }

  try {
    logger.info(`[SupervisorStream] Using ${provider}/${modelId}`);

    const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
    const queryText = lastUserMessage?.content || '';
    const trace = createSupervisorTrace({
      sessionId: request.sessionId,
      mode: 'single',
      query: queryText,
      upstreamTraceId: request.traceId,
    });

    // Build multimodal messages
    const modelMessages: ModelMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...request.messages.map((m, idx): ModelMessage => {
        const isLastUserMessage =
          m.role === 'user' &&
          idx === request.messages.length - 1;

        if (isLastUserMessage) {
          return {
            role: m.role as 'user',
            content: buildMultimodalContent(m.content, request.images, request.files) as UserContent,
          };
        }

        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
    ];

    const webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
    logger.debug(`[Stream Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
    const filteredTools = filterToolsByWebSearch(allTools, webSearchEnabled);

    const toolsCalled: string[] = [];
    let fullText = '';

    let streamError: Error | null = null;

    const abortController = new AbortController();

    const result = streamText({
      model,
      messages: modelMessages,
      tools: filteredTools as ToolSet,
      prepareStep: createPrepareStep(queryText, { enableWebSearch: webSearchEnabled }),
      stopWhen: [hasToolCall('finalAnswer'), stepCountIs(3)],
      temperature: 0.4,
      maxOutputTokens: 1536,
      timeout: {
        totalMs: TIMEOUT_CONFIG.supervisor.hard,
        stepMs: TIMEOUT_CONFIG.agent.hard,
        chunkMs: 30_000,
      },
      abortSignal: abortController.signal,
      onError: ({ error }) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        logger.error('❌ [SingleAgent] streamText error:', {
          error: error instanceof Error ? error.message : String(error),
          model: modelId,
          provider,
          query: queryText.substring(0, 100),
        });
        streamError = error instanceof Error ? error : new Error(String(error));
      },
      onStepFinish: ({ finishReason, toolCalls, toolResults: stepToolResults }) => {
        const toolNames = toolCalls?.map((tc) => tc.toolName) || [];
        logger.debug(`[Stream Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`);

        if (trace && toolCalls?.length) {
          for (const tc of toolCalls) {
            const tr = stepToolResults?.find((r) => r.toolCallId === tc.toolCallId);
            logToolCall(trace, tc.toolName, tc.input, tr?.output, 0);
          }
        }
      },
      onFinish: ({ text, finishReason, steps: finishSteps }) => {
        const durationMs = Date.now() - startTime;
        const allToolsCalled = finishSteps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || []);
        logger.info(
          `[Stream Finish] reason=${finishReason}, steps=${finishSteps.length}, tools=[${allToolsCalled.join(',')}], duration=${durationMs}ms`
        );

        if (trace && finishReason !== 'error') {
          finalizeTrace(trace, text, true, {
            toolsCalled: allToolsCalled,
            stepsExecuted: finishSteps.length,
            durationMs,
            finishReason,
          });
        }
      },
    });

    const SINGLE_AGENT_HARD_TIMEOUT = TIMEOUT_CONFIG.supervisor.hard;
    const TIMEOUT_WARNING_THRESHOLD = TIMEOUT_CONFIG.supervisor.warning;
    let warningEmitted = false;

    for await (const textPart of result.textStream) {
      const elapsed = Date.now() - startTime;

      if (!warningEmitted && elapsed >= TIMEOUT_WARNING_THRESHOLD) {
        warningEmitted = true;
        logger.warn(`⚠️ [SingleAgent] Approaching timeout at ${elapsed}ms`);
        yield {
          type: 'warning',
          data: {
            code: 'SLOW_PROCESSING',
            message: '응답 생성이 지연되고 있습니다. 곧 완료됩니다.',
            elapsed,
            threshold: TIMEOUT_WARNING_THRESHOLD,
          },
        };
      }

      if (elapsed >= SINGLE_AGENT_HARD_TIMEOUT) {
        logger.error(
          `🛑 [SingleAgent] Hard timeout reached at ${elapsed}ms (limit: ${SINGLE_AGENT_HARD_TIMEOUT}ms)`
        );

        if (fullText.length > 0) {
          yield {
            type: 'text_delta',
            data: '\n\n---\n⏱️ *응답 시간 초과로 여기까지만 전달됩니다.*',
          };
        }

        yield {
          type: 'error',
          data: {
            code: 'HARD_TIMEOUT',
            error: `처리 시간이 ${SINGLE_AGENT_HARD_TIMEOUT / 1000}초를 초과했습니다.`,
            elapsed,
            partialResponseLength: fullText.length,
            suggestion: fullText.length > 0
              ? '부분 응답이 제공되었습니다. 추가 정보가 필요하면 질문을 더 구체적으로 해주세요.'
              : '쿼리를 간단하게 나눠서 다시 시도해주세요.',
          },
        };

        abortController.abort();

        return;
      }

      fullText += textPart;
      yield { type: 'text_delta', data: textPart };
    }

    if (streamError !== null) {
      yield {
        type: 'warning',
        data: {
          code: 'STREAM_ERROR_OCCURRED',
          message: (streamError as Error).message,
        },
      };
    }

    const [steps, usage] = await Promise.all([result.steps, result.usage]);

    const ragSources: RagSource[] = [];

    for (const step of steps) {
      for (const toolCall of step.toolCalls) {
        const toolName = toolCall.toolName;
        toolsCalled.push(toolName);
        yield { type: 'tool_call', data: { name: toolName } };
      }
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const trOutput = extractToolResultOutput(tr);
          if (trOutput !== undefined) {
            yield { type: 'tool_result', data: { toolName: tr.toolName, result: trOutput } };
            logToolCall(trace, tr.toolName, {}, trOutput, 0);
          }

          ragSources.push(...extractRagSources(tr.toolName, trOutput));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    logGeneration(trace, {
      model: modelId,
      provider,
      input: lastUserMessage?.content || '',
      output: fullText,
      usage: {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
      },
      duration: durationMs,
    });

    const capturedError = streamError as Error | null;
    const streamSucceeded = capturedError === null;
    finalizeTrace(trace, fullText, streamSucceeded, {
      toolsCalled,
      stepsExecuted: steps.length,
      durationMs,
      ...(capturedError && { error: capturedError.message }),
    });

    logger.info(
      `[SupervisorStream] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]`
    );

    const totalTokensUsed = usage?.totalTokens ?? 0;
    if (totalTokensUsed > 0) {
      await recordModelUsage(provider, totalTokensUsed, 'supervisor-stream');
    }

    yield {
      type: 'done',
      data: {
        success: capturedError === null,
        toolsCalled,
        usage: {
          promptTokens: usage?.inputTokens ?? 0,
          completionTokens: usage?.outputTokens ?? 0,
          totalTokens: totalTokensUsed,
        },
        metadata: {
          provider,
          modelId,
          stepsExecuted: steps.length,
          durationMs,
          mode: 'single',
          traceId: trace.id,
        },
        ...(ragSources.length > 0 && { ragSources }),
        ...(capturedError && {
          warning: {
            code: 'STREAM_ERROR_OCCURRED',
            message: capturedError.message,
          },
        }),
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [SupervisorStream] Error after ${durationMs}ms:`, errorMessage);

    yield {
      type: 'error',
      data: {
        code: error instanceof CircuitOpenError ? 'CIRCUIT_OPEN' : 'STREAM_ERROR',
        message: errorMessage,
      },
    };
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
