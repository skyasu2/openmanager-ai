import { createDeveloperContextStreamPayload } from '@/lib/ai/developer-panel';
import { normalizeRouteDecision } from '@/lib/ai/route-decision';
import { logger } from '@/lib/logging';
import { UI_MESSAGE_STREAM_HEADERS } from './route-utils';

export const AI_WARMUP_STARTED_AT_HEADER = 'x-ai-warmup-started-at';
export const AI_FIRST_QUERY_HEADER = 'x-ai-first-query';
const DEVELOPER_CONTEXT_STREAM_PART_TYPE = 'data-developer-context';

export function normalizeFrontendLocalRouteDecision(value: unknown) {
  const decision = normalizeRouteDecision(value);
  if (!decision) return undefined;
  return decision.decidedBy === 'frontend' ? decision : undefined;
}

export function createDeveloperContextStreamPart(params: {
  cloudRunHealthy: boolean;
  cloudRunUrl: string;
}) {
  return {
    type: DEVELOPER_CONTEXT_STREAM_PART_TYPE,
    data: createDeveloperContextStreamPayload({
      cloudRunHealthy: params.cloudRunHealthy,
      cloudRunUrl: params.cloudRunUrl,
      disclosureMode: 'developer',
    }),
  } satisfies { type: `data-${string}`; data: unknown };
}

export function createDeveloperContextDataParts(params: {
  enabled: boolean;
  cloudRunHealthy: boolean;
  cloudRunUrl: string;
}) {
  return params.enabled
    ? [
        createDeveloperContextStreamPart({
          cloudRunHealthy: params.cloudRunHealthy,
          cloudRunUrl: params.cloudRunUrl,
        }),
      ]
    : [];
}

export function createSupervisorStreamHeaders(params: {
  sessionId: string;
  streamId: string;
  resumable: boolean;
  timingHeaders: Record<string, string>;
}): HeadersInit {
  return {
    ...UI_MESSAGE_STREAM_HEADERS,
    'X-Session-Id': params.sessionId,
    'X-Stream-Id': params.streamId,
    'X-Backend': 'cloud-run-stream-v2',
    'X-Stream-Protocol': 'ui-message-stream',
    'X-Resumable': params.resumable ? 'true' : 'false',
    ...params.timingHeaders,
  };
}

export function trackFirstQueryLatency(params: {
  isFirstQuery: boolean;
  warmupStartedAt: number | null;
  sessionId: string;
}): void {
  if (!params.isFirstQuery || !params.warmupStartedAt) {
    return;
  }

  const latencyMs = Date.now() - params.warmupStartedAt;
  if (latencyMs >= 0 && latencyMs <= 15 * 60 * 1000) {
    logger.info(
      {
        event: 'first_query_latency',
        sessionId: params.sessionId,
        first_query_latency_ms: latencyMs,
        warmup_started_at_ms: params.warmupStartedAt,
      },
      '[AI Warmup] First query latency tracked'
    );
    return;
  }

  logger.warn(
    {
      event: 'first_query_latency_invalid',
      sessionId: params.sessionId,
      warmup_started_at_ms: params.warmupStartedAt,
      computed_latency_ms: latencyMs,
    },
    '[AI Warmup] Invalid first query latency window'
  );
}

export function prependStreamDataPart(
  body: ReadableStream<Uint8Array>,
  dataPart: { type: `data-${string}`; data: unknown }
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const encoder = new TextEncoder();
  let didPrepend = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!didPrepend) {
        didPrepend = true;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(dataPart)}\n\n`)
        );
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
