import {
  extractRagSources,
  extractToolResultOutput,
  type RagSource,
} from '../../lib/ai-sdk-utils';
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
}): Generator<StreamEvent, RagSource[]> {
  const ragSources: RagSource[] = [];

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
    }
  }

  for (const toolResult of collectedToolResults) {
    ragSources.push(...extractRagSources(toolResult.toolName, toolResult.result));
  }

  return ragSources;
}
