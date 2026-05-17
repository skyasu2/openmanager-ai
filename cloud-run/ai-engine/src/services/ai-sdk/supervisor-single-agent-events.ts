import { getPublicErrorMessage } from '../../lib/error-handler';
import type {
  EvidenceCard,
  RetrievalMetadata,
} from '../../lib/retrieval-contract';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import {
  buildDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import {
  buildSupervisorAssistantResult,
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
  type SupervisorAssistantPlan,
  type SupervisorRouteDecision,
} from './supervisor-mode';
import {
  buildInternalImplementationPathPolicyMetadata,
  buildInternalImplementationPathRefusal,
} from './internal-disclosure-policy';
import type { StreamEvent, SupervisorRequest } from './supervisor-types';

type SingleAgentResponseContext = {
  request: SupervisorRequest;
  modeDecision?: ResolvedSupervisorModeDecision;
  routeDecision?: SupervisorRouteDecision;
  assistantPlan?: SupervisorAssistantPlan;
  runtimeMetadata?: AssistantRuntimeMetadata;
  degradedFallbackContext?: SupervisorDegradedFallbackContext;
};

type StreamUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

function buildCommonSingleAgentMetadata({
  request,
  modeDecision,
  routeDecision,
  assistantPlan,
  runtimeMetadata,
  degradedFallbackContext,
  durationMs,
  degradedMetadata = {},
}: SingleAgentResponseContext & {
  durationMs: number;
  degradedMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    durationMs,
    mode: 'single',
    ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
    ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
    ...(routeDecision && { routeDecision }),
    ...(assistantPlan && { assistantPlan }),
    ...(routeDecision && {
      assistantResult: buildSupervisorAssistantResult(routeDecision),
    }),
    ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
    ...buildDegradedMetadata(degradedFallbackContext, degradedMetadata),
  };
}

export function buildSupervisorAgentStatus(message: string): StreamEvent {
  return {
    type: 'agent_status',
    data: {
      agent: 'Supervisor',
      status: 'processing',
      message,
    },
  };
}

export function* streamInternalImplementationPathRefusal({
  startTime,
  ...context
}: SingleAgentResponseContext & {
  startTime: number;
}): Generator<StreamEvent> {
  const durationMs = Date.now() - startTime;
  const queryText =
    context.request.messages
      .filter((message) => message.role === 'user')
      .at(-1)?.content ?? '';
  const answer = buildInternalImplementationPathRefusal(queryText);
  yield { type: 'text_delta', data: answer };
  yield {
    type: 'done',
    data: {
      success: true,
      toolsCalled: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        ...buildInternalImplementationPathPolicyMetadata(durationMs),
        ...buildCommonSingleAgentMetadata({ ...context, durationMs }),
      },
    },
  };
}

export function* streamNoProviderFallback({
  startTime,
  ...context
}: SingleAgentResponseContext & {
  startTime: number;
}): Generator<StreamEvent> {
  yield {
    type: 'text_delta',
    data: '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.',
  };
  yield {
    type: 'done',
    data: {
      success: true,
      toolsCalled: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'none',
        modelId: 'none',
        stepsExecuted: 0,
        ...buildCommonSingleAgentMetadata({
          ...context,
          durationMs: Date.now() - startTime,
          degradedMetadata: {
            fallback: true,
            fallbackReason: 'no_provider',
          },
        }),
      },
    },
  };
}

export function buildCircuitOpenErrorEvent({
  provider,
  failures,
  lastFailure,
}: {
  provider: string;
  failures: number;
  lastFailure?: Date;
}): StreamEvent {
  return {
    type: 'error',
    data: {
      code: 'CIRCUIT_OPEN',
      message: getPublicErrorMessage('CIRCUIT_OPEN'),
      metadata: {
        provider,
        failures,
        lastFailure: lastFailure?.toISOString(),
      },
    },
  };
}

export function buildRateLimitedErrorEvent({
  provider,
  modelId,
  reason,
  recommendedWaitMs,
}: {
  provider: string;
  modelId: string;
  reason?: string;
  recommendedWaitMs?: number;
}): StreamEvent {
  return {
    type: 'error',
    data: {
      code: 'RATE_LIMITED',
      message: getPublicErrorMessage('RATE_LIMIT'),
      metadata: {
        provider,
        modelId,
        reason,
        recommendedWaitMs,
      },
    },
  };
}

export function buildPublicErrorEvent(publicError: {
  code: string;
  message: string;
}): StreamEvent {
  return {
    type: 'error',
    data: {
      code: publicError.code,
      message: publicError.message,
    },
  };
}

export function buildHardTimeoutErrorEvent({
  elapsed,
  partialResponseLength,
}: {
  elapsed: number;
  partialResponseLength: number;
}): StreamEvent {
  const hasPartialResponse = partialResponseLength > 0;

  return {
    type: 'error',
    data: {
      code: 'HARD_TIMEOUT',
      error: getPublicErrorMessage('HARD_TIMEOUT'),
      elapsed,
      partialResponseLength,
      suggestion: hasPartialResponse
        ? '부분 응답이 제공되었습니다. 추가 정보가 필요하면 질문을 더 구체적으로 해주세요.'
        : '쿼리를 간단하게 나눠서 다시 시도해주세요.',
    },
  };
}

export function buildSingleAgentDoneEvent({
  request,
  modeDecision,
  routeDecision,
  assistantPlan,
  runtimeMetadata,
  degradedFallbackContext,
  provider,
  modelId,
  traceId,
  stepsExecuted,
  durationMs,
  toolsCalled,
  usage,
  totalTokensUsed,
  attempt,
  capturedError,
  ragSources,
  evidenceCards,
  retrieval,
  semanticQueryTrace,
  rotationSlot,
}: SingleAgentResponseContext & {
  provider: string;
  modelId: string;
  traceId?: string;
  stepsExecuted: number;
  durationMs: number;
  toolsCalled: string[];
  usage?: StreamUsage;
  totalTokensUsed: number;
  attempt: number;
  capturedError: Error | null;
  ragSources: unknown[];
  evidenceCards: EvidenceCard[];
  retrieval?: RetrievalMetadata;
  semanticQueryTrace?: unknown;
  rotationSlot?: number;
}): StreamEvent {
  return {
    type: 'done',
    data: {
      success: capturedError === null,
      toolsCalled,
      usage: {
        promptTokens: usage?.inputTokens ?? 0,
        completionTokens: usage?.outputTokens ?? 0,
        totalTokens: totalTokensUsed,
      },
      metadata: {
        provider,
        modelId,
        stepsExecuted,
        durationMs,
        mode: 'single',
        ...(typeof rotationSlot === 'number' && { rotationSlot }),
        ...(traceId && { traceId }),
        ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...(routeDecision && { routeDecision }),
        ...(assistantPlan && { assistantPlan }),
        ...(routeDecision && {
          assistantResult: buildSupervisorAssistantResult(routeDecision, {
            status: capturedError === null ? 'completed' : 'failed',
            ...(capturedError && {
              errorCode: 'SUPERVISOR_STREAM_ERROR',
            }),
          }),
        }),
        ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
        ...(retrieval && { retrieval }),
        ...(evidenceCards.length > 0 && { evidenceCards }),
        ...(semanticQueryTrace !== undefined && semanticQueryTrace !== null
          ? { semanticQueryTrace }
          : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
        ...(attempt > 0 && { providerRetries: attempt }),
      },
      ...(ragSources.length > 0 && { ragSources }),
      ...(evidenceCards.length > 0 && { evidenceCards }),
      ...(capturedError && {
        warning: {
          code: 'STREAM_ERROR_OCCURRED',
          message: getPublicErrorMessage('STREAM_ERROR_OCCURRED'),
        },
      }),
    },
  };
}
