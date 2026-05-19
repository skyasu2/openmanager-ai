/**
 * Orchestrator Routing Logic
 *
 * Model selection, Reporter Pipeline, and Agent config/forced routing.
 *
 * @version 4.0.0
 */

import { generateText } from 'ai';
import { generateTextWithRetry } from '../../resilience/retry-with-fallback';
import type { DomainDataSource } from '../../../core/assistant-runtime';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import {
  AGENT_NAMES,
  getAgentMaxSteps as getRuntimeAgentMaxSteps,
  getAgentConfig as getNamedAgentConfig,
  getAgentProviderOrder as getRuntimeAgentProviderOrder,
  getOrchestratorProviderOrder,
  type AgentConfig,
} from './config';
import {
  selectTextModel,
  type TextProvider,
  type ModelResult,
} from './config/agent-model-selectors';
import type { ImageAttachment, FileAttachment } from './base-agent';
import {
  buildAgentLoopSettings,
  toAgentLoopTelemetry,
} from './config/agent-loop-settings';

import type { MultiAgentResponse } from './orchestrator-types';
import { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
import { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';
import { evaluateAgentResponseQuality } from './response-quality';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
} from './orchestrator-summary-fallback';
import { logger } from '../../../lib/logger';
import { createRetrievalMetadata } from '../../../lib/retrieval-contract';
import type { InternalDisclosureMode } from '../internal-disclosure-policy';
import {
  createAgentDataSourceContext,
  resolveDomainSnapshot,
} from './domain-data-source';
import { executeForcedKnowledgePath } from './orchestrator-forced-knowledge-path';
import {
  buildContextAwarePrompt,
  getAgentInstructions,
  getForcedRoutingCapabilityRequirements,
} from './orchestrator-prompt-helpers';
import { summarizeToolResultsIfEmpty } from './orchestrator-summarization-fallback';
import { resolveForcedRoutingPolicy } from './orchestrator-routing-policy';
import {
  resolveFallbackReason,
  toProviderAttemptTelemetry,
} from './orchestrator-routing-telemetry';
import { collectForcedRoutingToolObservations } from './orchestrator-routing-telemetry-helpers';
import { enrichResponseWithToolResults } from '../supervisor-response-enrichment';
export { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
export { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';
export {
  executeWithAgentFactory,
  getAgentTypeFromName,
} from './orchestrator-factory';

// ============================================================================
// Orchestrator Model (3-way fallback)
// ============================================================================

export const ORCHESTRATOR_PROVIDER_ORDER: TextProvider[] =
  getOrchestratorProviderOrder();

export function getOrchestratorModel(): ModelResult | null {
  // Orchestrator uses Output.object structured generation (requires json_schema support).
  // Keep Groq last so Metrics Query can spend Groq RPD on actual tool-loop work.
  return selectTextModel('Orchestrator', ORCHESTRATOR_PROVIDER_ORDER, {
    cbPrefix: 'orchestrator',
    requiredCapabilities: { requireStructuredOutput: true },
  });
}

// Log available agents from AGENT_CONFIGS
const availableAgentNames = AGENT_NAMES.filter(name => {
  const config = getNamedAgentConfig(name);
  return (
    config &&
    config.visibility !== 'pipeline-internal' &&
    config.getModel() !== null
  );
});

if (availableAgentNames.length === 0) {
  logger.error('❌ [CRITICAL] No agents available! Check API keys: CEREBRAS_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY');
} else {
  logger.info(`[Orchestrator] Available agents: ${availableAgentNames.length} - [${availableAgentNames.join(', ')}]`);
}

// ============================================================================
// Agent Execution (AI SDK v6 Native)
// ============================================================================

export function getAgentConfig(name: string): AgentConfig | null {
  return getNamedAgentConfig(name) ?? null;
}

export const getAgentProviderOrder = getRuntimeAgentProviderOrder;
export const getAgentMaxSteps = getRuntimeAgentMaxSteps;

export async function executeForcedRouting(
  query: string,
  suggestedAgentName: string,
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[],
  contextSummary?: string | null,
  dataSource?: DomainDataSource,
  domainId?: string,
  internalDisclosureMode?: InternalDisclosureMode,
  domainEvidencePrompt?: string
): Promise<MultiAgentResponse | null> {
  logger.info(`[Forced Routing] Looking up agent config: "${suggestedAgentName}"`);
  const dataSourceContext = createAgentDataSourceContext({ query, domainId });
  let snapshotResolved = false;
  let snapshotData: unknown;
  const getSnapshotData = async (): Promise<unknown | undefined> => {
    if (!snapshotResolved) {
      snapshotResolved = true;
      snapshotData = (
        await resolveDomainSnapshot(
          dataSource,
          dataSourceContext,
          `forced-routing:${suggestedAgentName}`
        )
      )?.data;
    }
    return snapshotData;
  };

  if (suggestedAgentName === 'Reporter Agent') {
    logger.info(`[Forced Routing] Routing to Reporter Pipeline`);
    const pipelineResult = await executeReporterWithPipeline(
      query,
      startTime,
      dataSource,
      domainId
    );
    if (pipelineResult) {
      return pipelineResult;
    }
    logger.info(`[Forced Routing] Pipeline failed, falling back to direct Reporter Agent`);
  }

  const routingPolicy = resolveForcedRoutingPolicy({
    query,
    suggestedAgentName,
    webSearchEnabled,
    ragEnabled,
  });

  if (!routingPolicy) {
    logger.warn(`⚠️ [Forced Routing] No config for "${suggestedAgentName}"`);
    return null;
  }

  const {
    agentConfig,
    providerOrder,
    evidenceBudget,
    filteredTools,
    forceKnowledgeBaseTool,
    isForceKnowledgeBaseQuery,
  } = routingPolicy;
  logger.info(`[Forced Routing] Using retry with fallback: [${providerOrder.join(' → ')}]`);

  const forcedKnowledgePathResult = await executeForcedKnowledgePath({
    query,
    startTime,
    suggestedAgentName,
    ragEnabled,
    isForceKnowledgeBaseQuery,
    forceKnowledgeBaseTool,
    filteredTools: filteredTools as Record<string, unknown>,
    evidenceBudget,
    getSnapshotData,
    internalDisclosureMode,
  });
  if (forcedKnowledgePathResult) {
    return forcedKnowledgePathResult;
  }

  const attachmentHint =
    images?.length || files?.length
      ? `\n\n[첨부 컨텍스트]\n- images: ${images?.length ?? 0}\n- files: ${files?.length ?? 0}`
      : '';
  const executionPrompt = buildContextAwarePrompt(`${query}${attachmentHint}`, contextSummary);
  const systemContent = [
    getAgentInstructions(agentConfig, query),
    domainEvidencePrompt,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');

  const loopSettings = buildAgentLoopSettings(
    suggestedAgentName,
    'forced-routing'
  );

  try {
    const retryResult = await generateTextWithRetry(
      {
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: executionPrompt },
        ],
        tools: filteredTools as Parameters<typeof generateText>[0]['tools'],
        ...(forceKnowledgeBaseTool && {
          toolChoice: { type: 'tool' as const, toolName: 'searchKnowledgeBase' as const },
        }),
        stopWhen: loopSettings.stopWhen,
        temperature: 0.4,
        maxOutputTokens: loopSettings.maxOutputTokens,
        requiredCapabilities: getForcedRoutingCapabilityRequirements(suggestedAgentName),
      },
      providerOrder,
      { timeoutMs: 60000 }
    );

    if (!retryResult.success || !retryResult.result) {
      logger.warn(`⚠️ [Forced Routing] All providers failed for ${suggestedAgentName}`);
      for (const attempt of retryResult.attempts) {
        logger.warn(`  - ${attempt.provider}: ${attempt.error || 'unknown error'}`);
      }
      return null;
    }

    const { result, provider, modelId, usedFallback, attempts } = retryResult;
    const durationMs = Date.now() - startTime;
    const providerAttempts = toProviderAttemptTelemetry(attempts);
    const fallbackReason = resolveFallbackReason(attempts, usedFallback);

    const {
      toolsCalled,
      collectedToolResults,
      finalAnswerResult,
      ragSources,
      evidenceCards,
      retrievalMetadata,
      knowledgeRetrievalAttempted,
    } = collectForcedRoutingToolObservations(result.steps, evidenceBudget);

    let response = finalAnswerResult?.answer ?? result.text;
    const deterministicSummary = buildDeterministicSummaryFallback(
      query,
      suggestedAgentName,
      collectedToolResults,
      await getSnapshotData()
    );

    if (deterministicSummary) {
      const overridingGeneratedText =
        typeof response === 'string' && response.trim().length > 0;
      response = deterministicSummary;
      logger.info(
        `[Forced Routing] Deterministic summary ${overridingGeneratedText ? 'override' : 'fallback'} succeeded (${response.length} chars)`
      );
    } else {
      const stateSummary = buildDeterministicSummaryFromCurrentState(
        query,
        suggestedAgentName,
        await getSnapshotData()
      );
      if (stateSummary) {
        response = stateSummary;
        logger.info(
          `[Forced Routing] Deterministic current-state summary override succeeded (${response.length} chars)`
        );
      }
    }

    response = await summarizeToolResultsIfEmpty({
      query,
      suggestedAgentName,
      response,
      toolsCalled,
      resultSteps: result.steps,
    });

    const sanitizedResponse = sanitizeChineseCharacters(response);
    const quality = evaluateAgentResponseQuality(
      suggestedAgentName,
      sanitizedResponse,
      { durationMs }
    );
    const enrichment = enrichResponseWithToolResults(
      sanitizedResponse,
      quality.qualityFlags,
      collectedToolResults
    );
    const finalResponse = enrichment.enrichedResponse;
    const finalQuality = enrichment.enrichmentApplied
      ? evaluateAgentResponseQuality(suggestedAgentName, finalResponse, {
          durationMs,
        })
      : quality;
    const resolvedEvidenceCards =
      evidenceCards.length > 0
        ? evidenceCards
        : [];
    const resolvedRetrievalMetadata = knowledgeRetrievalAttempted
      ? createRetrievalMetadata({
          retrievalEnabled: true,
          retrievalUsed: resolvedEvidenceCards.length > 0,
          retrievalMode: retrievalMetadata?.retrievalMode ?? 'lite',
          evidenceCount: resolvedEvidenceCards.length,
          webUsed:
            retrievalMetadata?.webUsed ??
            ragSources.some((item) => item.sourceType === 'web'),
          suppressedReason:
            resolvedEvidenceCards.length > 0
              ? undefined
              : retrievalMetadata?.suppressedReason ?? 'no_results',
        })
      : undefined;

    if (usedFallback) {
      logger.info(`[Forced Routing] Used fallback: ${attempts.map(a => a.provider).join(' → ')}`);
    }

    logger.info(
      `[Forced Routing] ${suggestedAgentName} completed in ${durationMs}ms via ${provider}, tools: [${toolsCalled.join(', ')}]${enrichment.enrichmentApplied ? `, enriched: [${enrichment.enrichmentSections.join(', ')}]` : ''}, ragSources: ${ragSources.length}`
    );

    return {
      success: true,
      response: finalResponse,
      ragSources: ragSources.length > 0 ? ragSources : undefined,
      evidenceCards:
        resolvedEvidenceCards.length > 0 ? resolvedEvidenceCards : undefined,
      handoffs: [{
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason: usedFallback
          ? `Forced routing with fallback (${attempts.length} attempts)`
          : 'Forced routing (high confidence pre-filter)',
      }],
      finalAgent: suggestedAgentName,
      toolsCalled,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      metadata: {
        provider,
        modelId,
        totalRounds: attempts.length,
        handoffCount: 1,
        durationMs,
        responseChars: finalQuality.responseChars,
        formatCompliance: finalQuality.formatCompliance,
        qualityFlags: finalQuality.qualityFlags,
        latencyTier: finalQuality.latencyTier,
        agentLoop: toAgentLoopTelemetry(
          loopSettings,
          result.steps.length
        ),
        providerAttempts,
        usedFallback,
        ...(fallbackReason ? { fallbackReason } : {}),
        ...(resolvedRetrievalMetadata && {
          retrieval: resolvedRetrievalMetadata,
        }),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [Forced Routing] ${suggestedAgentName} failed:`, errorMessage);
    return null;
  }
}
