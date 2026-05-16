/**
 * Supervisor Single-Agent Execution
 *
 * Single-agent mode with multi-step tool calling, retry logic,
 * circuit breaker, and streaming support.
 */

import {
  stepCountIs,
  hasToolCall,
  type ModelMessage,
  type ToolSet,
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
import { executeMultiAgent, type MultiAgentRequest, type MultiAgentResponse } from './agents';
import {
  filterToolsByRAG,
  resolveRAGSetting,
  resolveWebSearchSetting,
  filterToolsByWebSearch,
} from './agents/orchestrator-web-search';
import { isTavilyAvailable } from '../../lib/tavily-web-search-client';
import {
  createSupervisorTrace,
  logGeneration,
  logToolCall,
  finalizeTrace,
} from '../observability/langfuse';
import { getCircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import { extractToolResultOutput, extractRagSources, type RagSource } from '../../lib/ai-sdk-utils';
import { getPublicErrorMessage, getPublicErrorResponse } from '../../lib/error-handler';
import { getOffDomainGuardrail } from '../../lib/off-domain-guard';
import { sanitizeUserFacingResponse } from '../../lib/text-sanitizer';

import {
  SupervisorRequest,
  SupervisorResponse,
  SupervisorError,
  SupervisorHealth,
} from './supervisor-types';
import { logger } from '../../lib/logger';
import {
  getDefaultMonitoringAssistantRuntimeHost,
  resolveMonitoringSupervisorRuntimeContext,
  type AssistantRuntimeMetadata,
} from './monitoring-runtime-host';
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
  RETRY_CONFIG,
  getIntentCategory,
  getLLMParamsForIntent,
  type IntentCategory,
} from '../../domains/monitoring/routing-policy';

import { evaluateAgentResponseQuality } from './agents/response-quality';
import { shouldRetryForQuality } from './supervisor-quality-retry';
import {
  buildInternalImplementationPathPolicyMetadata,
  buildInternalImplementationPathRefusal,
  shouldRefuseInternalImplementationPathRequest,
} from './internal-disclosure-policy';
import { buildDeterministicSummaryFallback } from './agents/orchestrator-summary-fallback';
import type { CollectedToolResult } from './agents/orchestrator-summary-payload';
import { buildNoProviderFallbackResponse } from './supervisor-no-provider-fallback';
import {
  appendSupervisorContextPrompt,
  buildSupervisorLogContextPrompt,
} from './supervisor-log-context';
import { buildToolResultSummary } from './supervisor-tool-results';
import { enrichResponseWithToolResults } from './supervisor-response-enrichment';

export { executeSupervisorStream } from './supervisor-stream';

function getResponseQualityAgentName(intent: IntentCategory): string {
  switch (intent) {
    case 'metrics':
    case 'serverGroup':
      return 'Metrics Query Agent';
    case 'anomaly':
    case 'prediction':
    case 'rca':
      return 'Analyst Agent';
    case 'advisor':
      return 'Advisor Agent';
    default:
      return 'Supervisor';
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function executeSupervisor(
  request: SupervisorRequest
): Promise<SupervisorResponse | SupervisorError> {
  const startTime = Date.now();
  const runtimeContext = await resolveMonitoringSupervisorRuntimeContext(request);
  const runtimeMetadata = runtimeContext.metadata;
  const runtimeTools = runtimeContext.host.createToolSet(
    runtimeContext.result.context
  );
  let runtimeRequest: SupervisorRequest =
    request.runtimeHost === runtimeContext.host
      ? request
      : { ...request, runtimeHost: runtimeContext.host };
  const modeDecision = resolveSupervisorModeDecision(runtimeRequest);
  const mode = modeDecision.resolvedMode;
  const queryText = runtimeRequest.messages
    .filter((message) => message.role === 'user')
    .at(-1)?.content ?? '';

  logger.info({
    sessionId: request.sessionId,
    requestedMode: modeDecision.requestedMode,
    resolvedMode: modeDecision.resolvedMode,
    modeSelectionSource: modeDecision.modeSelectionSource,
    autoSelectedByComplexity: modeDecision.autoSelectedByComplexity,
  }, '[Supervisor] Mode resolved');

  if (
    shouldRefuseInternalImplementationPathRequest(
      queryText,
      runtimeRequest.internalDisclosureMode
    )
  ) {
    const durationMs = Date.now() - startTime;
    const response = buildInternalImplementationPathRefusal();
    return {
      success: true,
      response,
      toolsCalled: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        ...buildInternalImplementationPathPolicyMetadata(durationMs),
        ...buildSupervisorModeMetadata(modeDecision),
        ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
      },
    };
  }

  // Off-domain: prepend warning and continue to LLM (no blocking)
  const offDomainGuardrail = getOffDomainGuardrail(queryText);
  if (offDomainGuardrail) {
    logger.info({ category: offDomainGuardrail.category }, 'Supervisor: off-domain detected, delegating to LLM with warning');
  }
  const warningPrefix = Array.from(
    new Set(
      [
        request.securityWarning,
        request.offDomainWarning,
        offDomainGuardrail?.offDomainWarning,
      ].filter((warning): warning is string => Boolean(warning))
    )
  ).join('\n');

  const llmResult = mode === 'multi'
    ? await executeMultiAgentMode(runtimeRequest, startTime, modeDecision, runtimeMetadata, runtimeTools)
    : await executeSingleAgentMode(runtimeRequest, startTime, undefined, modeDecision, runtimeMetadata, runtimeTools);

  if (
    warningPrefix.length > 0 &&
    'response' in llmResult &&
    typeof llmResult.response === 'string'
  ) {
    return { ...llmResult, response: `${llmResult.response}\n\n---\n*${warningPrefix}*` };
  }

  return llmResult;
}

// ============================================================================
// Conditional multi-agent escalation path
// ============================================================================

async function executeMultiAgentMode(
  request: SupervisorRequest,
  startTime: number,
  modeDecision: ResolvedSupervisorModeDecision,
  runtimeMetadata: AssistantRuntimeMetadata,
  runtimeTools: ToolSet,
): Promise<SupervisorResponse | SupervisorError> {
  try {
    const multiAgentRequest: MultiAgentRequest = {
      messages: request.messages,
      sessionId: request.sessionId,
      domainId: request.runtimeHost?.domain.id,
      ...buildSupervisorModeMetadata(modeDecision),
      traceId: request.traceId,
      enableTracing: request.enableTracing,
      enableWebSearch: request.enableWebSearch,
      enableRAG: request.enableRAG,
      ...(request.internalDisclosureMode && {
        internalDisclosureMode: request.internalDisclosureMode,
      }),
      images: request.images,
      files: request.files,
      dataSource: request.runtimeHost?.domain.dataSource,
      metadata: request.metadata,
      domainEvidencePrompt: buildSupervisorLogContextPrompt(request.metadata),
    };

    const result = await executeMultiAgent(multiAgentRequest);

    if (!result.success) {
      const multiAgentError = result as SupervisorError;
      if (
        isSingleModeAllowed() &&
        shouldFallbackFromMultiAgentError(multiAgentError.code)
      ) {
        const degradedReason =
          multiAgentError.code === 'MODEL_UNAVAILABLE'
            ? 'multi_agent_model_unavailable'
            : 'multi_agent_runtime_error';
        logger.info(
          `[Supervisor] Falling back to single-agent mode (degraded) after multi-agent error: ${multiAgentError.code}`
        );
        return executeSingleAgentMode(
          request,
          startTime,
          {
            degradedFromMode: 'multi',
            degradedReason,
          },
          modeDecision,
          runtimeMetadata,
          runtimeTools
        );
      }
      return multiAgentError;
    }

    const multiResult = result as MultiAgentResponse;

    if (multiResult.usage.totalTokens > 0) {
      await recordModelUsage(
        multiResult.metadata.provider as ProviderName,
        multiResult.usage.totalTokens,
        'multi-agent',
        multiResult.metadata.modelId
      );
    }

    const sanitizedResponse = {
      success: true,
      response: multiResult.response,
      toolsCalled: multiResult.toolsCalled,
      toolResults: [],
      ragSources: multiResult.ragSources,
      evidenceCards: multiResult.evidenceCards,
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
        retrieval: multiResult.metadata.retrieval,
        assistantRuntime: runtimeMetadata,
      },
    };

    return sanitizedResponse as SupervisorResponse;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ [Supervisor] Multi-agent error after ${durationMs}ms:`, errorMessage);

    if (isSingleModeAllowed()) {
      logger.info(`[Supervisor] Falling back to single-agent mode (degraded)`);
      return executeSingleAgentMode(
        request,
        startTime,
        {
          degradedFromMode: 'multi',
          degradedReason: 'multi_agent_runtime_error',
        },
        modeDecision,
        runtimeMetadata,
        runtimeTools
      );
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
  runtimeMetadata?: AssistantRuntimeMetadata,
  runtimeTools?: ToolSet,
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
      modeDecision,
      runtimeMetadata,
      runtimeTools
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
  runtimeMetadata?: AssistantRuntimeMetadata,
  runtimeTools?: ToolSet,
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
  let rotationSlot: number | undefined;

  try {
    const modelResult = getSupervisorModel(excludeProviders);
    model = modelResult.model;
    provider = modelResult.provider;
    modelId = modelResult.modelId;
    rotationSlot = modelResult.rotationSlot;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Supervisor] No available providers:', errorMessage);

    const durationMs = Date.now() - startTime;
    finalizeTrace(trace, 'Provider unavailable - fallback response', false, {
      durationMs,
      excludedProviders: excludeProviders,
      ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
      ...buildDegradedMetadata(degradedFallbackContext, {
        fallback: true,
        fallbackReason: 'no_provider',
      }),
    });

    return buildNoProviderFallbackResponse({
      durationMs,
      modeDecision,
      runtimeMetadata,
      degradedFallbackContext,
    });
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
      const ragEnabled = resolveRAGSetting(request.enableRAG, queryText);
      const runtimeHost = request.runtimeHost;
      if (!runtimeHost) {
        throw new Error('Supervisor runtime host is required for single-agent execution');
      }
      const systemPrompt = appendSupervisorContextPrompt(
        runtimeHost.createSystemPrompt({
          deviceType: request.deviceType,
        }),
        buildSupervisorLogContextPrompt(request.metadata)
      )!;
      const prepareStep = runtimeHost.createPrepareStep(queryText, {
        enableWebSearch: webSearchEnabled,
        enableRAG: ragEnabled,
      });
      let filteredTools = filterToolsByWebSearch(
        runtimeTools ?? {},
        webSearchEnabled
      );
      filteredTools = filterToolsByRAG(filteredTools, ragEnabled);

      const modelMessages: ModelMessage[] = [
        { role: 'system', content: systemPrompt },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      if (!runtimeHost.executeLLMGenerate) {
        throw new Error('Supervisor runtime host generate execution adapter is required');
      }

      const llmParams = getLLMParamsForIntent(intentCategory);

      const result = await runtimeHost.executeLLMGenerate({
        model,
        messages: modelMessages,
        tools: filteredTools,
        ...(prepareStep && { prepareStep }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(5)],
        temperature: llmParams.temperature,
        maxOutputTokens: llmParams.maxOutputTokens,
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
      const collectedToolResults: CollectedToolResult[] = [];
      const toolResultSummaries: Array<{
        toolName: string;
        label: string;
        summary: string;
        preview?: string;
        status: 'completed' | 'failed';
      }> = [];
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
              collectedToolResults.push({
                toolName: tr.toolName,
                result: trOutput,
              });
              toolResultSummaries.push(
                buildToolResultSummary(tr.toolName, trOutput)
              );
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

      const deterministicResponse = buildDeterministicSummaryFallback(
        queryText,
        'Supervisor',
        collectedToolResults
      );
      const response = sanitizeUserFacingResponse(
        deterministicResponse ?? finalAnswerResult?.answer ?? result.text
      );

      const durationMs = Date.now() - startTime;
      const qualityAgentName = getResponseQualityAgentName(intentCategory);
      const quality = evaluateAgentResponseQuality(qualityAgentName, response, {
        durationMs,
      });

      // Post-processing enrichment: fill missing evidence from tool results
      const enrichment = enrichResponseWithToolResults(
        response,
        quality.qualityFlags,
        collectedToolResults
      );
      const finalResponse = enrichment.enrichedResponse;
      // Re-evaluate quality after enrichment to update flags
      const finalQuality = enrichment.enrichmentApplied
        ? evaluateAgentResponseQuality(qualityAgentName, finalResponse, {
            durationMs,
          })
        : quality;

      logGeneration(trace, {
        model: modelId,
        provider,
        input: lastUserMessage?.content || '',
        output: finalResponse,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
        duration: durationMs,
        metadata: {
          intent: intentCategory,
          qualityAgentName,
          usedFinalAnswer: !!finalAnswerResult,
          usedPrepareStep: true,
          enrichmentApplied: enrichment.enrichmentApplied,
        },
      });

      finalizeTrace(trace, finalResponse, true, {
        toolsCalled,
        stepsExecuted: result.steps.length,
        durationMs,
        intent: intentCategory,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
      });

      logger.info(
        `[Supervisor] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]${finalAnswerResult ? ' (via finalAnswer)' : ''}${enrichment.enrichmentApplied ? ` (enriched: ${enrichment.enrichmentSections.join(',')})` : ''}, ragSources: ${ragSources.length}`
      );

      const totalTokens = result.usage?.totalTokens ?? 0;
      if (totalTokens > 0) {
        await recordModelUsage(provider, totalTokens, 'supervisor', modelId);
      }

      return {
        success: true,
        response: finalResponse,
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
          responseChars: finalQuality.responseChars,
          formatCompliance: finalQuality.formatCompliance,
          qualityFlags: finalQuality.qualityFlags,
          latencyTier: finalQuality.latencyTier,
          finalAgent: qualityAgentName,
          traceId: trace.id,
          ...(typeof rotationSlot === 'number' && { rotationSlot }),
          ...(toolResultSummaries.length > 0 && {
            toolResultSummaries,
          }),
          ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
          ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
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
    const runtimeHost = getDefaultMonitoringAssistantRuntimeHost();
    const toolCount = Object.keys(
      runtimeHost.createToolSet({
        id: 'supervisor-health-check',
        domainId: runtimeHost.domain.id,
        message: 'health check',
        messages: [{ role: 'user', content: 'health check' }],
      })
    ).length;

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
