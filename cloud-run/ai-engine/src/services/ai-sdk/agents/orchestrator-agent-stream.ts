import {
  streamText,
  type UserContent,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import type {
  AssistantMessage,
  DomainDataSource,
} from '../../../core/assistant-runtime';
import { buildMultimodalContent } from '../../../lib/ai-sdk-utils';
import { logger } from '../../../lib/logger';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { createTimeoutSpan, logTimeoutEvent } from '../../observability/langfuse';
import { getCircuitBreaker } from '../../resilience/circuit-breaker';
import { waitBeforeAgentProviderFallback } from '../stream-provider-fallback';
import {
  markStreamProviderCooldown,
  reconcileStreamQuota,
  reserveStreamQuota,
  type ProviderQuotaReservation,
} from '../stream-quota';
import type { StreamEvent } from '../supervisor';
import type { FileAttachment, ImageAttachment } from './base-agent';
import {
  getAgentConfig,
  getAgentProviderOrder,
} from './orchestrator-routing';
import {
  buildAgentLoopSettings,
  toAgentLoopTelemetry,
} from './config/agent-loop-settings';
import {
  buildAgentProviderAttempts,
  buildAgentProviderRetryStatus,
  collectAgentToolEvents,
  countServersFromToolResults,
  emitAllProvidersFailedEvent,
  emitAgentSuccessDoneEvent,
  emitNoOutputFallbackDoneEvent,
  estimateAgentStreamQuotaTokens,
  getAgentInstructions,
  getEvidenceToolResults,
  shouldRepairToolGroundedResponse,
  streamReporterPipelineIfAvailable,
} from './orchestrator-agent-stream-helpers';
import { runSummarizationFallback } from './orchestrator-agent-stream-summary';
import {
  ORCHESTRATOR_CONFIG,
  type ProviderAttemptTelemetry,
} from './orchestrator-types';
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
} from './orchestrator-summary-fallback';
import { createStructuredTextDeltaGuard } from '../supervisor-stream-text-guard';
import {
  createAgentDataSourceContext,
  resolveDomainSnapshot,
} from './domain-data-source';

const RAW_TOOL_CALL_JSON_FALLBACK_TEXT =
  'AI 엔진이 도구 호출 정보를 응답 본문으로 반환해 표시를 차단했습니다. 같은 질문을 다시 시도해 주세요.';

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
  dataSource?: DomainDataSource,
  domainId?: string,
  domainEvidencePrompt?: string,
  conversationMessages?: AssistantMessage[],
): AsyncGenerator<StreamEvent> {
  // Buffer model text for queries that may be answered deterministically; once
  // tool results are available, the route is re-evaluated with data evidence.
  const mayUseDeterministicSummary = isDeterministicSummaryQuery(
    query,
    agentName,
    1
  );
  let preferDeterministicSummary = mayUseDeterministicSummary;
  const dataSourceContext = createAgentDataSourceContext({
    query,
    domainId,
    sessionId,
    conversationMessages,
  });
  let snapshotResolved = false;
  let snapshotData: unknown;
  const getSnapshotData = async (): Promise<unknown | undefined> => {
    if (!snapshotResolved) {
      snapshotResolved = true;
      snapshotData = (
        await resolveDomainSnapshot(
          dataSource,
          dataSourceContext,
          `agent-stream:${agentName}`
        )
      )?.data;
    }
    return snapshotData;
  };
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
    const reporterHandled = yield* streamReporterPipelineIfAvailable({
      query,
      startTime,
      dataSource,
      domainId,
      sessionId,
      agentName,
    });
    if (reporterHandled) return;
  }

  // Vision Agent: use native model (gemini) directly, skip text provider chain
  const isVisionAgent = agentName === 'Vision Agent';
  const nativeModel = isVisionAgent ? agentConfig.getModel() : null;

  // Phase 2A: Provider fallback — try multiple providers on failure
  const excludedProviders: string[] = [];
  let lastError: string | undefined;

  // Build provider attempt list: Vision Agent uses native model, others use text providers
  const providerAttempts = buildAgentProviderAttempts({
    agentName,
    isVisionAgent,
    nativeModel,
    rawProviderOrder: getAgentProviderOrder(agentName),
  });
  const providerAttemptTelemetry: ProviderAttemptTelemetry[] = [];

  providerLoop:
  for (let attemptIndex = 0; attemptIndex < providerAttempts.length; attemptIndex++) {
    const { model, provider, modelId } = providerAttempts[attemptIndex];
    if (excludedProviders.includes(provider)) continue;
    logger.debug(`[Stream ${agentName}] Attempting ${provider}/${modelId}`);

    const loopSettings = buildAgentLoopSettings(agentName, 'agent-stream');
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
      let quotaReservation: ProviderQuotaReservation | null = null;
      let quotaReservationReconciled = false;
      const reconcileQuotaOnce = async (actualTokensUsed: number) => {
        if (quotaReservationReconciled) return;
        await reconcileStreamQuota(quotaReservation, actualTokensUsed);
        quotaReservationReconciled = true;
      };
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
      const useNativeVisionPrompt =
        isVisionAgent && ((images?.length ?? 0) > 0 || (files?.length ?? 0) > 0);
      const systemContent = [
        getAgentInstructions(agentConfig, query),
        domainEvidencePrompt,
      ]
        .filter((part): part is string => Boolean(part))
        .join('\n\n');
      const estimatedTokens = estimateAgentStreamQuotaTokens(
        [systemContent, userContent as UserContent],
        loopSettings.maxOutputTokens
      );
      quotaReservation = await reserveStreamQuota(
        provider,
        modelId,
        estimatedTokens
      );

      if (quotaReservation && !quotaReservation.reserved) {
        excludedProviders.push(provider);
        lastError = `QUOTA_ADMISSION:${quotaReservation.reason ?? 'unknown'}`;
        providerAttemptTelemetry.push({
          provider,
          modelId,
          attempt: attemptIndex + 1,
          durationMs: Date.now() - providerStartTime,
          error: lastError,
        });
        logger.info(
          `[Stream ${agentName}] Skipping ${provider}/${modelId}: quota admission ${quotaReservation.reason ?? 'blocked'}`
        );
        if (attemptIndex < providerAttempts.length - 1) {
          yield buildAgentProviderRetryStatus(
            agentName,
            `${provider} 쿼터 보호로 대안 모델로 전환 중...`
          );
          await waitBeforeAgentProviderFallback(
            agentName,
            provider,
            'quota_admission'
          );
        }
        continue providerLoop;
      }

      const streamResult = streamText({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent as UserContent },
        ],
        ...(!useNativeVisionPrompt && {
          tools: filteredTools as Parameters<typeof streamText>[0]['tools'],
          stopWhen: loopSettings.stopWhen,
        }),
        temperature: 0.4,
        maxOutputTokens: loopSettings.maxOutputTokens,
        maxRetries: loopSettings.sdkMaxRetries,
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
      let fullResponseText = '';
      let fallbackReason: string | undefined;
      const textDeltaGuard = createStructuredTextDeltaGuard();
      const emitDisplayText = function* (
        displayText: string,
        source: string
      ): Generator<StreamEvent> {
        if (!displayText) return;

        fullResponseText += displayText;
        const hasVisibleText = displayText.trim().length > 0;
        if (hasVisibleText) {
          textEmitted = true;
        }
        if (hasVisibleText && !preferDeterministicSummary) {
          textDelivered = true;
          markFirstChunk(source);
          yield { type: 'text_delta', data: displayText };
        }
      };

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
          for (const displayText of textDeltaGuard.push(sanitized)) {
            yield* emitDisplayText(displayText, 'text_stream');
          }
        }
      }

      if (hardTimeoutReached) {
        return;
      }

      for (const displayText of textDeltaGuard.flush()) {
        yield* emitDisplayText(displayText, 'text_stream');
      }

      if (textDeltaGuard.hasRawToolCall() && !textDelivered) {
        const toolName = textDeltaGuard.getRawToolCallName();
        lastError = 'RAW_TOOL_CALL_JSON';
        fallbackReason = lastError;
        logger.warn(
          `[Stream ${agentName}] ${provider}/${modelId} emitted raw tool-call JSON${toolName ? ` (${toolName})` : ''}`
        );

        if (attemptIndex < providerAttempts.length - 1) {
          excludedProviders.push(provider);
          providerAttemptTelemetry.push({
            provider,
            modelId,
            attempt: attemptIndex + 1,
            durationMs: Date.now() - providerStartTime,
            error: lastError,
          });
          yield buildAgentProviderRetryStatus(
            agentName,
            `${provider} 응답 형식 오류로 대안 모델로 전환 중...`
          );
          await waitBeforeAgentProviderFallback(
            agentName,
            provider,
            'raw_tool_call_json'
          );
          continue providerLoop;
        }
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
      await reconcileQuotaOnce(
        usage?.totalTokens ?? quotaReservation?.estimatedTokens ?? 0
      );
      const finalElapsed = Date.now() - startTime;
      timeoutSpan.complete(true, finalElapsed);

      const {
        toolsCalled,
        collectedToolResults,
        finalAnswerResult,
      } = yield* collectAgentToolEvents(steps);

      if (
        !textEmitted &&
        finalAnswerResult?.answer &&
        !textDelivered &&
        !preferDeterministicSummary
      ) {
        const sanitized = sanitizeChineseCharacters(finalAnswerResult.answer);
        if (sanitized) {
          textEmitted = true;
          textDelivered = true;
          fullResponseText += sanitized;
          markFirstChunk('final_answer');
          yield { type: 'text_delta', data: sanitized };
        }
      }

      // Re-evaluate after tool results are known — intent classification + data completeness.
      // This replaces the previous upfront regex check and makes routing data-driven.
      const toolResultServerCount =
        countServersFromToolResults(collectedToolResults);
      preferDeterministicSummary =
        toolResultServerCount > 0
          ? isDeterministicSummaryQuery(query, agentName, toolResultServerCount)
          : mayUseDeterministicSummary;

      const deterministicSummary = buildDeterministicSummaryFallback(
        query,
        agentName,
        collectedToolResults,
        await getSnapshotData()
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

      if (mayUseDeterministicSummary && !textDelivered) {
        const stateSummary = buildDeterministicSummaryFromCurrentState(
          query,
          agentName,
          await getSnapshotData()
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

      if (mayUseDeterministicSummary && !textDelivered) {
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

      const shouldRepairResponse =
        textDelivered &&
        shouldRepairToolGroundedResponse(
          fullResponseText,
          collectedToolResults,
          preferDeterministicSummary
        );

      // Summarization Fallback
      if (
        (!textDelivered && getEvidenceToolResults(collectedToolResults).length > 0) ||
        shouldRepairResponse
      ) {
        const summarizationReason = shouldRepairResponse
          ? 'LOW_INFORMATION_RESPONSE'
          : 'EMPTY_RESPONSE';
        fallbackReason = summarizationReason;
        logger.warn(
          `[Stream ${agentName}] ${summarizationReason} with ${getEvidenceToolResults(collectedToolResults).length} tool results — attempting summarization fallback`
        );

        const summaryResult = await runSummarizationFallback({
          query,
          agentName,
          provider,
          modelId,
          providerStartTime,
          providerAttempts,
          attemptIndex,
          excludedProviders,
          collectedToolResults,
          summarizationReason,
          providerAttemptTelemetry,
        });

        if (summaryResult) {
          const { summaryText } = summaryResult;
          responseProvider = summaryResult.responseProvider;
          responseModelId = summaryResult.responseModelId;
          responseAttemptNumber = summaryResult.responseAttemptNumber;
          responseProviderStartTime = summaryResult.responseProviderStartTime;
          responseUsage = summaryResult.responseUsage;
          textEmitted = true;
          textDelivered = true;
          fullResponseText = shouldRepairResponse
            ? `${fullResponseText.trim()}\n\n${summaryText}`.trim()
            : summaryText;
          markFirstChunk('summarization_fallback');
          yield {
            type: 'text_delta',
            data: shouldRepairResponse ? `\n\n${summaryText}` : summaryText,
          };
          logger.info(
            `[Stream ${agentName}] Summarization fallback succeeded (${summaryText.length} chars)`
          );
        }
      }

      if (!textDelivered) {
        const stateSummary = buildDeterministicSummaryFromCurrentState(
          query,
          agentName,
          await getSnapshotData()
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
        yield buildAgentProviderRetryStatus(
          agentName,
          `${provider} 응답 없음, 대안 모델로 전환 중...`
        );
        await waitBeforeAgentProviderFallback(
          agentName,
          provider,
          'empty_response'
        );
        continue providerLoop;
      }

      if (!textEmitted) {
        const rawToolCallSuppressed = textDeltaGuard.hasRawToolCall();
        const fallbackText = rawToolCallSuppressed
          ? RAW_TOOL_CALL_JSON_FALLBACK_TEXT
          : '응답을 생성하지 못했습니다. 질문을 더 구체적으로 다시 시도해 주세요.';
        logger.warn(`[Stream ${agentName}] Empty response, emitting fallback`);
        fallbackReason = rawToolCallSuppressed
          ? 'RAW_TOOL_CALL_JSON'
          : 'EMPTY_RESPONSE';
        yield {
          type: 'warning',
          data: rawToolCallSuppressed
            ? {
                code: 'RAW_TOOL_CALL_JSON_SUPPRESSED',
                message:
                  '도구 호출 JSON이 응답 본문으로 반환되어 표시를 차단했습니다.',
              }
            : {
                code: 'EMPTY_RESPONSE',
                message: '모델이 빈 응답을 반환했습니다.',
              },
        };
        markFirstChunk(
          rawToolCallSuppressed
            ? 'raw_tool_call_json_fallback'
            : 'empty_response_fallback'
        );
        yield { type: 'text_delta', data: fallbackText };
        fullResponseText = fallbackText;
      }

      const durationMs = Date.now() - startTime;
      yield* emitAgentSuccessDoneEvent({
        agentName,
        sessionId,
        fullResponseText,
        durationMs,
        fallbackReason,
        responseProvider,
        responseModelId,
        responseAttemptNumber,
        responseProviderStartTime,
        providerAttemptTelemetry,
        currentProvider: provider,
        responseUsage,
        firstChunkMs,
        toolsCalled,
        agentLoop: toAgentLoopTelemetry(
          loopSettings,
          steps?.length ?? 0
        ),
        collectedToolResults,
      });
      return; // Success — exit provider loop
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reconcileQuotaOnce(0);
      await markStreamProviderCooldown(provider, modelId, errorMessage);
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
          yield buildAgentProviderRetryStatus(
            agentName,
            `${provider} 응답 없음, 대안 모델로 전환 중...`
          );
          await waitBeforeAgentProviderFallback(
            agentName,
            provider,
            'no_output'
          );
          continue providerLoop;
        }

        logger.warn(`[Stream ${agentName}] No output from model (${provider}), providing fallback`);
        yield* emitNoOutputFallbackDoneEvent({
          agentName,
          provider,
          modelId,
          attempt: attemptIndex + 1,
          durationMs,
          providerStartTime,
          firstChunkMs,
          providerAttemptTelemetry,
          markFirstChunk,
          agentLoop: toAgentLoopTelemetry(loopSettings, 0),
        });
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
        yield buildAgentProviderRetryStatus(
          agentName,
          `${provider} 오류 발생, 대안 모델로 전환 중...`
        );
        await waitBeforeAgentProviderFallback(
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
  yield emitAllProvidersFailedEvent({
    agentName,
    lastError,
    providerAttemptTelemetry,
  });
}
