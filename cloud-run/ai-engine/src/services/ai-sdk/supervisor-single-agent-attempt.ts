import {
  stepCountIs,
  hasToolCall,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../config/timeout-config';
import {
  RETRY_CONFIG,
  getIntentCategory,
  getLLMParamsForIntent,
} from '../../domains/monitoring/routing-policy';
import {
  extractToolResultOutput,
  extractRagSources,
  type RagSource,
} from '../../lib/ai-sdk-utils';
import { getPublicErrorMessage, getPublicErrorResponse } from '../../lib/error-handler';
import { isTavilyAvailable } from '../../lib/tavily-web-search-client';
import { logger } from '../../lib/logger';
import { sanitizeUserFacingResponse } from '../../lib/text-sanitizer';
import {
  executeMultiAgent,
  type MultiAgentRequest,
  type MultiAgentResponse,
} from './agents';
import {
  buildDeterministicSummaryFallback,
} from './agents/orchestrator-summary-fallback';
import type { CollectedToolResult } from './agents/orchestrator-summary-payload';
import {
  filterToolsByRAG,
  filterToolsByWebSearch,
  resolveRAGSetting,
  resolveWebSearchSetting,
} from './agents/orchestrator-web-search';
import { evaluateAgentResponseQuality } from './agents/response-quality';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import {
  getSupervisorModel,
  logProviderStatus,
  recordModelUsage,
  type ProviderName,
} from './model-provider';
import {
  createSupervisorTrace,
  finalizeTrace,
  logGeneration,
  logToolCall,
} from '../observability/langfuse';
import { getCircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import {
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import {
  buildDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import { buildNoProviderFallbackResponse } from './supervisor-no-provider-fallback';
import { enrichResponseWithToolResults } from './supervisor-response-enrichment';
import {
  appendSupervisorContextPrompt,
  buildSupervisorLogContextPrompt,
} from './supervisor-log-context';
import { normalizeSupervisorIntentFrame } from './supervisor-semantic-metadata';
import { buildToolResultSummary } from './supervisor-tool-results';
import type { SupervisorRequest, SupervisorResponse, SupervisorError } from './supervisor-types';
import {
  getResponseQualityAgentName,
} from './supervisor-domain-evidence-response';

export async function executeSupervisorAttempt(
  request: SupervisorRequest,
  startTime: number,
  excludeProviders: ProviderName[] = [],
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
  runtimeMetadata?: AssistantRuntimeMetadata,
  runtimeTools?: ToolSet
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
    logger.warn(
      `[Supervisor] Circuit OPEN for ${provider}, will try next provider on retry`
    );

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
      const intentFrame = normalizeSupervisorIntentFrame(
        request.metadata?.intentFrame
      );
      const intentCategory = getIntentCategory(queryText, intentFrame);

      let webSearchEnabled = resolveWebSearchSetting(
        request.enableWebSearch,
        queryText
      );
      if (webSearchEnabled && !isTavilyAvailable()) {
        logger.warn(
          '[Single] Web search requested but Tavily unavailable, falling back to internal data'
        );
        webSearchEnabled = false;
      }
      logger.debug(
        `[Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`
      );
      const ragEnabled = resolveRAGSetting(request.enableRAG, queryText);
      const runtimeHost = request.runtimeHost;
      if (!runtimeHost) {
        throw new Error(
          'Supervisor runtime host is required for single-agent execution'
        );
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
        ...(intentFrame && { intentFrame }),
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
        throw new Error(
          'Supervisor runtime host generate execution adapter is required'
        );
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
          logger.debug(
            `[Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`
          );

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

            if (
              tr.toolName === 'finalAnswer' &&
              trOutput &&
              typeof trOutput === 'object'
            ) {
              const finalResult = trOutput as Record<string, unknown>;
              if (
                'answer' in finalResult &&
                typeof finalResult.answer === 'string'
              ) {
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

    const publicError =
      error instanceof CircuitOpenError
        ? {
            code: 'CIRCUIT_OPEN',
            message: getPublicErrorMessage('CIRCUIT_OPEN'),
          }
        : getPublicErrorResponse(error);

    return {
      success: false,
      error: publicError.message,
      code: publicError.code,
      provider,
    };
  }
}
