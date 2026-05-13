import type { UserContent } from 'ai';
import type { DomainDataSource } from '../../../core/assistant-runtime';
import { isMetricsQueryRuntimeName } from '../../../core/assistant-runtime/agent-name-compat';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { logger } from '../../../lib/logger';
import { getCircuitBreaker } from '../../resilience/circuit-breaker';
import type { StreamEvent } from '../supervisor';
import { estimateContentQuotaTokens } from '../stream-quota';
import {
  selectTextModel,
  type ModelResult,
  type TextProvider,
} from './config/agent-model-selectors';
import { saveAgentFindingsToContext } from './orchestrator-context';
import { streamTextInChunks } from './orchestrator-decomposition';
import { executeReporterWithPipeline } from './orchestrator-routing';
import type { ProviderAttemptTelemetry } from './orchestrator-types';
import { evaluateAgentResponseQuality } from './response-quality';

const TOOL_GROUNDED_REPAIR_MIN_CHARS = 120;
const TOOL_RESULT_SUMMARY_MAX_CHARS = 2000;

export interface CollectedToolResult {
  toolName: string;
  result: unknown;
}

type AgentStreamStep = {
  toolCalls?: Array<{ toolName: string }>;
  toolResults?: Array<{ toolName: string; [key: string]: unknown }>;
};

type StreamUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

const TEXT_PROVIDERS: TextProvider[] = ['cerebras', 'groq', 'mistral'];

export function buildAgentProviderAttempts({
  agentName,
  isVisionAgent,
  nativeModel,
  rawProviderOrder,
}: {
  agentName: string;
  isVisionAgent: boolean;
  nativeModel: ModelResult | null;
  rawProviderOrder: string[];
}): ModelResult[] {
  if (isVisionAgent) {
    if (nativeModel) return [nativeModel];
    logger.warn(`[Stream ${agentName}] Native vision model unavailable`);
    return [];
  }

  const providerAttempts: ModelResult[] = [];
  const providerOrder = rawProviderOrder.filter((provider): provider is TextProvider =>
    TEXT_PROVIDERS.includes(provider as TextProvider)
  );

  for (const attemptProvider of providerOrder) {
    const circuitBreaker = getCircuitBreaker(`orchestrator-${attemptProvider}`);
    if (!circuitBreaker.isAllowed()) {
      logger.warn(`🔌 [Stream ${agentName}] CB OPEN for ${attemptProvider}, trying next`);
      continue;
    }

    const modelResult = selectTextModel(agentName, [attemptProvider], {
      requiredCapabilities: { requireToolCalling: true },
    });
    if (!modelResult) {
      logger.debug(`[Stream ${agentName}] No model for ${attemptProvider}, trying next`);
      continue;
    }

    providerAttempts.push(modelResult);
  }

  return providerAttempts;
}

export function buildAgentProviderRetryStatus(
  agentName: string,
  message: string
): StreamEvent {
  return {
    type: 'agent_status',
    data: {
      agent: agentName,
      status: 'processing',
      message,
    },
  };
}

export async function* streamReporterPipelineIfAvailable({
  query,
  startTime,
  dataSource,
  domainId,
  sessionId,
  agentName,
}: {
  query: string;
  startTime: number;
  dataSource?: DomainDataSource;
  domainId?: string;
  sessionId: string;
  agentName: string;
}): AsyncGenerator<StreamEvent, boolean> {
  if (agentName !== 'Reporter Agent') return false;

  try {
    const pipelineResult = await executeReporterWithPipeline(
      query,
      startTime,
      dataSource,
      domainId
    );
    if (!pipelineResult) {
      logger.info(`[Stream Reporter] Pipeline failed, falling back to raw streamText`);
      return false;
    }

    const reporterTtfbMs = Date.now() - startTime;
    logger.info(`[Stream Reporter] Pipeline succeeded, streaming result`);
    yield* streamTextInChunks(pipelineResult.response);

    try {
      await saveAgentFindingsToContext(
        sessionId,
        agentName,
        pipelineResult.response
      );
    } catch {
      // Context saving is best-effort only.
    }

    const durationMs = Date.now() - startTime;
    yield {
      type: 'done',
      data: {
        success: true,
        finalAgent: agentName,
        toolsCalled: pipelineResult.toolsCalled,
        handoffs: pipelineResult.handoffs,
        usage: {
          promptTokens: pipelineResult.usage?.promptTokens ?? 0,
          completionTokens: pipelineResult.usage?.completionTokens ?? 0,
          totalTokens: pipelineResult.usage?.totalTokens ?? 0,
        },
        metadata: {
          ...pipelineResult.metadata,
          durationMs,
          ttfbMs: reporterTtfbMs,
        },
      },
    };
    return true;
  } catch (pipelineError) {
    logger.warn(
      `[Stream Reporter] Pipeline error, falling back:`,
      pipelineError instanceof Error
        ? pipelineError.message
        : String(pipelineError)
    );
    return false;
  }
}

export function* collectAgentToolEvents(
  steps: AgentStreamStep[] | undefined
): Generator<
  StreamEvent,
  {
    toolsCalled: string[];
    collectedToolResults: CollectedToolResult[];
    finalAnswerResult: { answer: string } | null;
  }
> {
  const toolsCalled: string[] = [];
  const collectedToolResults: CollectedToolResult[] = [];
  let finalAnswerResult: { answer: string } | null = null;

  for (const step of steps ?? []) {
    for (const toolCall of step.toolCalls ?? []) {
      toolsCalled.push(toolCall.toolName);
      yield { type: 'tool_call', data: { name: toolCall.toolName } };
    }

    for (const toolResult of step.toolResults ?? []) {
      const toolResultOutput = extractToolResultOutput(toolResult);
      collectedToolResults.push({
        toolName: toolResult.toolName,
        result: toolResultOutput,
      });

      if (toolResult.toolName !== 'finalAnswer') {
        yield {
          type: 'tool_result',
          data: {
            toolName: toolResult.toolName,
            result: toolResultOutput,
          },
        };
      }

      if (
        toolResult.toolName === 'finalAnswer' &&
        toolResultOutput &&
        typeof toolResultOutput === 'object'
      ) {
        finalAnswerResult = toolResultOutput as { answer: string };
      }
    }
  }

  return {
    toolsCalled,
    collectedToolResults,
    finalAnswerResult,
  };
}

export async function* emitAgentSuccessDoneEvent({
  agentName,
  sessionId,
  fullResponseText,
  durationMs,
  responseProvider,
  responseModelId,
  responseAttemptNumber,
  responseProviderStartTime,
  providerAttemptTelemetry,
  fallbackReason,
  currentProvider,
  responseUsage,
  firstChunkMs,
  toolsCalled,
}: {
  agentName: string;
  sessionId: string;
  fullResponseText: string;
  durationMs: number;
  responseProvider: string;
  responseModelId: string;
  responseAttemptNumber: number;
  responseProviderStartTime: number;
  providerAttemptTelemetry: ProviderAttemptTelemetry[];
  fallbackReason?: string;
  currentProvider: string;
  responseUsage?: StreamUsage;
  firstChunkMs: number | null;
  toolsCalled: string[];
}): AsyncGenerator<StreamEvent> {
  providerAttemptTelemetry.push({
    provider: responseProvider,
    modelId: responseModelId,
    attempt: responseAttemptNumber,
    durationMs: Date.now() - responseProviderStartTime,
    ...(fallbackReason && responseProvider === currentProvider
      ? { error: fallbackReason }
      : {}),
  });
  const usedFallback = providerAttemptTelemetry.length > 1;
  const providerFallbackReason =
    providerAttemptTelemetry.find((attempt) => attempt.error)?.error;
  const quality = evaluateAgentResponseQuality(agentName, fullResponseText, {
    durationMs,
    fallbackReason,
  });
  logger.info(
    `[Stream ${agentName}] Completed in ${durationMs}ms via ${responseProvider}, tools: [${toolsCalled.join(', ')}]`
  );

  try {
    await saveAgentFindingsToContext(sessionId, agentName, fullResponseText);
  } catch {
    // Context saving is best-effort only.
  }

  const followUp = getSuggestedFollowUp(agentName, fullResponseText);

  yield {
    type: 'done',
    data: {
      success: true,
      finalAgent: agentName,
      toolsCalled,
      handoffs: [{ from: 'Orchestrator', to: agentName, reason: 'Routing' }],
      usage: {
        promptTokens: responseUsage?.inputTokens ?? 0,
        completionTokens: responseUsage?.outputTokens ?? 0,
        totalTokens: responseUsage?.totalTokens ?? 0,
      },
      metadata: {
        provider: responseProvider,
        modelId: responseModelId,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        ...(firstChunkMs !== null ? { ttfbMs: firstChunkMs } : {}),
        providerAttempts: providerAttemptTelemetry,
        usedFallback,
        ...(providerFallbackReason
          ? { fallbackReason: classifyProviderFallbackReason(providerFallbackReason) }
          : {}),
      },
      ...(followUp && { suggestedFollowUp: followUp }),
    },
  };
}

export function* emitNoOutputFallbackDoneEvent({
  agentName,
  provider,
  modelId,
  attempt,
  durationMs,
  providerStartTime,
  firstChunkMs,
  providerAttemptTelemetry,
  markFirstChunk,
}: {
  agentName: string;
  provider: string;
  modelId: string;
  attempt: number;
  durationMs: number;
  providerStartTime: number;
  firstChunkMs: number | null;
  providerAttemptTelemetry: ProviderAttemptTelemetry[];
  markFirstChunk: (source: string) => void;
}): Generator<StreamEvent> {
  const noOutputFallback = '모델이 응답을 생성하지 못했습니다. 다시 시도해 주세요.';
  markFirstChunk('no_output_fallback');
  const fallbackTtfbMs = firstChunkMs ?? Date.now() - providerStartTime;
  yield { type: 'text_delta', data: noOutputFallback };
  providerAttemptTelemetry.push({
    provider,
    modelId,
    attempt,
    durationMs: Date.now() - providerStartTime,
    error: 'NO_OUTPUT',
  });
  const quality = evaluateAgentResponseQuality(agentName, noOutputFallback, {
    durationMs,
    fallbackReason: 'NO_OUTPUT',
  });

  yield {
    type: 'done',
    data: {
      success: false,
      finalAgent: agentName,
      toolsCalled: [],
      handoffs: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider,
        modelId,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        ttfbMs: fallbackTtfbMs,
        providerAttempts: providerAttemptTelemetry,
        usedFallback: providerAttemptTelemetry.length > 1,
        fallbackReason: 'no_output',
      },
    },
  };
}

export function emitAllProvidersFailedEvent({
  agentName,
  lastError,
  providerAttemptTelemetry,
}: {
  agentName: string;
  lastError?: string;
  providerAttemptTelemetry: ProviderAttemptTelemetry[];
}): StreamEvent {
  return {
    type: 'error',
    data: {
      code: 'STREAM_ERROR',
      error: lastError ?? `All providers failed for ${agentName}`,
      metadata: {
        providerAttempts: providerAttemptTelemetry,
        usedFallback: providerAttemptTelemetry.length > 1,
        ...(lastError
          ? { fallbackReason: classifyProviderFallbackReason(lastError) }
          : {}),
      },
    },
  };
}

export function getAgentInstructions(
  config: {
    instructions: string;
    getInstructions?: (query: string) => string;
  },
  query: string
): string {
  return config.getInstructions?.(query) ?? config.instructions;
}

export function classifyProviderFallbackReason(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('too_many_requests') ||
    normalized.includes('queue_exceeded') ||
    normalized.includes('high traffic') ||
    normalized.includes('quota_admission')
  ) {
    return 'rate_limit';
  }
  if (normalized.includes('timeout')) return 'timeout';
  if (normalized.includes('no output')) return 'no_output';
  if (normalized.includes('empty_response')) return 'empty_response';
  if (normalized.includes('raw_tool_call_json')) return 'raw_tool_call_json';
  if (
    normalized.includes('low_information_response') ||
    normalized.includes('heading_only_response')
  ) {
    return 'low_information_response';
  }
  if (
    normalized.includes('does not exist') ||
    normalized.includes('no access') ||
    normalized.includes('model not found') ||
    normalized.includes('404')
  ) {
    return 'model_unavailable';
  }
  if (
    normalized.includes('unavailable') ||
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('504')
  ) {
    return 'provider_unavailable';
  }
  return 'provider_error';
}

export function estimateAgentStreamQuotaTokens(
  contents: Array<string | UserContent>,
  maxOutputTokens: number
): number {
  return estimateContentQuotaTokens(contents, maxOutputTokens);
}

export function selectSummarizationModel(
  providerAttempts: ModelResult[],
  currentAttemptIndex: number,
  excludedProviders: string[]
): { modelResult: ModelResult; attemptIndex: number; delegated: boolean } {
  for (
    let nextIndex = currentAttemptIndex + 1;
    nextIndex < providerAttempts.length;
    nextIndex++
  ) {
    const nextAttempt = providerAttempts[nextIndex];
    if (nextAttempt && !excludedProviders.includes(nextAttempt.provider)) {
      return {
        modelResult: nextAttempt,
        attemptIndex: nextIndex,
        delegated: true,
      };
    }
  }

  return {
    modelResult: providerAttempts[currentAttemptIndex],
    attemptIndex: currentAttemptIndex,
    delegated: false,
  };
}

export function getSuggestedFollowUp(
  agentName: string,
  responseText: string
): string | null {
  if (agentName === 'Analyst Agent') {
    if (/이상|anomal|critical|경고|임계/i.test(responseText)) {
      return '해결 방법과 권장 조치를 알려줘';
    }
  }
  if (isMetricsQueryRuntimeName(agentName)) {
    if (/[89]\d%|100%|임계|경고|critical/i.test(responseText)) {
      return '이상 원인을 분석해줘';
    }
  }
  if (agentName === 'Reporter Agent') {
    return '재발 방지 방안을 알려줘';
  }
  return null;
}

export function getEvidenceToolResults(
  collectedToolResults: CollectedToolResult[]
): CollectedToolResult[] {
  return collectedToolResults.filter(
    (toolResult) => toolResult.toolName !== 'finalAnswer'
  );
}

export function countServersFromToolResults(
  collectedToolResults: CollectedToolResult[]
): number {
  const serverToolNames = new Set([
    'getServerMetrics',
    'getServerMetricsAdvanced',
    'filterServers',
  ]);

  return collectedToolResults.reduce((sum, toolResult) => {
    if (!serverToolNames.has(toolResult.toolName)) return sum;
    if (!toolResult.result || typeof toolResult.result !== 'object') return sum;
    if (!('servers' in toolResult.result)) return sum;

    const result = toolResult.result as {
      servers?: unknown[];
      summary?: { total?: unknown };
    };
    const serverCount = Array.isArray(result.servers)
      ? result.servers.length
      : 0;
    const total =
      typeof result.summary?.total === 'number' ? result.summary.total : 0;
    return sum + Math.max(serverCount, total);
  }, 0);
}

export function shouldRepairToolGroundedResponse(
  fullResponseText: string,
  collectedToolResults: CollectedToolResult[],
  preferDeterministicSummary: boolean
): boolean {
  if (preferDeterministicSummary) return false;
  if (getEvidenceToolResults(collectedToolResults).length === 0) return false;
  return isLowInformationToolGroundedResponse(fullResponseText);
}

export function buildToolResultsSummary(
  collectedToolResults: CollectedToolResult[]
): string {
  const uniqueResults = new Map<string, unknown>();
  for (const tr of getEvidenceToolResults(collectedToolResults)) {
    if (!uniqueResults.has(tr.toolName)) {
      uniqueResults.set(tr.toolName, tr.result);
    }
  }

  return Array.from(uniqueResults.entries())
    .map(
      ([name, result]) =>
        `[${name}]: ${JSON.stringify(result).slice(0, TOOL_RESULT_SUMMARY_MAX_CHARS)}`
    )
    .join('\n\n');
}

function isHeadingOnlyLine(line: string): boolean {
  return /^(?:[#*\-\s\d.)]*(?:핵심\s*요약|분석\s*결과|분석|원인\s*분석|권장\s*조치|즉시\s*조치|조치|요약|현황|결론|summary|analysis|findings?|actions?|recommendations?)\s*[:：]?\s*)$/i.test(
    line
  );
}

function hasConcreteEvidence(text: string): boolean {
  return /(?:\b[a-z]+-[a-z]+[-\w]*\d\b|\d{1,3}(?:\.\d+)?%|\b(?:cpu|mem|memory|disk|network)\b|메모리|디스크|네트워크|경고|위험|장애|error|warning|critical)/i.test(
    text
  );
}

function isLowInformationToolGroundedResponse(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return true;

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    lines.length > 0 &&
    lines.length <= 6 &&
    lines.every(isHeadingOnlyLine)
  ) {
    return true;
  }

  return (
    normalized.length < TOOL_GROUNDED_REPAIR_MIN_CHARS &&
    !hasConcreteEvidence(normalized)
  );
}
