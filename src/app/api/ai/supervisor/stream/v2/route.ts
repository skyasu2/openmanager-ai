/**
 * Cloud Run AI Supervisor Stream V2 Proxy
 *
 * @endpoint POST /api/ai/supervisor/stream/v2
 *
 * AI SDK v7 Native UIMessageStream proxy to Cloud Run.
 *
 * Features:
 * - Pass-through UIMessageStream proxy
 * - Output filtering before returning to clients
 * - Fallback stream on Cloud Run timeout or retryable failures
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 * @created 2026-01-24
 * @updated 2026-05-20 - Removed unsupported Redis-backed stream resume
 */

import { generateId } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  generateTraceId,
  generateTraceparent,
  getObservabilityConfig,
  normalizeTraceId,
  parseTraceparent,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import {
  getAICache,
  recordCacheOutcome,
} from '@/lib/ai/cache/ai-response-cache';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import { buildAITimingHeaders, startAITimer } from '@/lib/ai/observability';
import {
  type HybridMessage,
  normalizeMessagesForCloudRun,
} from '@/lib/ai/utils/message-normalizer';
import { getRequiredCloudRunConfig } from '@/lib/ai-proxy/cloud-run-config';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { rejectIfSystemNotRunning } from '@/lib/system/system-running-guard';
import { runWithTraceId } from '@/lib/tracing/async-context';
import {
  applySanitizedQueryToMessages,
  extractAndValidateQuery,
} from '../../request-utils';
import { requestSchema } from '../../schemas';
import {
  createStreamErrorResponse,
  createStreamFallbackResponse,
  createStreamPolicyBlockResponse,
  createStreamTextResponse,
  NORMALIZED_MESSAGES_SCHEMA,
  trimMessagesForContext,
} from './route-utils';
import {
  isUpstreamResponseCacheable,
  persistStreamCache,
  resolveStreamCachePolicy,
} from './stream-cache-policy';
import { createOutputFilterStream } from './stream-output-filter';
import { resolveStreamRequestContext } from './stream-request-context';
import {
  createDeveloperContextDataParts as buildDeveloperContextDataParts,
  createDeveloperContextStreamPart,
  createSupervisorStreamHeaders,
  logStreamTerminal,
  prependStreamDataPart,
  trackFirstQueryLatency,
} from './stream-response-builder';
import {
  getSupervisorStreamAbortTimeoutMs,
  getSupervisorStreamRetryTimeoutMs,
  parseOptionalDurationHeader,
} from './stream-timeouts';
import { executeCloudRunStreamFetch } from './stream-upstream-fetch';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;

function resolveTraceContext(req: NextRequest): {
  enabled: boolean;
  traceId: string;
  traceIdHeader: string;
  traceparent: string;
  upstreamTraceId: string | null;
} {
  const observability = getObservabilityConfig();
  const inboundTraceparent = req.headers.get(TRACEPARENT_HEADER);
  const upstreamTraceparent = inboundTraceparent
    ? parseTraceparent(inboundTraceparent)
    : null;
  const upstreamTraceId = upstreamTraceparent?.traceId ?? null;
  const upstreamTraceFlags = upstreamTraceparent?.traceFlags ?? null;
  const legacyTraceId = req.headers.get(observability.traceIdHeader);
  const traceId =
    upstreamTraceId ?? normalizeTraceId(legacyTraceId) ?? generateTraceId();

  return {
    enabled: observability.enableTraceId,
    traceId,
    traceIdHeader: observability.traceIdHeader,
    traceparent: generateTraceparent(traceId, {
      traceFlags: upstreamTraceFlags,
    }),
    upstreamTraceId,
  };
}

export const GET = withAuth(
  withRateLimit(rateLimiters.aiAnalysis, async () =>
    NextResponse.json(
      { error: 'Stream resume is not supported' },
      {
        status: 405,
        headers: { Allow: 'POST' },
      }
    )
  )
);

export const POST = withAuth(
  withRateLimit(rateLimiters.aiAnalysis, async (req: NextRequest) => {
    const traceContext = resolveTraceContext(req);
    return runWithTraceId(traceContext.traceId, async () => {
      const notRunning = await rejectIfSystemNotRunning();
      if (notRunning) return notRunning;

      try {
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
          const issueDetail = parseResult.error.issues
            .map((i) => i.message)
            .join(', ');
          logStreamTerminal({
            category: 'invalid_payload',
            httpStatus: 400,
            detail: issueDetail,
          });
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request payload',
              details: issueDetail,
            },
            { status: 400 }
          );
        }

        const {
          id: chatSessionId,
          messages,
          sessionId: bodySessionId,
          enableWebSearch,
          enableRAG,
          queryAsOfDataSlot,
          localRouteDecision: rawLocalRouteDecision,
          metadata,
          semanticQueryTrace,
        } = parseResult.data;
        const {
          queryAsOf,
          localRouteDecision,
          sessionId,
          backendSessionId,
          cacheSessionId,
          deviceType,
          rateLimitIdentityHeaders,
          internalDisclosureMode,
          internalDisclosureFields,
          warmupStartedAt,
          isFirstQuery,
          isFirstWarmupQuery,
        } = resolveStreamRequestContext({
          req,
          chatSessionId,
          bodySessionId,
          queryAsOfDataSlot,
          rawLocalRouteDecision,
        });

        trackFirstQueryLatency({ isFirstQuery, warmupStartedAt, sessionId });

        const queryResult = extractAndValidateQuery(
          messages as HybridMessage[]
        );
        if (!queryResult.ok) {
          if (queryResult.reason === 'blocked') {
            if (queryResult.warning) {
              logger.warn(
                `🛡️ [SupervisorStreamV2] Security warning: ${queryResult.warning}`
              );
            }
            logStreamTerminal({
              category: 'policy_blocked',
              httpStatus: 200,
              detail: queryResult.inputCheck?.patterns.join(', '),
            });
            return createStreamPolicyBlockResponse();
          }
          logStreamTerminal({ category: 'empty_query', httpStatus: 400 });
          return NextResponse.json(
            {
              success: false,
              error: 'Empty query',
            },
            { status: 400 }
          );
        }
        const userQuery = queryResult.userQuery;
        const fallback = createFallbackResponse('supervisor', {
          query: userQuery,
        });
        const fallbackText = fallback.data?.response ?? fallback.message;

        logger.info(
          `🌊 [SupervisorStreamV2] Query: "${userQuery.slice(0, 50)}..."`
        );
        logger.info(`📡 [SupervisorStreamV2] Session: ${sessionId}`);
        logger.info(
          `[SupervisorStreamV2] Warmup-aware first query: ${isFirstWarmupQuery}`
        );

        const sanitizedMessages = applySanitizedQueryToMessages(
          messages as HybridMessage[],
          userQuery
        );
        const trimmedMessages = trimMessagesForContext(sanitizedMessages);
        const normalizedMessages =
          normalizeMessagesForCloudRun(trimmedMessages);
        const normalizedParse =
          NORMALIZED_MESSAGES_SCHEMA.safeParse(normalizedMessages);
        if (!normalizedParse.success) {
          logStreamTerminal({
            category: 'invalid_normalized_messages',
            httpStatus: 400,
            detail: normalizedParse.error.issues
              .map((i) => i.message)
              .join(', '),
          });
          return NextResponse.json(
            { success: false, error: 'Invalid normalized messages' },
            { status: 400 }
          );
        }

        const streamCachePolicy = resolveStreamCachePolicy({
          query: userQuery,
          messageCount: messages.length,
          messages: normalizedParse.data,
          enableWebSearch,
          enableRAG,
          internalDisclosureMode,
          defaultCacheSessionId: cacheSessionId,
        });
        const useStreamCache = streamCachePolicy.enabled;

        const cloudRunConfig = getRequiredCloudRunConfig();
        if (!cloudRunConfig.ok) {
          logStreamTerminal({
            category: 'config_unavailable',
            httpStatus: 503,
            detail: cloudRunConfig.message,
          });
          return NextResponse.json(
            { success: false, error: 'Streaming not available' },
            { status: 503 }
          );
        }

        const streamId = generateId();

        const streamUrl = `${cloudRunConfig.url}/api/ai/supervisor/stream/v2`;
        const createDeveloperContextDataParts = (cloudRunHealthy: boolean) =>
          buildDeveloperContextDataParts({
            enabled: Boolean(internalDisclosureMode),
            cloudRunHealthy,
            cloudRunUrl: cloudRunConfig.url,
          });

        logger.info(`🔗 [SupervisorStreamV2] Connecting to: ${streamUrl}`);
        logger.info(`🆔 [SupervisorStreamV2] Stream ID: ${streamId}`);
        logger.info(
          `[SupervisorStreamV2] Trace context: ${traceContext.traceId} (upstream=${traceContext.upstreamTraceId ? 'yes' : 'no'})`
        );
        const aiTimer = startAITimer();

        if (useStreamCache) {
          const cacheResult = await getAICache(
            streamCachePolicy.cacheSessionId,
            userQuery,
            streamCachePolicy.endpoint
          );

          if (cacheResult.hit && cacheResult.data?.response) {
            recordCacheOutcome(streamCachePolicy.endpoint, 'HIT');
            logger.info(
              `📦 [SupervisorStreamV2] Cache HIT (${cacheResult.source}, ${cacheResult.latencyMs}ms)`
            );
            return createStreamTextResponse({
              message: cacheResult.data.response,
              headers: createSupervisorStreamHeaders({
                sessionId,
                streamId,
                resumable: false,
                timingHeaders: buildAITimingHeaders({
                  latencyMs: aiTimer.elapsed(),
                  cacheStatus: 'HIT',
                  mode: 'streaming',
                  source: 'cache',
                }),
              }) as Record<string, string>,
              dataParts: createDeveloperContextDataParts(true),
            });
          }

          recordCacheOutcome(streamCachePolicy.endpoint, 'MISS');
          logger.info('📦 [SupervisorStreamV2] Cache MISS');
        } else {
          recordCacheOutcome(streamCachePolicy.endpoint, 'BYPASS');
        }

        const primaryTimeoutMs = getSupervisorStreamAbortTimeoutMs({
          isFirstQuery,
          warmupStartedAt,
        });
        const retryTimeoutMs = isFirstWarmupQuery
          ? getSupervisorStreamRetryTimeoutMs(primaryTimeoutMs)
          : null;
        const attemptTimeouts = [
          primaryTimeoutMs,
          ...(retryTimeoutMs ? [retryTimeoutMs] : []),
        ];

        const createFallbackStreamResponse = (reason: string) =>
          createStreamFallbackResponse({
            message: fallbackText,
            reason,
            retryAfterMs: fallback.retryAfter,
            headers: createSupervisorStreamHeaders({
              sessionId,
              streamId,
              resumable: false,
              timingHeaders: buildAITimingHeaders({
                latencyMs: aiTimer.elapsed(),
                cacheStatus: useStreamCache ? 'MISS' : 'BYPASS',
                mode: 'streaming',
                source: 'fallback',
              }),
            }) as Record<string, string>,
            dataParts: createDeveloperContextDataParts(false),
          });

        const { result: fetchResult, fallbackReason } =
          await executeCloudRunStreamFetch({
            streamUrl,
            apiSecret: cloudRunConfig.apiSecret,
            attemptTimeouts,
            upstreamBody: {
              messages: normalizedMessages,
              sessionId: backendSessionId,
              deviceType,
              enableWebSearch,
              enableRAG,
              queryAsOf,
              ...internalDisclosureFields,
              ...(localRouteDecision && { localRouteDecision }),
              ...(metadata && { metadata }),
              ...(semanticQueryTrace !== undefined &&
              semanticQueryTrace !== null
                ? { semanticQueryTrace }
                : {}),
            },
            rateLimitIdentityHeaders,
            traceContext,
            signal: req.signal,
            createFallbackStreamResponse,
          });

        if (fetchResult.source === 'fallback') {
          logStreamTerminal({
            category: 'upstream_fallback',
            httpStatus: 200,
            detail: fallbackReason,
          });
          return fetchResult.data.response;
        }

        if (fetchResult.data.type === 'terminal') {
          logStreamTerminal({
            category: fetchResult.data.category,
            httpStatus: 200,
          });
          return fetchResult.data.response;
        }

        const cloudRunResponse = fetchResult.data.response;

        if (!cloudRunResponse.body) {
          logStreamTerminal({
            category: 'upstream_empty_body',
            httpStatus: 500,
          });
          return NextResponse.json(
            { success: false, error: 'No response body' },
            { status: 500 }
          );
        }

        const processingTimeMs = parseOptionalDurationHeader(
          cloudRunResponse.headers.get('x-ai-latency-ms')
        );
        const timingHeaders = buildAITimingHeaders({
          latencyMs: aiTimer.elapsed(),
          processingTimeMs,
          cacheStatus: useStreamCache ? 'MISS' : 'BYPASS',
          mode: 'streaming',
          source: 'cloud-run',
        });
        const streamBody = internalDisclosureMode
          ? prependStreamDataPart(
              cloudRunResponse.body,
              createDeveloperContextStreamPart({
                cloudRunHealthy: true,
                cloudRunUrl: cloudRunConfig.url,
              })
            )
          : cloudRunResponse.body;
        const filteredStreamBody = streamBody.pipeThrough(
          createOutputFilterStream()
        );
        const [clientStreamBody, cacheStreamBody] =
          useStreamCache && isUpstreamResponseCacheable(cloudRunResponse)
            ? filteredStreamBody.tee()
            : [filteredStreamBody, null];

        if (cacheStreamBody) {
          persistStreamCache({
            body: cacheStreamBody,
            cacheSessionId: streamCachePolicy.cacheSessionId,
            userQuery,
            endpoint: streamCachePolicy.endpoint,
          });
        }

        logger.info(`✅ [SupervisorStreamV2] Stream started (pass-through)`);

        return new Response(clientStreamBody, {
          headers: createSupervisorStreamHeaders({
            sessionId,
            streamId,
            resumable: false,
            timingHeaders,
          }),
        });
      } catch (error) {
        logger.error('❌ [SupervisorStreamV2] Error:', error);
        logStreamTerminal({
          category: 'unhandled_error',
          httpStatus: 200,
          detail: error instanceof Error ? error.message : undefined,
        });
        return createStreamErrorResponse(
          'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        );
      }
    });
  })
);
