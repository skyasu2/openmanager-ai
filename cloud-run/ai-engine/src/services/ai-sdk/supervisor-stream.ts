import {
  hasToolCall,
  stepCountIs,
  streamText,
  type ModelMessage,
  type UserContent,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../config/timeout-config';
import { extractRagSources, extractToolResultOutput, buildMultimodalContent, type RagSource } from '../../lib/ai-sdk-utils';
import { isTavilyAvailable } from '../../lib/tavily-hybrid-rag';
import { logger } from '../../lib/logger';
import { allTools } from '../../tools-ai-sdk';
import { createSupervisorTrace, finalizeTrace, logGeneration, logToolCall } from '../observability/langfuse';
import { CircuitOpenError, getCircuitBreaker } from '../resilience/circuit-breaker';
import { executeMultiAgentStream } from './agents';
import { filterToolsByWebSearch, resolveWebSearchSetting } from './agents/orchestrator-web-search';
import {
  getSupervisorModel,
  getVisionAgentModel,
  logProviderStatus,
  recordModelUsage,
  type ProviderName,
} from './model-provider';
import { createPrepareStep, selectExecutionMode, SYSTEM_PROMPT } from './supervisor-routing';
import type { StreamEvent, SupervisorRequest } from './supervisor-types';

function resolveStreamMode(request: SupervisorRequest): 'single' | 'multi' {
  let mode = request.mode || 'auto';
  if (mode === 'auto') {
    const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
    mode = lastUserMessage ? selectExecutionMode(lastUserMessage.content) : 'single';
  }
  return mode === 'multi' ? 'multi' : 'single';
}

export async function* executeSupervisorStream(
  request: SupervisorRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();
  const mode = resolveStreamMode(request);

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
  } catch {
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

    let webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
    if (webSearchEnabled && !isTavilyAvailable()) {
      logger.warn('[Stream Single] Web search requested but Tavily unavailable');
      webSearchEnabled = false;
      yield { type: 'warning', data: { code: 'WEB_SEARCH_UNAVAILABLE', message: '웹 검색을 사용할 수 없습니다. 내부 데이터로 응답합니다.' } };
    }
    logger.debug(`[Stream Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
    const filteredTools = filterToolsByWebSearch(allTools, webSearchEnabled);

    const toolsCalled: string[] = [];
    let fullText = '';

    let streamError: Error | null = null;

    const abortController = new AbortController();

    const result = streamText({
      model,
      messages: modelMessages,
      tools: filteredTools,
      prepareStep: createPrepareStep(queryText, { enableWebSearch: webSearchEnabled }),
      stopWhen: [hasToolCall('finalAnswer'), stepCountIs(5)],
      temperature: 0.3,
      maxOutputTokens: 2048,
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

    // Resolve steps/usage early — needed to extract finalAnswer before empty-text check
    const stepsAndUsage = await Promise.all([result.steps, result.usage]).catch((stepsError) => {
      logger.warn('[SupervisorStream] Steps/usage unavailable:', stepsError instanceof Error ? stepsError.message : String(stepsError));
      return undefined;
    });
    const steps = stepsAndUsage?.[0] ?? [];
    const usage = stepsAndUsage?.[1];

    // Recover response from finalAnswer tool result when textStream was empty
    // (LLM may produce no text when it only calls tools and terminates via finalAnswer)
    if (fullText.trim().length === 0) {
      for (const step of steps) {
        if (fullText.trim().length > 0) break;
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            if (tr.toolName === 'finalAnswer') {
              const trOutput = extractToolResultOutput(tr);
              if (trOutput && typeof trOutput === 'object') {
                const finalResult = trOutput as Record<string, unknown>;
                if ('answer' in finalResult && typeof finalResult.answer === 'string' && finalResult.answer.trim().length > 0) {
                  fullText = finalResult.answer;
                  yield { type: 'text_delta', data: fullText };
                  logger.info('[SupervisorStream] Recovered response from finalAnswer tool result');
                }
              }
            }
          }
        }
      }
    }

    if (fullText.trim().length === 0) {
      const fallbackText =
        '응답 본문이 비어 있어 요약 결과를 생성하지 못했습니다. 질문을 조금 더 구체적으로 다시 시도해 주세요.';
      logger.warn(
        '[SupervisorStream] Empty stream output detected, emitting fallback text'
      );
      yield {
        type: 'warning',
        data: {
          code: 'EMPTY_RESPONSE',
          message:
            '모델이 빈 응답을 반환했습니다. 기본 안내 문구로 대체합니다.',
        },
      };
      yield { type: 'text_delta', data: fallbackText };
      fullText = fallbackText;
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
