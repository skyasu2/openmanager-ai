import type { ToolSet } from 'ai';
import type { DomainEvidenceResult } from '../../core/assistant-runtime';
import { extractToolResultOutput } from '../../lib/ai-sdk-utils';
import { logger } from '../../lib/logger';
import { buildDeterministicSummaryFallback } from './agents/orchestrator-summary-fallback';
import type { ProviderName } from './model-provider';
import {
  buildWebSearchFallbackAnswer,
  hasWebSearchFallbackAnswer,
} from './supervisor-stream-citations';
import {
  executeSearchWebFallbackFromSteps,
  type CollectedToolResult,
} from './supervisor-stream-helpers';
import type { StreamEvent } from './supervisor-types';

type StepToolCallLike = {
  toolName?: unknown;
  input?: unknown;
  args?: unknown;
};

type StepLike = {
  toolCalls?: StepToolCallLike[];
  toolResults?: unknown[];
};

export type SupervisorStreamRecoveryResult = {
  fullText: string;
  firstChunkMs: number | null;
  streamError: Error | null;
};

type SupervisorStreamRecoveryInput = {
  fullText: string;
  firstChunkMs: number | null;
  streamError: Error | null;
  queryText: string;
  domainEvidence?: DomainEvidenceResult | null;
  steps: StepLike[];
  collectedToolResults: CollectedToolResult[];
  filteredTools: ToolSet;
  provider: ProviderName;
  modelId: string;
  providerStartTime: number;
  startTime: number;
};

type GenericEmptySupervisorStreamFallbackInput = {
  streamError: Error | null;
  queryText: string;
  steps: StepLike[];
  provider: ProviderName;
  modelId: string;
  startTime: number;
};

const EMPTY_STREAM_FALLBACK_TEXT =
  '응답 본문이 비어 있어 요약 결과를 생성하지 못했습니다. 질문을 조금 더 구체적으로 다시 시도해 주세요.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readToolResultName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.toolName === 'string' ? value.toolName : null;
}

function readFinalAnswerFromSteps(steps: StepLike[]): string | null {
  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      if (readToolResultName(toolResult) !== 'finalAnswer') continue;

      const output = extractToolResultOutput(toolResult);
      if (!isRecord(output) || typeof output.answer !== 'string') continue;

      const answer = output.answer.trim();
      if (answer.length > 0) return answer;
    }
  }

  return null;
}

function listToolCallNames(steps: StepLike[]): unknown[] {
  return steps.flatMap((step) =>
    (step.toolCalls ?? []).map((toolCall) => toolCall.toolName)
  );
}

export async function* recoverEmptySupervisorStreamOutput(
  input: SupervisorStreamRecoveryInput
): AsyncGenerator<StreamEvent, SupervisorStreamRecoveryResult> {
  let { fullText, firstChunkMs, streamError } = input;

  const emitRecoveredText = function* (
    text: string,
    reason: string
  ): Generator<StreamEvent> {
    fullText = text;
    if (firstChunkMs === null) {
      firstChunkMs = Date.now() - input.providerStartTime;
      logger.info(
        `[SupervisorStream] TTFB recovered via ${reason}: ${firstChunkMs}ms (${input.provider}/${input.modelId})`
      );
    }
    yield { type: 'text_delta', data: fullText };
  };

  const deterministicSummary = buildDeterministicSummaryFallback(
    input.queryText,
    'Supervisor',
    input.collectedToolResults
  );
  if (fullText.trim().length === 0 && deterministicSummary) {
    yield* emitRecoveredText(deterministicSummary, 'deterministic summary');
    logger.info(
      '[SupervisorStream] Recovered response from deterministic tool summary'
    );
    if (streamError !== null) {
      logger.warn(
        '[SupervisorStream] Suppressed stream error after deterministic tool summary recovery:',
        streamError.message
      );
      streamError = null;
    }
  }

  if (fullText.trim().length === 0 && input.domainEvidence) {
    yield* emitRecoveredText(input.domainEvidence.fallback, 'domain evidence');
    streamError = null;
  }

  if (fullText.trim().length === 0) {
    const finalAnswer = readFinalAnswerFromSteps(input.steps);
    if (finalAnswer) {
      yield* emitRecoveredText(finalAnswer, 'finalAnswer');
      logger.info(
        '[SupervisorStream] Recovered response from finalAnswer tool result'
      );
    }
  }

  if (fullText.trim().length === 0) {
    if (!hasWebSearchFallbackAnswer(input.collectedToolResults)) {
      const recoveredSearchWebResult =
        await executeSearchWebFallbackFromSteps(
          input.steps,
          input.queryText,
          input.filteredTools
        );
      if (recoveredSearchWebResult) {
        input.collectedToolResults.push(recoveredSearchWebResult);
      }
    }

    const webSearchFallback = buildWebSearchFallbackAnswer(
      input.collectedToolResults
    );
    if (webSearchFallback) {
      yield* emitRecoveredText(webSearchFallback, 'web search fallback');
      logger.info(
        '[SupervisorStream] Recovered empty response from searchWeb tool result'
      );
    }
  }

  return {
    fullText,
    firstChunkMs,
    streamError,
  };
}

export async function* emitGenericEmptySupervisorStreamFallback(
  input: GenericEmptySupervisorStreamFallbackInput
): AsyncGenerator<StreamEvent, string> {
  const durationAtEmpty = Date.now() - input.startTime;
  logger.warn(
    {
      event: 'empty_stream_output',
      provider: input.provider,
      modelId: input.modelId,
      query: input.queryText.substring(0, 100),
      stepsCount: input.steps.length,
      toolsCalled: listToolCallNames(input.steps),
      durationMs: durationAtEmpty,
      hasStreamError: input.streamError !== null,
      streamErrorMessage: input.streamError?.message ?? null,
    },
    '[SupervisorStream] Empty stream output — diagnosing root cause'
  );
  yield {
    type: 'warning',
    data: {
      code: 'EMPTY_RESPONSE',
      message: '모델이 빈 응답을 반환했습니다. 기본 안내 문구로 대체합니다.',
    },
  };
  yield { type: 'text_delta', data: EMPTY_STREAM_FALLBACK_TEXT };
  return EMPTY_STREAM_FALLBACK_TEXT;
}
