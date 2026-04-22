import type { StreamEvent } from '../supervisor';

import { evaluateAgentResponseQuality } from './response-quality';
import type {
  MultiAgentError,
  MultiAgentRequest,
  MultiAgentResponse,
} from './orchestrator-types';
import {
  executeForcedRouting,
  getAgentConfig,
  executeWithAgentFactory,
} from './orchestrator-routing';
import { logger } from '../../../lib/logger';
import {
  finalizeTrace,
  type LangfuseTrace,
} from '../../observability/langfuse';

type StreamDoneData = {
  success?: boolean;
  finalAgent?: string;
  toolsCalled?: string[];
  metadata?: Record<string, unknown>;
};

export function getLastUserQuery(
  request: MultiAgentRequest
): string | null {
  return (
    request.messages
      .filter((message) => message.role === 'user')
      .pop()?.content ?? null
  );
}

export async function executeVisionOrFallback(
  query: string,
  startTime: number,
  webSearchEnabled: boolean,
  ragEnabled: boolean,
  images?: Parameters<typeof executeWithAgentFactory>[5],
  files?: Parameters<typeof executeWithAgentFactory>[6]
): Promise<MultiAgentResponse | null> {
  const result = await executeWithAgentFactory(
    query,
    'vision',
    startTime,
    webSearchEnabled,
    ragEnabled,
    images,
    files
  );
  if (result) {
    return result;
  }

  logger.warn(
    '⚠️ [Vision] Vision providers unavailable (Gemini/OpenRouter), falling back to Analyst Agent'
  );
  return executeForcedRouting(
    query,
    'Analyst Agent',
    startTime,
    webSearchEnabled,
    ragEnabled,
    images,
    files
  );
}

export function resolveVisionFallbackAgent(agentName: string): {
  targetAgent: string;
  degradedFromVision: boolean;
} {
  if (agentName !== 'Vision Agent') {
    return { targetAgent: agentName, degradedFromVision: false };
  }

  const visionConfig = getAgentConfig('Vision Agent');
  if (visionConfig && visionConfig.getModel()) {
    return { targetAgent: 'Vision Agent', degradedFromVision: false };
  }

  return { targetAgent: 'Analyst Agent', degradedFromVision: true };
}

export function buildFastPathResponse(
  responseText: string,
  startTime: number
): MultiAgentResponse {
  const durationMs = Date.now() - startTime;
  const quality = evaluateAgentResponseQuality('Orchestrator', responseText, {
    durationMs,
  });

  return {
    success: true,
    response: responseText,
    handoffs: [],
    finalAgent: 'Orchestrator (Fast Path)',
    toolsCalled: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metadata: {
      provider: 'rule-based',
      modelId: 'prefilter',
      totalRounds: 1,
      handoffCount: 0,
      durationMs,
      responseChars: quality.responseChars,
      formatCompliance: quality.formatCompliance,
      qualityFlags: quality.qualityFlags,
      latencyTier: quality.latencyTier,
    },
  };
}

export async function* streamFastPathResponse(
  responseText: string,
  startTime: number
): AsyncGenerator<StreamEvent> {
  const durationMs = Date.now() - startTime;
  logger.info(`[Stream Fast Path] Direct response in ${durationMs}ms`);

  yield { type: 'text_delta', data: responseText };
  yield {
    type: 'done',
    data: {
      success: true,
      finalAgent: 'Orchestrator (Fast Path)',
      toolsCalled: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { durationMs, provider: 'rule-based' },
    },
  };
}

export function mapOrchestratorErrorCode(errorMessage: string): string {
  if (errorMessage.includes('API key')) {
    return 'AUTH_ERROR';
  }
  if (errorMessage.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (errorMessage.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (errorMessage.includes('model')) {
    return 'MODEL_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

export function getTraceId(trace: LangfuseTrace): string | undefined {
  const traceId = (trace as { id?: unknown }).id;
  return typeof traceId === 'string' && traceId.length > 0 ? traceId : undefined;
}

function attachTraceIdToResponse(
  response: MultiAgentResponse,
  traceId: string | undefined
): MultiAgentResponse {
  if (!traceId) {
    return response;
  }

  return {
    ...response,
    metadata: {
      ...response.metadata,
      traceId,
    },
  };
}

export function finalizeMultiAgentResponse(
  trace: LangfuseTrace,
  response: MultiAgentResponse
): MultiAgentResponse {
  const traceId = getTraceId(trace);
  const handoffCount = response.handoffs?.length ?? 0;
  const responseWithTraceId = attachTraceIdToResponse(response, traceId);
  const tracedResponse = {
    ...responseWithTraceId,
    metadata: {
      ...responseWithTraceId.metadata,
      handoffCount,
    },
  };

  finalizeTrace(trace, tracedResponse.response, true, {
    mode: 'multi',
    traceId,
    finalAgent: tracedResponse.finalAgent,
    toolsCalled: tracedResponse.toolsCalled,
    totalRounds: tracedResponse.metadata.totalRounds,
    handoffCount,
    durationMs: tracedResponse.metadata.durationMs,
  });

  return tracedResponse;
}

export function finalizeMultiAgentError(
  trace: LangfuseTrace,
  error: MultiAgentError,
  durationMs: number
): MultiAgentError {
  finalizeTrace(trace, error.error, false, {
    mode: 'multi',
    code: error.code,
    durationMs,
  });

  return error;
}

export async function* streamWithTrace(
  trace: LangfuseTrace,
  startTime: number,
  stream: AsyncGenerator<StreamEvent>
): AsyncGenerator<StreamEvent> {
  const traceId = getTraceId(trace);
  let fullText = '';
  let terminalSeen = false;

  for await (const event of stream) {
    if (event.type === 'text_delta' && typeof event.data === 'string') {
      fullText += event.data;
    }

    if (event.type === 'done') {
      terminalSeen = true;
      const doneData = event.data as StreamDoneData;
      const durationMs =
        typeof doneData.metadata?.durationMs === 'number'
          ? doneData.metadata.durationMs
          : Date.now() - startTime;
      const enrichedEvent = traceId
        ? {
            ...event,
            data: {
              ...doneData,
              metadata: {
                ...(doneData.metadata ?? {}),
                traceId,
              },
            },
          }
        : event;

      finalizeTrace(trace, fullText || 'Stream completed', doneData.success !== false, {
        mode: 'multi',
        traceId,
        finalAgent: doneData.finalAgent,
        toolsCalled: doneData.toolsCalled,
        durationMs,
      });

      yield enrichedEvent;
      return;
    }

    if (event.type === 'error') {
      terminalSeen = true;
      const errorData = event.data as {
        code?: string;
        error?: string;
        message?: string;
      };
      finalizeTrace(
        trace,
        fullText || errorData.error || errorData.message || 'Stream failed',
        false,
        {
          mode: 'multi',
          traceId,
          code: errorData.code,
          durationMs: Date.now() - startTime,
        }
      );

      yield event;
      return;
    }

    yield event;
  }

  if (!terminalSeen) {
    finalizeTrace(trace, fullText || 'Stream terminated unexpectedly', false, {
      mode: 'multi',
      traceId,
      code: 'STREAM_TERMINATED',
      durationMs: Date.now() - startTime,
    });
  }
}
