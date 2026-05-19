import {
  extractEvidenceCards,
  extractRagSources,
  extractRetrievalMetadata,
  extractToolResultOutput,
  mergeRetrievalMetadata,
  type RagSource,
} from '../../../lib/ai-sdk-utils';
import type {
  EvidenceCard,
  RetrievalMetadata,
} from '../../../lib/retrieval-contract';

export interface ForcedRoutingToolStep {
  toolCalls?: Array<{ toolName: string }>;
  toolResults?: Array<{
    toolName: string;
    result?: unknown;
    output?: unknown;
  }>;
}

export interface ForcedRoutingToolObservation {
  toolsCalled: string[];
  collectedToolResults: Array<{ toolName: string; result: unknown }>;
  finalAnswerResult: { answer: string } | null;
  ragSources: RagSource[];
  evidenceCards: EvidenceCard[];
  retrievalMetadata: RetrievalMetadata | undefined;
  knowledgeRetrievalAttempted: boolean;
}

export function collectForcedRoutingToolObservations(
  steps: readonly ForcedRoutingToolStep[],
  evidenceBudget: number
): ForcedRoutingToolObservation {
  const toolsCalled: string[] = [];
  const collectedToolResults: Array<{ toolName: string; result: unknown }> = [];
  let finalAnswerResult: { answer: string } | null = null;
  const ragSources: RagSource[] = [];
  const evidenceCards: EvidenceCard[] = [];
  let retrievalMetadata: RetrievalMetadata | undefined;
  let knowledgeRetrievalAttempted = false;

  const pushRagSources = (sources: readonly RagSource[]) => {
    for (const source of sources) {
      if (ragSources.length >= evidenceBudget) break;
      ragSources.push(source);
    }
  };
  const pushEvidenceCards = (cards: readonly EvidenceCard[]) => {
    for (const card of cards) {
      if (evidenceCards.length >= evidenceBudget) break;
      evidenceCards.push(card);
    }
  };

  for (const step of steps) {
    for (const toolCall of step.toolCalls ?? []) {
      toolsCalled.push(toolCall.toolName);
    }
    for (const toolResult of step.toolResults ?? []) {
      const toolOutput = extractToolResultOutput(toolResult);
      collectedToolResults.push({
        toolName: toolResult.toolName,
        result: toolOutput,
      });

      if (
        toolResult.toolName === 'finalAnswer' &&
        toolOutput &&
        typeof toolOutput === 'object'
      ) {
        finalAnswerResult = toolOutput as { answer: string };
      }

      if (toolResult.toolName === 'searchKnowledgeBase') {
        knowledgeRetrievalAttempted = true;
        retrievalMetadata = mergeRetrievalMetadata(
          retrievalMetadata,
          extractRetrievalMetadata(toolResult.toolName, toolOutput)
        );
      }

      pushRagSources(extractRagSources(toolResult.toolName, toolOutput));
      pushEvidenceCards(
        extractEvidenceCards(toolResult.toolName, toolOutput)
      );
    }
  }

  return {
    toolsCalled,
    collectedToolResults,
    finalAnswerResult,
    ragSources,
    evidenceCards,
    retrievalMetadata,
    knowledgeRetrievalAttempted,
  };
}
