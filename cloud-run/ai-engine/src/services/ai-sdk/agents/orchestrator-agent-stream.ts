import {
  generateText,
  hasToolCall,
  stepCountIs,
  streamText,
  type UserContent,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { buildMultimodalContent, extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { logger } from '../../../lib/logger';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { createTimeoutSpan, logTimeoutEvent } from '../../observability/langfuse';
import { getCircuitBreaker } from '../../resilience/circuit-breaker';
import type { StreamEvent } from '../supervisor';
import type { FileAttachment, ImageAttachment } from './base-agent';
import {
  getAgentConfig,
  getAgentProviderOrder,
  getAgentMaxSteps,
  executeReporterWithPipeline,
} from './orchestrator-routing';
import { saveAgentFindingsToContext } from './orchestrator-context';
import { selectTextModel, type TextProvider, type ModelResult } from './config/agent-model-selectors';
import {
  ORCHESTRATOR_CONFIG,
  type ProviderAttemptTelemetry,
} from './orchestrator-types';
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import { evaluateAgentResponseQuality } from './response-quality';
import { streamTextInChunks } from './orchestrator-decomposition';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
} from './orchestrator-summary-fallback';

const PROVIDER_FALLBACK_BASE_DELAY_MS = 120;
const PROVIDER_FALLBACK_JITTER_MS = 280;

function getAgentInstructions(
  config: NonNullable<ReturnType<typeof getAgentConfig>>,
  query: string
): string {
  return config.getInstructions?.(query) ?? config.instructions;
}

function classifyProviderFallbackReason(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('too_many_requests') ||
    normalized.includes('queue_exceeded') ||
    normalized.includes('high traffic')
  ) {
    return 'rate_limit';
  }
  if (normalized.includes('timeout')) {
    return 'timeout';
  }
  if (normalized.includes('no output')) {
    return 'no_output';
  }
  if (normalized.includes('empty_response')) {
    return 'empty_response';
  }
  if (
    normalized.includes('does not exist') ||
    normalized.includes('no access') ||
    normalized.includes('model not found') ||
    normalized.includes('404')
  ) {
    return 'model_unavailable';
  }
  if (
    normalized.includes('unavailable') ||
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('504')
  ) {
    return 'provider_unavailable';
  }
  return 'provider_error';
}

async function waitBeforeProviderFallback(
  agentName: string,
  provider: string,
  reason: string
): Promise<void> {
  const jitter = Math.floor(Math.random() * (PROVIDER_FALLBACK_JITTER_MS + 1));
  const delay = PROVIDER_FALLBACK_BASE_DELAY_MS + jitter;
  logger.debug(
    `[Stream ${agentName}] Provider fallback delay ${delay}ms (${provider}, reason=${reason})`
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function selectSummarizationModel(
  providerAttempts: ModelResult[],
  currentAttemptIndex: number,
  excludedProviders: string[]
): { modelResult: ModelResult; attemptIndex: number; delegated: boolean } {
  for (
    let nextIndex = currentAttemptIndex + 1;
    nextIndex < providerAttempts.length;
    nextIndex++
  ) {
    const nextAttempt = providerAttempts[nextIndex];
    if (nextAttempt && !excludedProviders.includes(nextAttempt.provider)) {
      return {
        modelResult: nextAttempt,
        attemptIndex: nextIndex,
        delegated: true,
      };
    }
  }

  return {
    modelResult: providerAttempts[currentAttemptIndex],
    attemptIndex: currentAttemptIndex,
    delegated: false,
  };
}

function getSuggestedFollowUp(agentName: string, responseText: string): string | null {
  if (agentName === 'Analyst Agent') {
    if (/이상|anomal|critical|경고|임계/i.test(responseText)) {
      return '해결 방법과 권장 조치를 알려줘';
    }
  }
  if (agentName === 'NLQ Agent') {
    if (/[89]\d%|100%|임계|경고|critical/i.test(responseText)) {
      return '이상 원인을 분석해줘';
    }
  }
  if (agentName === 'Reporter Agent') {
    return '재발 방지 방안을 알려줘';
  }
  return null;
}

export async function* executeAgentStream(
  query: string,
  agentName: string,
  startTime: number,
  sessionId: string,
  webSearchEnabled = true,
  ragEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[],
  contextSummary?: string | null,
): AsyncGenerator<StreamEvent> {
  const preferDeterministicSummary = isDeterministicSummaryQuery(
    query,
    agentName
  );
  const agentConfig = getAgentConfig(agentName);

  if (!agentConfig) {
    yield {
      type: 'error',
      data: { code: 'AGENT_NOT_FOUND', error: `Agent ${agentName} not found` },
    };
    return;
  }

  // Phase 3: Reporter Pipeline — run deterministic pipeline first, then stream result
  if (agentName === 'Reporter Agent') {
    try {
      const pipelineResult = await executeReporterWithPipeline(query, startTime);
      if (pipelineResult) {
        const reporterTtfbMs = Date.now() - startTime;
        logger.info(`[Stream Reporter] Pipeline succeeded, streaming result`);
        yield* streamTextInChunks(pipelineResult.response);

        // Phase 2C: Context saving
        try { await saveAgentFindingsToContext(sessionId, agentName, pipelineResult.response); } catch { /* non-blocking */ }

        const durationMs = Date.now() - startTime;
        yield {
          type: 'done',
          data: {
            success: true,
            finalAgent: agentName,
            toolsCalled: pipelineResult.toolsCalled,
            handoffs: pipelineResult.handoffs,
            usage: {
              promptTokens: pipelineResult.usage?.promptTokens ?? 0,
              completionTokens: pipelineResult.usage?.completionTokens ?? 0,
              totalTokens: pipelineResult.usage?.totalTokens ?? 0,
            },
            metadata: { ...pipelineResult.metadata, durationMs, ttfbMs: reporterTtfbMs },
          },
        };
        return;
      }
      logger.info(`[Stream Reporter] Pipeline failed, falling back to raw streamText`);
    } catch (pipelineError) {
      logger.warn(`[Stream Reporter] Pipeline error, falling back:`, pipelineError instanceof Error ? pipelineError.message : String(pipelineError));
    }
  }

  // Vision Agent: use native model (gemini) directly, skip text provider chain
  const isVisionAgent = agentName === 'Vision Agent';
  const nativeModel = isVisionAgent ? agentConfig.getModel() : null;

  // Phase 2A: Provider fallback — try multiple providers on failure
  const TEXT_PROVIDERS: TextProvider[] = ['cerebras', 'groq', 'mistral'];
  const rawProviderOrder = getAgentProviderOrder(agentName);
  const providerOrder = isVisionAgent
    ? [] // Vision Agent skips text providers
    : rawProviderOrder.filter((p): p is TextProvider => TEXT_PROVIDERS.includes(p as TextProvider));
  const excludedProviders: string[] = [];
  let lastError: string | undefined;

  // Build provider attempt list: Vision Agent uses native model, others use text providers
  const providerAttempts: ModelResult[] = [];
  const providerAttemptTelemetry: ProviderAttemptTelemetry[] = [];

  if (isVisionAgent && nativeModel) {
    // Vision Agent: single attempt with native model (gemini/openrouter)
    providerAttempts.push(nativeModel);
  } else if (isVisionAgent && !nativeModel) {
    // Vision model unavailable — will fall through to "all providers exhausted"
    logger.warn(`[Stream ${agentName}] Native vision model unavailable`);
  }

  // Text agents: build attempts from provider order
  for (const attemptProvider of providerOrder) {
    const circuitBreaker = getCircuitBreaker(`orchestrator-${attemptProvider}`);
    if (!circuitBreaker.isAllowed()) {
      logger.warn(`🔌 [Stream ${agentName}] CB OPEN for ${attemptProvider}, trying next`);
      continue;
    }

    const modelResult = selectTextModel(agentName, [attemptProvider], {
      requiredCapabilities: { requireToolCalling: true },
    });
    if (!modelResult) {
      logger.debug(`[Stream ${agentName}] No model for ${attemptProvider}, trying next`);
      continue;
    }

    providerAttempts.push(modelResult);
  }

  providerLoop:
  for (let attemptIndex = 0; attemptIndex < providerAttempts.length; attemptIndex++) {
    const { model, provider, modelId } = providerAttempts[attemptIndex];
    if (excludedProviders.includes(provider)) continue;
    logger.debug(`[Stream ${agentName}] Attempting ${provider}/${modelId}`);

    const buildProviderRetryStatus = (message: string): StreamEvent => ({
      type: 'agent_status',
      data: {
        agent: agentName,
        status: 'processing',
        message,
      },
    });

    let filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
    filteredTools = filterToolsByRAG(filteredTools, ragEnabled);
    const timeoutSpan = createTimeoutSpan(sessionId, `${agentName}_stream`, ORCHESTRATOR_CONFIG.timeout);
    const abortController = new AbortController();
    const providerStartTime = Date.now();
    let responseProvider = provider;
    let responseModelId = modelId;
    let responseAttemptNumber = attemptIndex + 1;
    let responseProviderStartTime = providerStartTime;
    let firstChunkMs: number | null = null;
    const markFirstChunk = (source: string) => {
      if (firstChunkMs !== null) return;
      firstChunkMs = Date.now() - providerStartTime;
      logger.info(
        `[Stream ${agentName}] TTFB: ${firstChunkMs}ms (${provider}/${modelId}, source=${source})`
      );
    };

    try {
      const promptWithContext = contextSummary
        ? `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}`
        : query;
      const userContent = buildMultimodalContent(promptWithContext, images, files);

      const agentMaxSteps = getAgentMaxSteps(agentName);
      const streamResult = streamText({
        model,
        messages: [
          { role: 'system', content: getAgentInstructions(agentConfig, query) },
          { role: 'user', content: userContent as UserContent },
        ],
        tools: filteredTools as Parameters<typeof generateText>[0]['tools'],
        // Keep extra headroom only for multi-tool Analyst/Reporter paths.
        // Other agents use the tighter default cap to reduce unnecessary loops.
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(agentMaxSteps)],
        temperature: 0.4,
        maxOutputTokens: 2048,
        maxRetries: 0,
        timeout: {
          totalMs: TIMEOUT_CONFIG.agent.hard,
          stepMs: TIMEOUT_CONFIG.subtask.hard,
          chunkMs: 25_000,
        },
        abortSignal: abortController.signal,
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map((toolCall) => toolCall.toolName) || [];
          logger.debug(`[${agentName} Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      let warningEmitted = false;
      let hardTimeoutReached = false;
      let textEmitted = false;
      let textDelivered = false;
      const toolsCalled: string[] = [];
      let fullResponseText = '';
      let fallbackReason: string | undefined;

      for await (const textChunk of streamResult.textStream) {
        const elapsed = Date.now() - startTime;

        if (elapsed >= ORCHESTRATOR_CONFIG.hardTimeout) {
          hardTimeoutReached = true;
          logger.error(`🛑 [Stream ${agentName}] Hard timeout at ${elapsed}ms`);

          logTimeoutEvent('error', {
            operation: `${agentName}_stream_hard_timeout`,
            elapsed,
            threshold: ORCHESTRATOR_CONFIG.hardTimeout,
            sessionId,
          });

          yield {
            type: 'error',
            data: {
              code: 'HARD_TIMEOUT',
              error: `처리 시간이 ${ORCHESTRATOR_CONFIG.hardTimeout / 1000}초를 초과했습니다.`,
              elapsed,
            },
          };

          abortController.abort();
          return;
        }

        if (!warningEmitted && elapsed >= ORCHESTRATOR_CONFIG.warnThreshold) {
          warningEmitted = true;
          logger.warn(`⚠️ [Stream ${agentName}] Exceeding ${ORCHESTRATOR_CONFIG.warnThreshold}ms`);

          yield {
            type: 'warning',
            data: {
              code: 'SLOW_PROCESSING',
              message: `처리 시간이 ${ORCHESTRATOR_CONFIG.warnThreshold / 1000}초를 초과했습니다.`,
              elapsed,
              threshold: ORCHESTRATOR_CONFIG.warnThreshold,
            },
          };

          logTimeoutEvent('warning', {
            operation: `${agentName}_stream`,
            elapsed,
            threshold: ORCHESTRATOR_CONFIG.warnThreshold,
            sessionId,
          });
        }

        const sanitized = sanitizeChineseCharacters(textChunk);
        if (sanitized) {
          fullResponseText += sanitized;
          const hasVisibleText = sanitized.trim().length > 0;
          if (hasVisibleText) {
            textEmitted = true;
          }
          if (hasVisibleText && !preferDeterministicSummary) {
            textDelivered = true;
            markFirstChunk('text_stream');
            yield { type: 'text_delta', data: sanitized };
          }
        }
      }

      if (hardTimeoutReached) {
        return;
      }

      const stepsAndUsage = await Promise.all([streamResult.steps, streamResult.usage]).catch(
        (stepsError) => {
          logger.warn(
            `[Stream ${agentName}] Steps/usage unavailable:`,
            stepsError instanceof Error ? stepsError.message : String(stepsError)
          );
          return undefined;
        }
      );
      const steps = stepsAndUsage?.[0];
      const usage = stepsAndUsage?.[1];
      let responseUsage = usage;
      const finalElapsed = Date.now() - startTime;
      timeoutSpan.complete(true, finalElapsed);

      let finalAnswerResult: { answer: string } | null = null;
      const collectedToolResults: Array<{ toolName: string; result: unknown }> = [];

      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              toolsCalled.push(toolCall.toolName);
              yield { type: 'tool_call', data: { name: toolCall.toolName } };
            }
          }
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              const toolResultOutput = extractToolResultOutput(toolResult);
              collectedToolResults.push({
                toolName: toolResult.toolName,
                result: toolResultOutput,
              });
              // ⚠️ PARITY: supervisor-stream.ts:498 단일 에이전트 경로와 동일하게 tool_result를
              // 상위 stream으로 yield 해야 함. 누락 시 프론트엔드 분석 근거 영역이 비어있게 됨.
              if (toolResult.toolName !== 'finalAnswer') {
                yield {
                  type: 'tool_result',
                  data: { toolName: toolResult.toolName, result: toolResultOutput },
                };
              }
              if (
                toolResult.toolName === 'finalAnswer' &&
                toolResultOutput &&
                typeof toolResultOutput === 'object'
              ) {
                finalAnswerResult = toolResultOutput as { answer: string };
              }
            }
          }
        }
      }

      if (!textEmitted && finalAnswerResult?.answer && !textDelivered) {
        const sanitized = sanitizeChineseCharacters(finalAnswerResult.answer);
        if (sanitized) {
          textEmitted = true;
          textDelivered = true;
          fullResponseText += sanitized;
          markFirstChunk('final_answer');
          yield { type: 'text_delta', data: sanitized };
        }
      }

      const deterministicSummary = buildDeterministicSummaryFallback(
        query,
        agentName,
        collectedToolResults
      );

      if (deterministicSummary && (!textDelivered || preferDeterministicSummary)) {
        textEmitted = true;
        textDelivered = true;
        fullResponseText = deterministicSummary;
        markFirstChunk('deterministic_summary');
        yield { type: 'text_delta', data: deterministicSummary };
        logger.info(
          `[Stream ${agentName}] Deterministic summary ${preferDeterministicSummary ? 'override' : 'fallback'} succeeded (${deterministicSummary.length} chars)`
        );
      }

      if (preferDeterministicSummary && !textDelivered) {
        const stateSummary = buildDeterministicSummaryFromCurrentState(
          query,
          agentName
        );
        if (stateSummary) {
          textEmitted = true;
          textDelivered = true;
          fullResponseText = stateSummary;
          markFirstChunk('current_state_override');
          yield { type: 'text_delta', data: stateSummary };
          logger.info(
            `[Stream ${agentName}] Current-state deterministic summary override succeeded (${stateSummary.length} chars)`
          );
        }
      }

      if (preferDeterministicSummary && !textDelivered) {
        const bufferedText = sanitizeChineseCharacters(
          (finalAnswerResult?.answer ?? fullResponseText).trim()
        );
        if (bufferedText) {
          textEmitted = true;
          textDelivered = true;
          fullResponseText = bufferedText;
          markFirstChunk('buffered_text');
          yield { type: 'text_delta', data: bufferedText };
        }
      }

      // Summarization Fallback
      if (!textDelivered && collectedToolResults.length > 0) {
        logger.warn(
          `[Stream ${agentName}] Empty response with ${collectedToolResults.length} tool results — attempting summarization fallback`
        );

        try {
          const uniqueResults = new Map<string, unknown>();
          for (const tr of collectedToolResults) {
            if (!uniqueResults.has(tr.toolName)) {
              uniqueResults.set(tr.toolName, tr.result);
            }
          }

          const toolResultsSummary = Array.from(uniqueResults.entries())
            .map(([name, result]) => `[${name}]: ${JSON.stringify(result).slice(0, 2000)}`)
            .join('\n\n');
          const summaryModelSelection = selectSummarizationModel(
            providerAttempts,
            attemptIndex,
            excludedProviders
          );
          const {
            model: summaryModel,
            provider: summaryProvider,
            modelId: summaryModelId,
          } = summaryModelSelection.modelResult;
          const summaryStartTime = Date.now();

          if (summaryModelSelection.delegated) {
            providerAttemptTelemetry.push({
              provider,
              modelId,
              attempt: attemptIndex + 1,
              durationMs: Date.now() - providerStartTime,
              error: 'EMPTY_RESPONSE',
            });
            fallbackReason = 'EMPTY_RESPONSE';
            logger.info(
              `[Stream ${agentName}] Delegating summarization fallback from ${provider}/${modelId} to ${summaryProvider}/${summaryModelId}`
            );
          }

          const summaryResult = await generateText({
            model: summaryModel,
            messages: [
              {
                role: 'system',
                content:
                  '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
              },
              {
                role: 'user',
                content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
              },
            ],
            temperature: 0.4,
            maxOutputTokens: 1024,
            maxRetries: 0,
            timeout: { totalMs: 10_000 },
          });

          const summaryText = sanitizeChineseCharacters(summaryResult.text?.trim() || '');
          if (summaryText) {
            responseProvider = summaryProvider;
            responseModelId = summaryModelId;
            responseAttemptNumber = summaryModelSelection.attemptIndex + 1;
            responseProviderStartTime = summaryStartTime;
            responseUsage = summaryResult.usage;
            textEmitted = true;
            textDelivered = true;
            fullResponseText = summaryText;
            markFirstChunk('summarization_fallback');
            yield { type: 'text_delta', data: summaryText };
            logger.info(`[Stream ${agentName}] Summarization fallback succeeded (${summaryText.length} chars)`);
          }
        } catch (summaryError) {
          logger.warn(
            `[Stream ${agentName}] Summarization fallback failed:`,
            summaryError instanceof Error ? summaryError.message : String(summaryError)
          );
        }
      }

      if (!textDelivered) {
        const stateSummary = buildDeterministicSummaryFromCurrentState(
          query,
          agentName
        );
        if (stateSummary) {
          textEmitted = true;
          textDelivered = true;
          fullResponseText = stateSummary;
          markFirstChunk('current_state_fallback');
          yield { type: 'text_delta', data: stateSummary };
          logger.info(
            `[Stream ${agentName}] Current-state deterministic fallback succeeded (${stateSummary.length} chars)`
          );
        }
      }

      if (!textEmitted && attemptIndex < providerAttempts.length - 1) {
        excludedProviders.push(provider);
        lastError = 'EMPTY_RESPONSE';
        providerAttemptTelemetry.push({
          provider,
          modelId,
          attempt: attemptIndex + 1,
          durationMs: Date.now() - providerStartTime,
          error: 'EMPTY_RESPONSE',
        });
        logger.warn(
          `[Stream ${agentName}] Empty response from ${provider}/${modelId}; trying next provider...`
        );
        yield buildProviderRetryStatus(
          `${provider} 응답 없음, 대안 모델로 전환 중...`
        );
        await waitBeforeProviderFallback(
          agentName,
          provider,
          'empty_response'
        );
        continue providerLoop;
      }

      if (!textEmitted) {
        const fallbackText =
          '응답을 생성하지 못했습니다. 질문을 더 구체적으로 다시 시도해 주세요.';
        logger.warn(`[Stream ${agentName}] Empty response, emitting fallback`);
        fallbackReason = 'EMPTY_RESPONSE';
        yield {
          type: 'warning',
          data: { code: 'EMPTY_RESPONSE', message: '모델이 빈 응답을 반환했습니다.' },
        };
        markFirstChunk('empty_response_fallback');
        yield { type: 'text_delta', data: fallbackText };
        fullResponseText = fallbackText;
      }

      const durationMs = Date.now() - startTime;
      providerAttemptTelemetry.push({
        provider: responseProvider,
        modelId: responseModelId,
        attempt: responseAttemptNumber,
        durationMs: Date.now() - responseProviderStartTime,
        ...(fallbackReason && responseProvider === provider
          ? { error: fallbackReason }
          : {}),
      });
      const usedFallback = providerAttemptTelemetry.length > 1;
      const providerFallbackReason =
        providerAttemptTelemetry.find((attempt) => attempt.error)?.error;
      const quality = evaluateAgentResponseQuality(agentName, fullResponseText, {
        durationMs,
        fallbackReason,
      });
      logger.info(`[Stream ${agentName}] Completed in ${durationMs}ms via ${responseProvider}, tools: [${toolsCalled.join(', ')}]`);

      // Phase 2C: Save agent findings to context (non-blocking)
      try { await saveAgentFindingsToContext(sessionId, agentName, fullResponseText); } catch { /* non-blocking */ }

      const followUp = getSuggestedFollowUp(agentName, fullResponseText);

      yield {
        type: 'done',
        data: {
          success: true,
          finalAgent: agentName,
          toolsCalled,
          handoffs: [{ from: 'Orchestrator', to: agentName, reason: 'Routing' }],
          usage: {
            promptTokens: responseUsage?.inputTokens ?? 0,
            completionTokens: responseUsage?.outputTokens ?? 0,
            totalTokens: responseUsage?.totalTokens ?? 0,
          },
          metadata: {
            provider: responseProvider,
            modelId: responseModelId,
            durationMs,
            responseChars: quality.responseChars,
            formatCompliance: quality.formatCompliance,
            qualityFlags: quality.qualityFlags,
            latencyTier: quality.latencyTier,
            ...(firstChunkMs !== null ? { ttfbMs: firstChunkMs } : {}),
            providerAttempts: providerAttemptTelemetry,
            usedFallback,
            ...(providerFallbackReason
              ? { fallbackReason: classifyProviderFallbackReason(providerFallbackReason) }
              : {}),
          },
          ...(followUp && { suggestedFollowUp: followUp }),
        },
      };
      return; // Success — exit provider loop
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNoOutput = errorMessage.includes('No output generated');

      if (isNoOutput) {
        excludedProviders.push(provider);
        lastError = errorMessage;

        if (attemptIndex < providerAttempts.length - 1) {
          providerAttemptTelemetry.push({
            provider,
            modelId,
            attempt: attemptIndex + 1,
            durationMs: Date.now() - providerStartTime,
            error: errorMessage,
          });
          logger.warn(
            `[Stream ${agentName}] No output from ${provider}/${modelId}, trying next provider...`
          );
          yield buildProviderRetryStatus(
            `${provider} 응답 없음, 대안 모델로 전환 중...`
          );
          await waitBeforeProviderFallback(
            agentName,
            provider,
            'no_output'
          );
          continue providerLoop;
        }

        logger.warn(`[Stream ${agentName}] No output from model (${provider}), providing fallback`);
        const noOutputFallback = '모델이 응답을 생성하지 못했습니다. 다시 시도해 주세요.';
        markFirstChunk('no_output_fallback');
        yield { type: 'text_delta', data: noOutputFallback };
        providerAttemptTelemetry.push({
          provider,
          modelId,
          attempt: attemptIndex + 1,
          durationMs: Date.now() - providerStartTime,
          error: 'NO_OUTPUT',
        });
        const quality = evaluateAgentResponseQuality(agentName, '모델이 응답을 생성하지 못했습니다. 다시 시도해 주세요.', {
          durationMs,
          fallbackReason: 'NO_OUTPUT',
        });
        yield {
          type: 'done',
          data: {
            success: false,
            finalAgent: agentName,
            toolsCalled: [],
            handoffs: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            metadata: {
              provider,
              modelId,
              durationMs,
              responseChars: quality.responseChars,
              formatCompliance: quality.formatCompliance,
              qualityFlags: quality.qualityFlags,
              latencyTier: quality.latencyTier,
              ...(firstChunkMs !== null ? { ttfbMs: firstChunkMs } : {}),
              providerAttempts: providerAttemptTelemetry,
              usedFallback: providerAttemptTelemetry.length > 1,
              fallbackReason: 'no_output',
            },
          },
        };
        return;
      }

      // Record failure for circuit breaker
      try {
        const agentCircuitBreaker = getCircuitBreaker(`orchestrator-${provider}`);
        agentCircuitBreaker.execute(() => Promise.reject(error)).catch(() => {});
      } catch {
        // Ignore circuit breaker recording errors.
      }

      excludedProviders.push(provider);
      lastError = errorMessage;
      providerAttemptTelemetry.push({
        provider,
        modelId,
        attempt: attemptIndex + 1,
        durationMs: Date.now() - providerStartTime,
        error: errorMessage,
      });
      logger.warn(`[Stream ${agentName}] Provider ${provider} failed: ${errorMessage}, trying next...`);
      if (attemptIndex < providerAttempts.length - 1) {
        yield buildProviderRetryStatus(
          `${provider} 오류 발생, 대안 모델로 전환 중...`
        );
        await waitBeforeProviderFallback(
          agentName,
          provider,
          'provider_error'
        );
      }
      continue; // Try next provider
    }
  }

  // All providers exhausted
  logger.error(`❌ [Stream ${agentName}] All providers failed. Last error: ${lastError}`);
  yield {
    type: 'error',
    data: {
      code: 'STREAM_ERROR',
      error: lastError ?? `All providers failed for ${agentName}`,
      metadata: {
        providerAttempts: providerAttemptTelemetry,
        usedFallback: providerAttemptTelemetry.length > 1,
        ...(lastError ? { fallbackReason: classifyProviderFallbackReason(lastError) } : {}),
      },
    },
  };
}
