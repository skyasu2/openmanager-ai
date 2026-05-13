/**
 * Orchestrator Routing Logic
 *
 * Model selection, Reporter Pipeline, and Agent config/forced routing.
 *
 * @version 4.0.0
 */

import { generateText, hasToolCall, stepCountIs } from 'ai';
import { generateTextWithRetry } from '../../resilience/retry-with-fallback';
import type { DomainDataSource } from '../../../core/assistant-runtime';
import { isMetricsQueryRuntimeName } from '../../../core/assistant-runtime/agent-name-compat';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import {
  AGENT_NAMES,
  MISTRAL_FIRST_PROVIDER_ORDER,
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

import type { MultiAgentResponse } from './orchestrator-types';
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
import { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';
import { evaluateAgentResponseQuality } from './response-quality';
import { FORCE_KB_QUERY_PATTERN } from '../routing/query-routing-signals';
import type { ModelCapabilityRequirements } from '../provider-capabilities';
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
import { buildKnowledgeBaseGroundedAnswer } from '../supervisor-stream-citations';
import type { InternalDisclosureMode } from '../internal-disclosure-policy';
import {
  createAgentDataSourceContext,
  resolveDomainSnapshot,
} from './domain-data-source';
import {
  asDirectKnowledgeSearchResult,
  asEvidenceCard,
  asRetrievalMetadata,
  buildGroundedNoEvidenceResponse,
  buildTopologyDirectKnowledgeResponse,
  resolveDirectKnowledgeEvidenceCards,
  shouldUseGroundedKnowledgeAnswer,
} from './orchestrator-routing-direct-knowledge';
import {
  buildStructuredTopologyBoundaryResponse,
  isStructuredTopologyBoundaryQuery,
} from './orchestrator-routing-topology';
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

const SUMMARIZATION_FALLBACK_TIMEOUT_MS = 10_000;
const SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS = 768;
const SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS = 1_000;

function buildContextAwarePrompt(query: string, contextSummary?: string | null): string {
  if (!contextSummary) {
    return query;
  }

  return `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}`;
}

function getAgentInstructions(config: AgentConfig, query: string): string {
  return config.getInstructions?.(query) ?? config.instructions;
}

function getForcedRoutingCapabilityRequirements(
  agentName: string
): ModelCapabilityRequirements {
  if (isMetricsQueryRuntimeName(agentName)) {
    return { requireToolCalling: true, minContextTokens: 16_000 };
  }

  if (
    agentName === 'Analyst Agent' ||
    agentName === 'Reporter Agent' ||
    agentName === 'Advisor Agent'
  ) {
    return { requireToolCalling: true, minContextTokens: 32_000 };
  }

  return { requireToolCalling: true };
}

export function getOrchestratorModel(): ModelResult | null {
  // Orchestrator uses Output.object structured generation (requires json_schema support).
  // Keep Groq first for routing-only structured output to preserve Cerebras RPM
  // for specialist agents; Cerebras remains fallback and Mistral stays last
  // because its free RPM is tight.
  return selectTextModel('Orchestrator', ORCHESTRATOR_PROVIDER_ORDER, {
    cbPrefix: 'orchestrator',
    requiredCapabilities: { requireStructuredOutput: true },
  });
}

// Log available agents from AGENT_CONFIGS
const availableAgentNames = AGENT_NAMES.filter(name => {
  const config = getNamedAgentConfig(name);
  return config && config.getModel() !== null;
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

  if (
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    isStructuredTopologyBoundaryQuery(query)
  ) {
    const structuredTopologyResponse = buildStructuredTopologyBoundaryResponse(
      query,
      startTime,
      suggestedAgentName,
      ragEnabled,
      await getSnapshotData()
    );
    if (structuredTopologyResponse) {
      logger.info(
        '[Forced Routing] Structured topology boundary path succeeded without RAG document lookup'
      );
      return structuredTopologyResponse;
    }
  }

  // Topology/architecture queries can bypass LLM generation by using
  // direct KB retrieval + deterministic synthesis.
  if (forceKnowledgeBaseTool) {
    const directSearchTool = (filteredTools as Record<string, unknown>)
      .searchKnowledgeBase as { execute?: (input: Record<string, unknown>) => Promise<unknown> };

    if (typeof directSearchTool?.execute === 'function') {
      try {
        const directSearchResult = await directSearchTool.execute({
          query,
          category: 'architecture',
          fastMode: true,
          includeWebSearch: false,
        });
        const parsedDirectResult = asDirectKnowledgeSearchResult(directSearchResult);

        if (parsedDirectResult && parsedDirectResult.results.length > 0) {
          const directEvidence = parsedDirectResult.results.slice(
            0,
            evidenceBudget
          );
          const directEvidenceCards = resolveDirectKnowledgeEvidenceCards({
            parsedDirectResult,
            directEvidence,
            evidenceBudget,
          });
          const directRetrieval = createRetrievalMetadata({
            retrievalEnabled: true,
            retrievalUsed: directEvidenceCards.length > 0,
            retrievalMode: parsedDirectResult.retrieval?.retrievalMode ?? 'lite',
            evidenceCount: directEvidenceCards.length,
            webUsed: directEvidence.some((item) => item.sourceType === 'web'),
            suppressedReason:
              directEvidenceCards.length > 0
                ? undefined
                : parsedDirectResult.retrieval?.suppressedReason ?? 'no_results',
          });
          const durationMs = Date.now() - startTime;
          const directToolResult = {
            toolName: 'searchKnowledgeBase',
            result: directSearchResult,
          };
          const response = sanitizeChineseCharacters(
            shouldUseGroundedKnowledgeAnswer(query)
              ? buildKnowledgeBaseGroundedAnswer(query, [directToolResult], {
                  internalDisclosureMode,
                }) ??
                  buildTopologyDirectKnowledgeResponse(query, directEvidence)
              : buildTopologyDirectKnowledgeResponse(query, directEvidence)
          );
          const quality = evaluateAgentResponseQuality('Advisor Agent', response, { durationMs });

          logger.info(
            `[Forced Routing] Topology direct KB path succeeded in ${durationMs}ms (${directEvidence.length} docs)`
          );

          return {
            success: true,
            response,
            ragSources: directEvidence.map((item) => ({
              title: item.title,
              similarity: item.similarity,
              sourceType: item.sourceType,
              category: item.category,
              url: item.url,
            })),
            evidenceCards: directEvidenceCards,
            handoffs: [{
              from: 'Orchestrator',
              to: suggestedAgentName,
              reason: 'Forced routing (topology direct KB path)',
            }],
            finalAgent: suggestedAgentName,
            toolsCalled: ['searchKnowledgeBase', 'finalAnswer'],
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            metadata: {
              provider: 'deterministic',
              modelId: 'knowledge-search-direct',
              totalRounds: 1,
              handoffCount: 1,
              durationMs,
              responseChars: quality.responseChars,
              formatCompliance: quality.formatCompliance,
              qualityFlags: quality.qualityFlags,
              latencyTier: quality.latencyTier,
              retrieval: directRetrieval,
            },
          };
        }

        if (
          parsedDirectResult &&
          parsedDirectResult.results.length === 0 &&
          shouldUseGroundedKnowledgeAnswer(query)
        ) {
          const durationMs = Date.now() - startTime;
          const response = sanitizeChineseCharacters(
            buildGroundedNoEvidenceResponse({
              query,
              directSearchResult,
              internalDisclosureMode,
            })
          );
          const directRetrieval = createRetrievalMetadata({
            retrievalEnabled: true,
            retrievalUsed: false,
            retrievalMode:
              parsedDirectResult.retrieval?.retrievalMode ?? 'lite',
            evidenceCount: 0,
            webUsed: false,
            suppressedReason:
              parsedDirectResult.retrieval?.suppressedReason ?? 'no_results',
          });
          const quality = evaluateAgentResponseQuality('Advisor Agent', response, { durationMs });

          logger.info(
            `[Forced Routing] Direct KB path returned no evidence in ${durationMs}ms; suppressed path inference`
          );

          return {
            success: true,
            response,
            handoffs: [{
              from: 'Orchestrator',
              to: suggestedAgentName,
              reason: 'Forced routing (knowledge direct no-evidence path)',
            }],
            finalAgent: suggestedAgentName,
            toolsCalled: ['searchKnowledgeBase'],
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            metadata: {
              provider: 'deterministic',
              modelId: 'knowledge-search-direct',
              totalRounds: 1,
              handoffCount: 1,
              durationMs,
              responseChars: quality.responseChars,
              formatCompliance: quality.formatCompliance,
              qualityFlags: quality.qualityFlags,
              latencyTier: quality.latencyTier,
              retrieval: directRetrieval,
            },
          };
        }
      } catch (error) {
        logger.warn(
          '[Forced Routing] Topology direct KB path failed, falling back to LLM routing:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
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

  // Per-agent maxSteps: Analyst/Reporter need more steps for multi-tool workflows
  const agentMaxSteps = getAgentMaxSteps(suggestedAgentName);

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
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(agentMaxSteps)],
        temperature: 0.4,
        maxOutputTokens: 2048,
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
            if (Array.isArray(similarCases)) {
              for (const doc of similarCases) {
                pushRagSource({
                  title: String(doc.title ?? doc.name ?? 'Unknown'),
                  similarity: Number(doc.similarity ?? doc.score ?? 0),
                  sourceType: String(doc.sourceType ?? doc.type ?? 'knowledge'),
                  category: doc.category ? String(doc.category) : undefined,
                });
              }
            }
          }

          if (tr.toolName === 'searchWeb' && trOutput && typeof trOutput === 'object') {
            const webResult = trOutput as Record<string, unknown>;
            const webResults = webResult.results as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(webResults)) {
              for (const doc of webResults) {
                pushRagSource({
                  title: String(doc.title ?? 'Web Result'),
                  similarity: Number(doc.score ?? 0),
                  sourceType: 'web',
                  category: 'web-search',
                  url: doc.url ? String(doc.url) : undefined,
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

    // Summarization Fallback: if model called tools but produced no text,
    // re-run generateText without tools to summarize tool results.
    if ((!response || response.trim().length === 0) && toolsCalled.length > 0) {
      logger.warn(
        `[Forced Routing] ${suggestedAgentName}: Empty response with ${toolsCalled.length} tool calls — summarization fallback`
      );

      try {
        const uniqueResults = new Map<string, unknown>();
        for (const step of result.steps) {
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const trOutput = extractToolResultOutput(tr);
              if (!uniqueResults.has(tr.toolName)) {
                uniqueResults.set(tr.toolName, trOutput);
              }
            }
          }
        }

        const toolResultsSummary = Array.from(uniqueResults.entries())
          .map(
            ([name, r]) =>
              `[${name}]: ${JSON.stringify(r).slice(0, SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS)}`
          )
          .join('\n\n');

        const summaryResult = await generateTextWithRetry(
          {
            messages: [
              {
                role: 'system',
                content: '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
              },
              {
                role: 'user',
                content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
              },
            ],
            temperature: 0.4,
            maxOutputTokens: SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS,
          },
          [...MISTRAL_FIRST_PROVIDER_ORDER],
          { timeoutMs: SUMMARIZATION_FALLBACK_TIMEOUT_MS }
        );

        if (summaryResult.success && summaryResult.result?.text) {
          response = summaryResult.result.text;
          logger.info(`[Forced Routing] Summarization fallback succeeded (${response.length} chars)`);
        }
      } catch (summaryError) {
        logger.warn(
          `[Forced Routing] Summarization fallback failed:`,
          summaryError instanceof Error ? summaryError.message : String(summaryError)
        );
      }
    }

    const sanitizedResponse = sanitizeChineseCharacters(response);
    const quality = evaluateAgentResponseQuality(
      suggestedAgentName,
      sanitizedResponse,
      { durationMs }
    );
    const resolvedEvidenceCards =
      evidenceCards.length > 0
        ? evidenceCards
        : knowledgeRetrievalAttempted && ragSources.length > 0
          ? legacyRagSourcesToEvidenceCards(ragSources.slice(0, evidenceBudget))
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
