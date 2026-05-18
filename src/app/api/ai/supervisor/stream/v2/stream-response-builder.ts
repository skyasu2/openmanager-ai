import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createDeveloperContextStreamPayload } from '@/lib/ai/developer-panel';
import { normalizeRouteDecision } from '@/lib/ai/route-decision';
import {
  INVALID_SESSION_ID_MESSAGE,
  normalizeSupervisorSessionId,
} from '@/lib/ai/supervisor/request-contracts';
import { logger } from '@/lib/logging';
import { getStreamOwnerKey, UI_MESSAGE_STREAM_HEADERS } from './route-utils';
import { clearActiveStreamId, getActiveStreamId } from './stream-state';
import { createUpstashResumableContext } from './upstash-resumable';

export const AI_WARMUP_STARTED_AT_HEADER = 'x-ai-warmup-started-at';
export const AI_FIRST_QUERY_HEADER = 'x-ai-first-query';
const DEVELOPER_CONTEXT_STREAM_PART_TYPE = 'data-developer-context';

export function isResumableStreamsEnabled(): boolean {
  return process.env.AI_RESUMABLE_STREAMS_ENABLED === 'true';
}

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

export async function cleanupStaleStreamMapping(params: {
  sessionId: string;
  ownerKey: string;
  streamId: string;
}): Promise<void> {
  try {
    const staleStreamId = await getActiveStreamId(
      params.sessionId,
      params.ownerKey
    );
    if (staleStreamId && staleStreamId !== params.streamId) {
      const cleanupContext = createUpstashResumableContext();
      await cleanupContext.clearStream(staleStreamId);
      await clearActiveStreamId(params.sessionId, params.ownerKey);
    }
  } catch (cleanupError) {
    logger.warn(
      { err: cleanupError },
      '[SupervisorStreamV2] Stale stream cleanup failed'
    );
  }
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

export const resumeStreamHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const rawSessionId = url.searchParams.get('sessionId');
  const skipParam = url.searchParams.get('skip');

  const skipChunks = skipParam ? Number(skipParam) : 0;
  if (!Number.isInteger(skipChunks) || skipChunks < 0) {
    return NextResponse.json(
      { error: 'skip must be a non-negative integer' },
      { status: 400 }
    );
  }

  const sessionId = normalizeSupervisorSessionId(rawSessionId);
  if (!sessionId) {
    return NextResponse.json(
      { error: INVALID_SESSION_ID_MESSAGE },
      { status: 400 }
    );
  }

  if (!isResumableStreamsEnabled()) {
    logger.debug('[SupervisorStreamV2] Resume requested while disabled');
    return new Response(null, {
      status: 204,
      headers: { 'X-Resumable': 'false' },
    });
  }

  const ownerKey = getStreamOwnerKey(req);

  logger.info(
    `🔄 [SupervisorStreamV2] Resume request for session: ${sessionId}, skip: ${skipChunks}`
  );

  const activeStreamId = await getActiveStreamId(sessionId, ownerKey);

  if (!activeStreamId) {
    logger.debug(
      `[SupervisorStreamV2] No active stream for session: ${sessionId}`
    );
    return new Response(null, { status: 204 });
  }

  const resumableContext = createUpstashResumableContext();
  const streamStatus = await resumableContext.hasExistingStream(activeStreamId);

  if (!streamStatus) {
    logger.debug(
      `[SupervisorStreamV2] Stream not found in Redis: ${activeStreamId}`
    );
    await clearActiveStreamId(sessionId, ownerKey);
    return new Response(null, { status: 204 });
  }

  if (streamStatus === 'completed') {
    logger.info(
      `[SupervisorStreamV2] Stream completed, attempting resume for remaining chunks: ${activeStreamId}`
    );
  }

  const resumedStream = await resumableContext.resumeExistingStream(
    activeStreamId,
    skipChunks
  );

  if (!resumedStream) {
    logger.warn(
      `[SupervisorStreamV2] Failed to resume stream: ${activeStreamId}`
    );
    await clearActiveStreamId(sessionId, ownerKey);
    return new Response(null, { status: 204 });
  }

  if (streamStatus === 'completed') {
    await clearActiveStreamId(sessionId, ownerKey);
    logger.info(
      `[SupervisorStreamV2] Cleared session mapping for completed stream: ${activeStreamId}`
    );
  }

  logger.info(`✅ [SupervisorStreamV2] Stream resumed: ${activeStreamId}`);

  return new Response(resumedStream, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      'X-Session-Id': sessionId,
      'X-Stream-Id': activeStreamId,
      'X-Resumed': 'true',
      'X-Skip-Chunks': String(skipChunks),
    },
  });
};
