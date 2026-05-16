import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import {
  createRetrievalMetadata,
  type EvidenceCard,
} from '../../../lib/retrieval-contract';
import { logger } from '../../../lib/logger';
import { buildKnowledgeBaseGroundedAnswer } from '../supervisor-stream-citations';
import type { InternalDisclosureMode } from '../internal-disclosure-policy';
import type { MultiAgentResponse } from './orchestrator-types';
import { evaluateAgentResponseQuality } from './response-quality';
import {
  asDirectKnowledgeSearchResult,
  buildGroundedNoEvidenceResponse,
  buildTopologyDirectKnowledgeResponse,
  resolveDirectKnowledgeEvidenceCards,
  shouldUseGroundedKnowledgeAnswer,
} from './orchestrator-routing-direct-knowledge';
import {
  buildStructuredTopologyBoundaryResponse,
  isStructuredTopologyBoundaryQuery,
} from './orchestrator-routing-topology';

export async function executeForcedKnowledgePath(params: {
  query: string;
  startTime: number;
  suggestedAgentName: string;
  ragEnabled: boolean;
  isForceKnowledgeBaseQuery: boolean;
  forceKnowledgeBaseTool: boolean;
  filteredTools: Record<string, unknown>;
  evidenceBudget: number;
  getSnapshotData: () => Promise<unknown | undefined>;
  internalDisclosureMode?: InternalDisclosureMode;
}): Promise<MultiAgentResponse | null> {
  const {
    query,
    startTime,
    suggestedAgentName,
    ragEnabled,
    isForceKnowledgeBaseQuery,
    forceKnowledgeBaseTool,
    filteredTools,
    evidenceBudget,
    getSnapshotData,
    internalDisclosureMode,
  } = params;

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

  if (!forceKnowledgeBaseTool) {
    return null;
  }

  const directSearchTool = filteredTools.searchKnowledgeBase as
    | { execute?: (input: Record<string, unknown>) => Promise<unknown> }
    | undefined;

  if (typeof directSearchTool?.execute !== 'function') {
    return null;
  }

  try {
    const directSearchResult = await directSearchTool.execute({
      query,
      category: 'architecture',
      fastMode: true,
      includeWebSearch: false,
    });
    const parsedDirectResult =
      asDirectKnowledgeSearchResult(directSearchResult);

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
            : (parsedDirectResult.retrieval?.suppressedReason ?? 'no_results'),
      });
      const durationMs = Date.now() - startTime;
      const directToolResult = {
        toolName: 'searchKnowledgeBase',
        result: directSearchResult,
      };
      const response = sanitizeChineseCharacters(
        shouldUseGroundedKnowledgeAnswer(query)
          ? (buildKnowledgeBaseGroundedAnswer(query, [directToolResult], {
              internalDisclosureMode,
            }) ?? buildTopologyDirectKnowledgeResponse(query, directEvidence))
          : buildTopologyDirectKnowledgeResponse(query, directEvidence)
      );
      const quality = evaluateAgentResponseQuality('Advisor Agent', response, {
        durationMs,
      });

      logger.info(
        `[Forced Routing] Topology direct KB path succeeded in ${durationMs}ms (${directEvidence.length} docs)`
      );

      return buildDirectKnowledgeResponse({
        response,
        evidenceCards: directEvidenceCards,
        retrieval: directRetrieval,
        durationMs,
        quality,
        suggestedAgentName,
        reason: 'Forced routing (topology direct KB path)',
        toolsCalled: ['searchKnowledgeBase', 'finalAnswer'],
      });
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
        retrievalMode: parsedDirectResult.retrieval?.retrievalMode ?? 'lite',
        evidenceCount: 0,
        webUsed: false,
        suppressedReason:
          parsedDirectResult.retrieval?.suppressedReason ?? 'no_results',
      });
      const quality = evaluateAgentResponseQuality('Advisor Agent', response, {
        durationMs,
      });

      logger.info(
        `[Forced Routing] Direct KB path returned no evidence in ${durationMs}ms; suppressed path inference`
      );

      return buildDirectKnowledgeResponse({
        response,
        retrieval: directRetrieval,
        durationMs,
        quality,
        suggestedAgentName,
        reason: 'Forced routing (knowledge direct no-evidence path)',
        toolsCalled: ['searchKnowledgeBase'],
      });
    }
  } catch (error) {
    logger.warn(
      '[Forced Routing] Topology direct KB path failed, falling back to agent routing:',
      error instanceof Error ? error.message : String(error)
    );
  }

  return null;
}

function buildDirectKnowledgeResponse(params: {
  response: string;
  evidenceCards?: EvidenceCard[];
  retrieval: ReturnType<typeof createRetrievalMetadata>;
  durationMs: number;
  quality: ReturnType<typeof evaluateAgentResponseQuality>;
  suggestedAgentName: string;
  reason: string;
  toolsCalled: string[];
}): MultiAgentResponse {
  const {
    response,
    evidenceCards,
    retrieval,
    durationMs,
    quality,
    suggestedAgentName,
    reason,
    toolsCalled,
  } = params;

  return {
    success: true,
    response,
    ...(evidenceCards && { evidenceCards }),
    handoffs: [
      {
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason,
      },
    ],
    finalAgent: suggestedAgentName,
    toolsCalled,
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
      retrieval,
    },
  };
}
