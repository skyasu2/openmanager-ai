import {
  hasToolCall,
  stepCountIs,
  type ToolSet,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../config/timeout-config';
import type { DomainEvidenceResult } from '../../core/assistant-runtime';
import { extractToolResultOutput } from '../../lib/ai-sdk-utils';
import { getPublicErrorMessage, getPublicErrorResponse } from '../../lib/error-handler';
import { isTavilyAvailable } from '../../lib/tavily-web-search-client';
import { logger } from '../../lib/logger';
import { createSupervisorTrace, finalizeTrace, logGeneration, logToolCall } from '../observability/langfuse';
import { CircuitOpenError, getCircuitBreaker } from '../resilience/circuit-breaker';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import {
  filterToolsByRAG,
  filterToolsByWebSearch,
  resolveRAGSetting,
  resolveWebSearchSetting,
} from './agents/orchestrator-web-search';
import {
  recordModelUsage,
  type ProviderName,
} from './model-provider';
import { selectSupervisorStreamModel } from './supervisor-stream-model-selection';
import { waitBeforeSupervisorProviderFallback } from './stream-provider-fallback';
import type { ProviderQuotaReservation } from './stream-quota';
import {
  buildDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import {
  buildSupervisorAssistantPlanForRequest,
  buildSupervisorModeMetadata,
  buildSupervisorRouteDecision,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import {
  buildSupervisorStreamMessages,
  getLastUserQueryText,
} from './supervisor-stream-messages';
import { buildWebCitationAppendix } from './supervisor-stream-citations';
import { resolveDomainEvidenceForStream } from './supervisor-domain-evidence';
import { shouldRefuseInternalImplementationPathRequest } from './internal-disclosure-policy';
import {
  buildCircuitOpenErrorEvent,
  buildHardTimeoutErrorEvent,
  buildPublicErrorEvent,
  buildRateLimitedErrorEvent,
  buildSingleAgentDoneEvent,
  buildSupervisorAgentStatus,
  streamInternalImplementationPathRefusal,
  streamNoProviderFallback,
} from './supervisor-single-agent-events';
import { createStructuredTextDeltaGuard } from './supervisor-stream-text-guard';
import { streamDirectKnowledgeSearchIfMatched } from './supervisor-direct-knowledge-stream';
import {
  buildAgentStepEvent,
  estimateSupervisorStreamQuotaTokens,
  markSupervisorStreamCooldown,
  readToolStep,
  reconcileSupervisorStreamQuota,
  reserveSupervisorStreamQuota,
  textStreamAsFullStream,
  type CollectedToolResult,
} from './supervisor-stream-helpers';
import {
  emitGenericEmptySupervisorStreamFallback,
  recoverEmptySupervisorStreamOutput,
} from './supervisor-stream-recovery';
import { replaySupervisorStreamToolEvents } from './supervisor-stream-tool-events';
import type {
  StreamEvent,
  SupervisorRequest,
} from './supervisor-types';

export async function* streamSingleAgent(
  request: SupervisorRequest,
  startTime: number,
  runtimeTools: ToolSet,
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
  runtimeMetadata?: AssistantRuntimeMetadata,
  resolvedDomainEvidence?: DomainEvidenceResult,
): AsyncGenerator<StreamEvent> {
  const hasImages = (request.images?.length ?? 0) > 0;
  const routeDecision = modeDecision
    ? buildSupervisorRouteDecision(modeDecision, {
        traceId: request.traceId,
        queryAsOf: request.queryAsOf,
      })
    : undefined;
  const assistantPlan = routeDecision
    ? buildSupervisorAssistantPlanForRequest(request, routeDecision)
    : undefined;
  const excludedProviders: ProviderName[] = [];
  const MAX_PROVIDER_ATTEMPTS = 3;

  const queryText = getLastUserQueryText(request.messages);
  const runtimeHost = request.runtimeHost;
  if (!runtimeHost) {
    throw new Error('Supervisor runtime host is required for stream execution');
  }

  if (
    shouldRefuseInternalImplementationPathRequest(
      queryText,
      request.internalDisclosureMode
    )
  ) {
    yield* streamInternalImplementationPathRefusal({
      request,
      startTime,
      degradedFallbackContext,
      modeDecision,
      routeDecision,
      assistantPlan,
      runtimeMetadata,
    });
    return;
  }

  const domainEvidence =
    resolvedDomainEvidence ??
    (await resolveDomainEvidenceForStream({
      request,
      query: queryText,
      domain: runtimeHost.domain,
    }));
  const systemPrompt = runtimeHost.createSystemPrompt({ deviceType: request.deviceType });
  const modelMessages = buildSupervisorStreamMessages(request, systemPrompt, domainEvidence?.prompt);

  let webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
  if (webSearchEnabled && !isTavilyAvailable()) {
    logger.warn('[Stream Single] Web search requested but Tavily unavailable');
    webSearchEnabled = false;
    yield { type: 'warning', data: { code: 'WEB_SEARCH_UNAVAILABLE', message: '웹 검색을 사용할 수 없습니다. 내부 데이터로 응답합니다.' } };
  }
  logger.debug(`[Stream Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  const ragEnabled = resolveRAGSetting(request.enableRAG, queryText);
  logger.debug(`[Stream Single RAG] Setting: ${ragEnabled} (request: ${request.enableRAG})`);
  let filteredTools = filterToolsByWebSearch(runtimeTools, webSearchEnabled);
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);

  if (ragEnabled) {
    const handledDirectKnowledgeSearch =
      yield* streamDirectKnowledgeSearchIfMatched({
        request,
        queryText,
        filteredTools,
        degradedFallbackContext,
        modeDecision,
        routeDecision,
        assistantPlan,
        runtimeMetadata,
      });
    if (handledDirectKnowledgeSearch) return;
  }

  // Provider retry loop: automatically falls back to next provider on failure
  providerLoop:
  for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt++) {
    let selectedModel;

    // --- 1. Model Selection ---
    try {
      const modelSelection = selectSupervisorStreamModel({
        attempt,
        hasImages,
        imageCount: request.images?.length ?? 0,
        excludedProviders,
      });
      if (!modelSelection.ok) {
        yield modelSelection.event;
        return;
      }
      selectedModel = modelSelection;
    } catch {
      // No more providers available
      yield* streamNoProviderFallback({
        request,
        startTime,
        degradedFallbackContext,
        modeDecision,
        routeDecision,
        assistantPlan,
        runtimeMetadata,
      });
      return;
    }
    const { model, provider, modelId } = selectedModel;

    // --- 2. Circuit Breaker Check ---
    const circuitBreaker = getCircuitBreaker(`stream-${provider}`);

    if (!circuitBreaker.isAllowed()) {
      const cbStats = circuitBreaker.getStats();
      logger.warn(`[SupervisorStream] Circuit OPEN for ${provider}`, {
        failures: cbStats.failures,
        totalFailures: cbStats.totalFailures,
        lastFailure: cbStats.lastFailure?.toISOString(),
      });
      excludedProviders.push(provider);
      if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
        yield buildSupervisorAgentStatus(
          `${provider} 일시 차단됨, 대안 모델로 전환 중...`
        );
        await waitBeforeSupervisorProviderFallback(provider, 'circuit_open');
        continue providerLoop;
      }
      yield buildCircuitOpenErrorEvent({
        provider,
        failures: cbStats.totalFailures,
        lastFailure: cbStats.lastFailure,
      });
      return;
    }

    // --- 3. Stream Execution ---
    let quotaReservation: ProviderQuotaReservation | null = null;
    let quotaReservationReconciled = false;
    const reconcileQuotaOnce = async (actualTokensUsed: number) => {
      if (quotaReservationReconciled) return;
      await reconcileSupervisorStreamQuota(quotaReservation, actualTokensUsed);
      quotaReservationReconciled = true;
    };

    try {
      logger.info(`[SupervisorStream] Using ${provider}/${modelId}${attempt > 0 ? ` (retry #${attempt})` : ''}`);
      const providerStartTime = Date.now();
      const estimatedTokens = estimateSupervisorStreamQuotaTokens(modelMessages);
      quotaReservation = await reserveSupervisorStreamQuota(
        provider,
        modelId,
        estimatedTokens
      );

      if (quotaReservation && !quotaReservation.reserved) {
        const quotaError = `QUOTA_ADMISSION:${quotaReservation.reason ?? 'unknown'}`;
        excludedProviders.push(provider);
        logger.info(
          `[SupervisorStream] Skipping ${provider}/${modelId}: quota admission ${quotaReservation.reason ?? 'blocked'}`
        );
        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          yield buildSupervisorAgentStatus(
            `${provider} 쿼터 보호로 대안 모델로 전환 중...`
          );
          await waitBeforeSupervisorProviderFallback(provider, 'quota_admission');
          continue providerLoop;
        }
        yield buildRateLimitedErrorEvent({
          provider,
          modelId,
          reason: quotaReservation.reason,
          recommendedWaitMs: quotaReservation.recommendedWaitMs,
        });
        logger.warn(`[SupervisorStream] ${quotaError}`);
        return;
      }

      const trace = createSupervisorTrace({
        sessionId: request.sessionId,
        mode: 'single',
        query: queryText,
        upstreamTraceId: request.traceId,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
      });

      const toolsCalled: string[] = [];
      const recordedToolsCalled = new Set<string>();
      const recordToolCalled = (toolName: string) => {
        if (recordedToolsCalled.has(toolName)) return;
        recordedToolsCalled.add(toolName);
        toolsCalled.push(toolName);
      };
      let fullText = '';
      let streamError: Error | null = null;
      const abortController = new AbortController();
      const textDeltaGuard = createStructuredTextDeltaGuard();

      const prepareStep = runtimeHost.createPrepareStep(queryText, {
        enableWebSearch: webSearchEnabled,
        enableRAG: ragEnabled,
      });

      if (!runtimeHost.executeLLMStream) {
        throw new Error('Supervisor runtime host stream execution adapter is required');
      }

      const result = runtimeHost.executeLLMStream({
        model,
        messages: modelMessages,
        tools: filteredTools,
        ...(prepareStep && { prepareStep }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(4)],
        temperature: 0.3,
        maxOutputTokens: 2048,
        timeout: {
          totalMs:
            TIMEOUT_CONFIG.supervisor.hardStreaming ??
            TIMEOUT_CONFIG.supervisor.hard,
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
              ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
              ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
              ...buildDegradedMetadata(degradedFallbackContext, {}),
            });
          }
        },
      });

      const SINGLE_AGENT_HARD_TIMEOUT = TIMEOUT_CONFIG.supervisor.hardStreaming ?? TIMEOUT_CONFIG.supervisor.hard;
      const TIMEOUT_WARNING_THRESHOLD =
        TIMEOUT_CONFIG.supervisor.warningStreaming ??
        Math.max(
          TIMEOUT_CONFIG.supervisor.warning,
          Math.round(SINGLE_AGENT_HARD_TIMEOUT * 0.8)
        );
      let warningEmitted = false;
      let firstChunkMs: number | null = null;

      const emitDisplayText = function* (text: string): Generator<StreamEvent> {
        if (text.length === 0) return;
        fullText += text;
        yield { type: 'text_delta', data: text };
      };
      const markFirstStreamOutput = () => {
        if (firstChunkMs !== null) return;
        firstChunkMs = Date.now() - providerStartTime;
        logger.info(
          `[SupervisorStream] TTFB: ${firstChunkMs}ms (${provider}/${modelId})`
        );
      };

      const startedAgentSteps = new Set<string>();
      const completedAgentSteps = new Set<string>();
      const collectedToolResults: CollectedToolResult[] = [];
      const streamParts =
        result.fullStream ?? textStreamAsFullStream(result.textStream);

      for await (const streamPart of streamParts) {
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

          yield buildHardTimeoutErrorEvent({
            elapsed,
            partialResponseLength: fullText.length,
          });

          abortController.abort();

          return;
        }

        if (streamPart.type === 'text-delta') {
          const text = typeof streamPart.text === 'string' ? streamPart.text : '';
          for (const displayText of textDeltaGuard.push(text)) {
            markFirstStreamOutput();
            yield* emitDisplayText(displayText);
          }
        } else if (streamPart.type === 'tool-call') {
          const toolStep = readToolStep(streamPart);
          if (toolStep && !startedAgentSteps.has(toolStep.key)) {
            recordToolCalled(toolStep.tool);
            startedAgentSteps.add(toolStep.key);
            markFirstStreamOutput();
            yield buildAgentStepEvent(toolStep.tool, 'start');
          }
        } else if (
          streamPart.type === 'tool-result' ||
          streamPart.type === 'tool-error' ||
          streamPart.type === 'tool-output-denied'
        ) {
          const toolStep = readToolStep(streamPart);
          if (streamPart.type === 'tool-result' && toolStep) {
            const streamToolResult = extractToolResultOutput(streamPart);
            if (streamToolResult !== undefined) {
              collectedToolResults.push({
                toolName: toolStep.tool,
                result: streamToolResult,
              });
            }
          }
          if (toolStep && !completedAgentSteps.has(toolStep.key)) {
            completedAgentSteps.add(toolStep.key);
            markFirstStreamOutput();
            yield buildAgentStepEvent(toolStep.tool, 'done');
          }
        } else if (streamPart.type === 'error') {
          streamError =
            streamPart.error instanceof Error
              ? streamPart.error
              : new Error(String(streamPart.error ?? 'stream error'));
        }
      }

      for (const displayText of textDeltaGuard.flush()) {
        markFirstStreamOutput();
        yield* emitDisplayText(displayText);
      }

      // Resolve steps/usage early — needed to extract finalAnswer before empty-text check
      const stepsAndUsage = await Promise.all([result.steps, result.usage]).catch((stepsError) => {
        logger.warn('[SupervisorStream] Steps/usage unavailable:', stepsError instanceof Error ? stepsError.message : String(stepsError));
        return undefined;
      });
      const steps = stepsAndUsage?.[0] ?? [];
      const usage = stepsAndUsage?.[1];
      await reconcileQuotaOnce(
        usage?.totalTokens ?? quotaReservation?.estimatedTokens ?? 0
      );
      for (const step of steps) {
        if (!step.toolResults) continue;
        for (const tr of step.toolResults) {
          collectedToolResults.push({
            toolName: tr.toolName,
            result: extractToolResultOutput(tr),
          });
        }
      }

      if (textDeltaGuard.hasRawToolCall() && fullText.trim().length === 0) {
        const toolName = textDeltaGuard.getRawToolCallName();
        const formatError = `MODEL_EMITTED_RAW_TOOL_CALL_JSON${toolName ? `:${toolName}` : ''}`;
        excludedProviders.push(provider);

        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          finalizeTrace(trace, '', false, {
            toolsCalled: toolName ? [toolName] : [],
            stepsExecuted: steps.length,
            durationMs: Date.now() - startTime,
            error: formatError,
            ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
            ...buildDegradedMetadata(degradedFallbackContext, {}),
          });
          logger.warn(
            `[SupervisorStream] ${provider}/${modelId} emitted raw tool-call JSON${toolName ? ` (${toolName})` : ''}; retrying with next provider`
          );
          yield buildSupervisorAgentStatus(
            `${provider} 응답 형식 오류로 대안 모델로 전환 중...`
          );
          await waitBeforeSupervisorProviderFallback(provider, 'raw_tool_call_json');
          continue providerLoop;
        }

        const fallbackText =
          'AI 엔진이 도구 호출 정보를 응답 본문으로 반환해 표시를 차단했습니다. 같은 질문을 다시 시도해 주세요.';
        yield {
          type: 'warning',
          data: {
            code: 'RAW_TOOL_CALL_JSON_SUPPRESSED',
            message:
              '도구 호출 JSON이 응답 본문으로 반환되어 표시를 차단했습니다.',
          },
        };
        yield* emitDisplayText(fallbackText);
      }

      const recovery = yield* recoverEmptySupervisorStreamOutput({
        fullText,
        firstChunkMs,
        streamError,
        queryText,
        domainEvidence,
        steps,
        collectedToolResults,
        filteredTools,
        provider,
        modelId,
        providerStartTime,
        startTime,
      });
      fullText = recovery.fullText;
      firstChunkMs = recovery.firstChunkMs;
      streamError = recovery.streamError;

      // ★ Provider retry: if no text produced + stream error, try next provider
      if (fullText.trim().length === 0 && streamError !== null) {
        const failedError = streamError as Error;
        excludedProviders.push(provider);
        finalizeTrace(trace, '', false, {
          toolsCalled,
          stepsExecuted: steps.length,
          durationMs: Date.now() - startTime,
          error: failedError.message,
          ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
          ...buildDegradedMetadata(degradedFallbackContext, {}),
        });

        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          logger.warn(
            `⚠️ [SingleAgent] ${provider}/${modelId} failed without output (${failedError.message}), retrying with next provider...`
          );
          await reconcileQuotaOnce(0);
          await markSupervisorStreamCooldown(provider, modelId, failedError.message);
          yield buildSupervisorAgentStatus(
            `${provider} 응답 없음, 대안 모델로 전환 중...`
          );
          await waitBeforeSupervisorProviderFallback(provider, 'empty_output_with_error');
          continue providerLoop;
        }
      }

      if (fullText.trim().length === 0) {
        fullText = yield* emitGenericEmptySupervisorStreamFallback({
          streamError,
          queryText,
          steps,
          provider,
          modelId,
          startTime,
        });
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

      const streamToolEvidence = yield* replaySupervisorStreamToolEvents({
        steps,
        collectedToolResults,
        trace,
        recordToolCalled,
      });

      const webCitationAppendix = buildWebCitationAppendix(
        fullText,
        streamToolEvidence.ragSources
      );
      if (webCitationAppendix.length > 0) {
        fullText += webCitationAppendix;
        yield { type: 'text_delta', data: webCitationAppendix };
      }

      const durationMs = Date.now() - startTime;

      logGeneration(trace, {
        model: modelId,
        provider,
        input: queryText,
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
        ...(firstChunkMs !== null && { ttfbMs: firstChunkMs }),
        ...(capturedError && { error: capturedError.message }),
        ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
      });

      logger.info(
        `[SupervisorStream] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]`
      );

      const totalTokensUsed = usage?.totalTokens ?? 0;
      if (!quotaReservation?.reserved && totalTokensUsed > 0) {
        await recordModelUsage(provider, totalTokensUsed, 'supervisor-stream', modelId);
      }

      yield buildSingleAgentDoneEvent({
        request,
        modeDecision,
        routeDecision,
        assistantPlan,
        runtimeMetadata,
        degradedFallbackContext,
        provider,
        modelId,
        traceId: trace.id,
        stepsExecuted: steps.length,
        durationMs,
        toolsCalled,
        usage,
        totalTokensUsed,
        attempt,
        capturedError,
        ragSources: streamToolEvidence.ragSources,
        evidenceCards: streamToolEvidence.evidenceCards,
        retrieval: streamToolEvidence.retrieval,
        semanticQueryTrace: domainEvidence?.metadata?.semanticQueryTrace,
      });
      return;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reconcileQuotaOnce(0);
      await markSupervisorStreamCooldown(provider, modelId, errorMessage);
      const publicError = error instanceof CircuitOpenError
        ? { code: 'CIRCUIT_OPEN', message: getPublicErrorMessage('CIRCUIT_OPEN') }
        : getPublicErrorResponse(error);

      logger.error(`❌ [SupervisorStream] ${provider}/${modelId} error after ${durationMs}ms:`, errorMessage);

      // Try next provider if available
      excludedProviders.push(provider);
      if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
        logger.warn(`⚠️ [SingleAgent] ${provider}/${modelId} threw error, trying next provider...`);
        yield buildSupervisorAgentStatus(
          `${provider} 오류 발생, 대안 모델로 전환 중...`
        );
        await waitBeforeSupervisorProviderFallback(provider, 'provider_error');
        continue providerLoop;
      }

      yield buildPublicErrorEvent(publicError);
      return;
    }
  }
}
