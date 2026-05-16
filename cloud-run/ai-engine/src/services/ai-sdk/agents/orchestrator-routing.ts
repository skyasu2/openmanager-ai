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
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import {
  AGENT_NAMES,
  getAgentEvidenceBudget,
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
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
import { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';
import { evaluateAgentResponseQuality } from './response-quality';
import { FORCE_KB_QUERY_PATTERN } from '../routing/query-routing-signals';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
} from './orchestrator-summary-fallback';
import { logger } from '../../../lib/logger';
import {
  createRetrievalMetadata,
  legacyRagSourcesToEvidenceCards,
  type EvidenceCard,
  type RetrievalMetadata,
} from '../../../lib/retrieval-contract';
import type { InternalDisclosureMode } from '../internal-disclosure-policy';
import {
  createAgentDataSourceContext,
  resolveDomainSnapshot,
} from './domain-data-source';
import {
  asEvidenceCard,
  asRetrievalMetadata,
} from './orchestrator-routing-direct-knowledge';
import { executeForcedKnowledgePath } from './orchestrator-forced-knowledge-path';
import {
  buildContextAwarePrompt,
  getAgentInstructions,
  getForcedRoutingCapabilityRequirements,
} from './orchestrator-prompt-helpers';
import { summarizeToolResultsIfEmpty } from './orchestrator-summarization-fallback';
import {
  resolveFallbackReason,
  toProviderAttemptTelemetry,
} from './orchestrator-routing-telemetry';
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

  const agentConfig = getNamedAgentConfig(suggestedAgentName);

  if (!agentConfig) {
    logger.warn(`⚠️ [Forced Routing] No config for "${suggestedAgentName}"`);
    return null;
  }

  const providerOrder = getAgentProviderOrder(suggestedAgentName);
  const evidenceBudget = getAgentEvidenceBudget(suggestedAgentName);
  logger.info(`[Forced Routing] Using retry with fallback: [${providerOrder.join(' → ')}]`);

  let filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);
  const isForceKnowledgeBaseQuery = FORCE_KB_QUERY_PATTERN.test(query);
  const forceKnowledgeBaseTool =
    ragEnabled &&
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    'searchKnowledgeBase' in filteredTools;

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

    const toolsCalled: string[] = [];
    const collectedToolResults: Array<{ toolName: string; result: unknown }> = [];
    let finalAnswerResult: { answer: string } | null = null;
    const ragSources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }> = [];
    const evidenceCards: EvidenceCard[] = [];
    let retrievalMetadata: RetrievalMetadata | undefined;
    let knowledgeRetrievalAttempted = false;
    const pushRagSource = (source: (typeof ragSources)[number]) => {
      if (ragSources.length < evidenceBudget) {
        ragSources.push(source);
      }
    };
    const pushEvidenceCard = (card: EvidenceCard) => {
      if (evidenceCards.length < evidenceBudget) {
        evidenceCards.push(card);
      }
    };

    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        toolsCalled.push(toolCall.toolName);
      }
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const trOutput = extractToolResultOutput(tr);
          collectedToolResults.push({
            toolName: tr.toolName,
            result: trOutput,
          });

          if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
            finalAnswerResult = trOutput as { answer: string };
          }

          if (tr.toolName === 'searchKnowledgeBase' && trOutput && typeof trOutput === 'object') {
            knowledgeRetrievalAttempted = true;
            const kbResult = trOutput as Record<string, unknown>;
            if (Array.isArray(kbResult.evidenceCards)) {
              for (const card of kbResult.evidenceCards) {
                const parsedCard = asEvidenceCard(card);
                if (parsedCard) {
                  pushEvidenceCard(parsedCard);
                }
              }
            }
            retrievalMetadata = asRetrievalMetadata(kbResult.retrieval) ?? retrievalMetadata;
            const similarCases = (kbResult.similarCases ?? kbResult.results) as Array<Record<string, unknown>> | undefined;
            if (evidenceCards.length === 0 && Array.isArray(similarCases)) {
              const legacyEvidenceCards = legacyRagSourcesToEvidenceCards(
                similarCases.map((doc) => ({
                  title: String(doc.title ?? doc.name ?? 'Unknown'),
                  similarity: Number(doc.similarity ?? doc.score ?? 0),
                  sourceType: String(doc.sourceType ?? doc.type ?? 'knowledge'),
                  category: doc.category ? String(doc.category) : undefined,
                  url: doc.url ? String(doc.url) : undefined,
                }))
              );
              for (const card of legacyEvidenceCards) {
                pushEvidenceCard(card);
              }
            }
          }

          if (tr.toolName === 'searchWeb' && trOutput && typeof trOutput === 'object') {
            const webResult = trOutput as Record<string, unknown>;
            const webResults = webResult.results as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(webResults)) {
              for (const doc of webResults) {
                const title = String(doc.title ?? 'Web Result');
                const score = Number(doc.score ?? 0);
                const url = doc.url ? String(doc.url) : undefined;
                pushRagSource({
                  title,
                  similarity: score,
                  sourceType: 'web',
                  category: 'web-search',
                  url,
                });
                pushEvidenceCard({
                  id: `web-${evidenceCards.length}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'source'}`,
                  title,
                  summary: title,
                  sourceType: 'web',
                  score: Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0,
                  category: 'web-search',
                  ...(url && { url }),
                });
              }
            }
          }
        }
      }
    }

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
      `[Forced Routing] ${suggestedAgentName} completed in ${durationMs}ms via ${provider}, tools: [${toolsCalled.join(', ')}], ragSources: ${ragSources.length}`
    );

    return {
      success: true,
      response: sanitizedResponse,
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
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
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
