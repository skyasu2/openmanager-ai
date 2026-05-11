import type { ToolSet } from 'ai';
import { extractToolResultOutput } from '../../lib/ai-sdk-utils';
import { logger } from '../../lib/logger';
import type { ProviderName } from './model-provider';
import {
  estimateSerializedQuotaTokens,
  markStreamProviderCooldown,
  reconcileStreamQuota,
  reserveStreamQuota,
  type ProviderQuotaReservation,
} from './stream-quota';
import type { AgentStepStatus, StreamEvent } from './supervisor-types';

const SUPERVISOR_STREAM_MAX_OUTPUT_TOKENS = 2048;

type TextDeltaStreamPart = {
  type: 'text-delta';
  text: string;
};

type SupervisorFullStreamPart = {
  type: string;
  text?: unknown;
  toolName?: unknown;
  toolCallId?: unknown;
  error?: unknown;
};

export type CollectedToolResult = {
  toolName: string;
  result: unknown;
};

type SearchWebFallbackInput = {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
};

type ToolCallLike = {
  toolName?: unknown;
  input?: unknown;
  args?: unknown;
};

type StepLike = {
  toolCalls?: ToolCallLike[];
};

export async function* textStreamAsFullStream(
  textStream: AsyncIterable<string>
): AsyncGenerator<TextDeltaStreamPart> {
  for await (const text of textStream) {
    yield { type: 'text-delta', text };
  }
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .map((item) => readNonEmptyString(item))
    .filter((item): item is string => item !== null);
  return values.length > 0 ? values : undefined;
}

function readSearchDepth(value: unknown): 'basic' | 'advanced' | undefined {
  return value === 'basic' || value === 'advanced' ? value : undefined;
}

function readSearchWebInput(value: unknown): SearchWebFallbackInput | null {
  const input = readRecord(value);
  if (!input) return null;

  const query = readNonEmptyString(input.query);
  if (!query) return null;

  return {
    query,
    maxResults: readNumber(input.maxResults),
    searchDepth: readSearchDepth(input.searchDepth),
    includeDomains: readStringArray(input.includeDomains),
    excludeDomains: readStringArray(input.excludeDomains),
  };
}

function findSearchWebInputFromSteps(
  steps: StepLike[]
): SearchWebFallbackInput | null {
  for (const step of steps) {
    for (const toolCall of step.toolCalls ?? []) {
      if (toolCall.toolName !== 'searchWeb') continue;
      const input =
        readSearchWebInput(toolCall.input) ?? readSearchWebInput(toolCall.args);
      if (input) return input;
    }
  }

  return null;
}

function hasSearchWebCall(steps: StepLike[]): boolean {
  return steps.some((step) =>
    (step.toolCalls ?? []).some((toolCall) => toolCall.toolName === 'searchWeb')
  );
}

export async function executeSearchWebFallbackFromSteps(
  steps: StepLike[],
  userQuery: string,
  tools: ToolSet
): Promise<CollectedToolResult | null> {
  if (!hasSearchWebCall(steps)) return null;

  const input = findSearchWebInputFromSteps(steps) ?? {
    query: userQuery,
  };
  const query = readNonEmptyString(userQuery) ?? input.query;
  if (!query) return null;

  const fallbackInput: SearchWebFallbackInput = {
    ...input,
    query,
    maxResults: Math.max(input.maxResults ?? 0, 5),
  };

  const searchWebTool = readRecord(tools)?.searchWeb;
  const execute = readRecord(searchWebTool)?.execute;
  if (typeof execute !== 'function') return null;

  try {
    const result = await execute(fallbackInput);
    return { toolName: 'searchWeb', result };
  } catch (error) {
    logger.warn(
      '[SupervisorStream] searchWeb fallback execution failed:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export function readToolStep(
  streamPart: SupervisorFullStreamPart
): { key: string; tool: string } | null {
  const tool = readNonEmptyString(streamPart.toolName);
  if (!tool) return null;

  const toolCallId = readNonEmptyString(streamPart.toolCallId);
  return {
    key: toolCallId ? `${toolCallId}:${tool}` : tool,
    tool,
  };
}

export function buildAgentStepEvent(
  tool: string,
  status: AgentStepStatus
): StreamEvent {
  return {
    type: 'agent_step',
    data: { tool, status },
  };
}

export function estimateSupervisorStreamQuotaTokens(
  messages: unknown[],
  maxOutputTokens = SUPERVISOR_STREAM_MAX_OUTPUT_TOKENS
): number {
  return estimateSerializedQuotaTokens(messages, maxOutputTokens);
}

export async function reserveSupervisorStreamQuota(
  provider: ProviderName,
  modelId: string,
  estimatedTokens: number
): Promise<ProviderQuotaReservation | null> {
  return reserveStreamQuota(provider, modelId, estimatedTokens);
}

export async function reconcileSupervisorStreamQuota(
  reservation: ProviderQuotaReservation | null,
  actualTokensUsed: number
): Promise<void> {
  await reconcileStreamQuota(reservation, actualTokensUsed);
}

export async function markSupervisorStreamCooldown(
  provider: ProviderName,
  modelId: string,
  errorMessage: string
): Promise<void> {
  await markStreamProviderCooldown(provider, modelId, errorMessage);
}
