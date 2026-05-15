import {
  extractEvidenceCards,
  extractRagSources,
  extractRetrievalMetadata,
  extractToolResultOutput,
  mergeRetrievalMetadata,
  type RagSource,
} from '../../lib/ai-sdk-utils';
import type {
  EvidenceCard,
  RetrievalMetadata,
} from '../../lib/retrieval-contract';
import type { LangfuseTrace } from '../observability/langfuse-contracts';
import { logToolCall } from '../observability/langfuse';
import type { CollectedToolResult } from './supervisor-stream-helpers';
import type { StreamEvent } from './supervisor-types';

type StreamStepToolCall = {
  toolName: string;
};

type StreamStepToolResult = {
  toolName: string;
};

type StreamStep = {
  toolCalls?: StreamStepToolCall[];
  toolResults?: StreamStepToolResult[];
};

export interface StreamToolEvidence {
  ragSources: RagSource[];
  evidenceCards: EvidenceCard[];
  retrieval?: RetrievalMetadata;
}

export function* replaySupervisorStreamToolEvents({
  steps,
  collectedToolResults,
  trace,
  recordToolCalled,
}: {
  steps: StreamStep[];
  collectedToolResults: CollectedToolResult[];
  trace: LangfuseTrace;
  recordToolCalled: (toolName: string) => void;
}): Generator<StreamEvent, StreamToolEvidence> {
  const ragSources: RagSource[] = [];
  const evidenceCards: EvidenceCard[] = [];
  let retrieval: RetrievalMetadata | undefined;

  for (const step of steps) {
    for (const toolCall of step.toolCalls ?? []) {
      const toolName = toolCall.toolName;
      recordToolCalled(toolName);
      yield { type: 'tool_call', data: { name: toolName } };
    }

    for (const toolResult of step.toolResults ?? []) {
      const output = extractToolResultOutput(toolResult);
      if (output !== undefined) {
        yield {
          type: 'tool_result',
          data: { toolName: toolResult.toolName, result: output },
        };
        logToolCall(trace, toolResult.toolName, {}, output, 0);
      }

      ragSources.push(...extractRagSources(toolResult.toolName, output));
      evidenceCards.push(...extractEvidenceCards(toolResult.toolName, output));
      retrieval = mergeRetrievalMetadata(
        retrieval,
        extractRetrievalMetadata(toolResult.toolName, output)
      );
    }
  }

  for (const toolResult of collectedToolResults) {
    ragSources.push(...extractRagSources(toolResult.toolName, toolResult.result));
    evidenceCards.push(
      ...extractEvidenceCards(toolResult.toolName, toolResult.result)
    );
    retrieval = mergeRetrievalMetadata(
      retrieval,
      extractRetrievalMetadata(toolResult.toolName, toolResult.result)
    );
  }

  return {
    ragSources,
    evidenceCards,
    ...(retrieval && { retrieval }),
  };
}
