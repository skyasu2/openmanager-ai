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
import { executeWithCircuitBreakerAndFallback } from '@/lib/ai/circuit-breaker';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import { buildAITimingHeaders, startAITimer } from '@/lib/ai/observability';
import { buildJobQueryAsOf } from '@/lib/ai/query-as-of';
import { normalizeSupervisorDeviceType } from '@/lib/ai/supervisor/request-contracts';
import {
  type HybridMessage,
  normalizeMessagesForCloudRun,
} from '@/lib/ai/utils/message-normalizer';
import { createCloudRunAuthHeaders } from '@/lib/ai-proxy/cloud-run-auth';
import { getRequiredCloudRunConfig } from '@/lib/ai-proxy/cloud-run-config';
import { getAPIAuthContext, withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import {
  createRateLimitIdentityHeaders,
  getRateLimitIdentity,
} from '@/lib/security/rate-limit-identity';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { runWithTraceId } from '@/lib/tracing/async-context';
import {
  createInternalDisclosureFields,
  resolveSupervisorInternalDisclosureMode,
} from '../../internal-disclosure-mode';
import {
  applySanitizedQueryToMessages,
  extractAndValidateQuery,
} from '../../request-utils';
import { requestSchema } from '../../schemas';
import { resolveScopedSessionIds } from '../../session-owner';
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
import {
  AI_FIRST_QUERY_HEADER,
  AI_WARMUP_STARTED_AT_HEADER,
  createDeveloperContextDataParts as buildDeveloperContextDataParts,
  createDeveloperContextStreamPart,
  createSupervisorStreamHeaders,
  normalizeFrontendLocalRouteDecision,
  prependStreamDataPart,
  trackFirstQueryLatency,
} from './stream-response-builder';
import {
  getSupervisorStreamAbortTimeoutMs,
  getSupervisorStreamRetryTimeoutMs,
  isWarmupAwareFirstQuery,
  parseOptionalDurationHeader,
  parseWarmupStartedAt,
} from './stream-timeouts';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;

const STREAM_CIRCUIT_BREAKER_SERVICE = 'cloud-run-supervisor-stream';

type CloudRunStreamFetchResult =
  | { type: 'upstream'; response: Response }
  | { type: 'terminal'; response: Response };

function isSecurityPolicyBlockResponse(
  status: number,
  errorText: string
): boolean {
  if (status !== 400) return false;
  if (!errorText.trim()) return false;

  const lowerText = errorText.toLowerCase();
  if (
    lowerText.includes('prompt_injection') ||
    lowerText.includes('security: blocked input')
  ) {
    return true;
  }

  try {
    const parsed = JSON.parse(errorText) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const record = parsed as Record<string, unknown>;
    return [record.error, record.code, record.message].some(
      (value) =>
        typeof value === 'string' &&
        /prompt_injection|security:\s*blocked input/i.test(value)
    );
  } catch {
    return false;
  }
}

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
      try {
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
          logger.warn(
            '⚠️ [SupervisorStreamV2] Invalid payload:',
            parseResult.error.issues
          );
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request payload',
              details: parseResult.error.issues
                .map((i) => i.message)
                .join(', '),
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
        const queryAsOf = buildJobQueryAsOf(
          new Date().toISOString(),
          queryAsOfDataSlot
        );
        const localRouteDecision = normalizeFrontendLocalRouteDecision(
          rawLocalRouteDecision
        );
        if (rawLocalRouteDecision !== undefined && !localRouteDecision) {
          logger.warn(
            '[SupervisorStreamV2] Ignoring invalid localRouteDecision payload'
          );
        }

        const { sessionId, backendSessionId, cacheSessionId } =
          resolveScopedSessionIds(req, bodySessionId ?? chatSessionId);
        const deviceType = normalizeSupervisorDeviceType(
          req.headers.get('X-Device-Type')
        );
        const rateLimitIdentity = getRateLimitIdentity(req, backendSessionId);
        const rateLimitIdentityHeaders =
          createRateLimitIdentityHeaders(rateLimitIdentity);
        const internalDisclosureMode = resolveSupervisorInternalDisclosureMode(
          getAPIAuthContext(req)
        );
        const internalDisclosureFields = createInternalDisclosureFields({
          mode: internalDisclosureMode,
          audience: 'supervisor',
          subject: backendSessionId,
        });
        const warmupStartedAt = parseWarmupStartedAt(
          req.headers.get(AI_WARMUP_STARTED_AT_HEADER)
        );
        const isFirstQuery = req.headers.get(AI_FIRST_QUERY_HEADER) === '1';
        const isFirstWarmupQuery = isWarmupAwareFirstQuery(
          warmupStartedAt,
          isFirstQuery
        );

        trackFirstQueryLatency({ isFirstQuery, warmupStartedAt, sessionId });

        const queryResult = extractAndValidateQuery(
          messages as HybridMessage[]
        );
        if (!queryResult.ok) {
          if (queryResult.reason === 'blocked') {
            logger.warn(
              `🛡️ [SupervisorStreamV2] Blocked injection: ${queryResult.inputCheck?.patterns.join(', ')}`
            );
            if (queryResult.warning) {
              logger.warn(
                `🛡️ [SupervisorStreamV2] Security warning: ${queryResult.warning}`
              );
            }
            return createStreamPolicyBlockResponse();
          }
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
          logger.warn(
            '⚠️ [SupervisorStreamV2] Invalid normalized messages:',
            normalizedParse.error.issues
          );
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
          logger.error(`❌ [SupervisorStreamV2] ${cloudRunConfig.message}`);
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

        let fallbackReason = 'circuit_breaker_open';
        const fetchResult =
          await executeWithCircuitBreakerAndFallback<CloudRunStreamFetchResult>(
            STREAM_CIRCUIT_BREAKER_SERVICE,
            async () => {
              for (const [i, timeoutMs] of attemptTimeouts.entries()) {
                const attempt = i + 1;
                const hasNextAttempt = i < attemptTimeouts.length - 1;

                try {
                  logger.info(
                    `[SupervisorStreamV2] Cloud Run attempt ${attempt}/${attemptTimeouts.length} (timeout=${timeoutMs}ms)`
                  );
                  const response = await fetch(streamUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'text/event-stream',
                      ...(await createCloudRunAuthHeaders({
                        apiSecret: cloudRunConfig.apiSecret,
                        serviceUrl: streamUrl,
                      })),
                      ...rateLimitIdentityHeaders,
                      ...(traceContext.enabled
                        ? {
                            [TRACEPARENT_HEADER]: traceContext.traceparent,
                            [traceContext.traceIdHeader]: traceContext.traceId,
                          }
                        : {}),
                    },
                    body: JSON.stringify({
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
                    }),
                    signal: AbortSignal.timeout(timeoutMs),
                  });

                  if (response.ok) {
                    return { type: 'upstream', response };
                  }

                  const errorText = await response.text();
                  const status = response.status;
                  const isRetryableStatus =
                    status >= 500 || status === 408 || status === 504;

                  logger.error(
                    `❌ [SupervisorStreamV2] Cloud Run error (attempt ${attempt}): ${status} - ${errorText}`
                  );

                  if (isSecurityPolicyBlockResponse(status, errorText)) {
                    return {
                      type: 'terminal',
                      response: createStreamPolicyBlockResponse(),
                    };
                  }

                  if (isRetryableStatus && hasNextAttempt) {
                    logger.warn(
                      `[SupervisorStreamV2] Retrying after upstream ${status} (attempt ${attempt + 1}/${attemptTimeouts.length})`
                    );
                    continue;
                  }

                  if (isRetryableStatus) {
                    fallbackReason = `cloud_run_${status}`;
                    throw new Error(
                      `Cloud Run retryable status ${status}: ${errorText}`
                    );
                  }

                  return {
                    type: 'terminal',
                    response: createStreamErrorResponse(
                      `AI 엔진 오류 (${status}). 잠시 후 다시 시도해주세요.`
                    ),
                  };
                } catch (error) {
                  if (
                    error instanceof Error &&
                    error.message.startsWith('Cloud Run retryable status')
                  ) {
                    throw error;
                  }

                  // AbortError: 수동 abort | TimeoutError: AbortSignal.timeout() 만료
                  const isAbortError =
                    error instanceof Error &&
                    (error.name === 'AbortError' ||
                      error.name === 'TimeoutError');

                  if (isAbortError && hasNextAttempt) {
                    logger.warn(
                      `[SupervisorStreamV2] Attempt ${attempt} timeout; retrying (${attempt + 1}/${attemptTimeouts.length})`
                    );
                    continue;
                  }

                  if (!isAbortError && hasNextAttempt) {
                    logger.warn(
                      `[SupervisorStreamV2] Attempt ${attempt} failed; retrying (${attempt + 1}/${attemptTimeouts.length})`
                    );
                    continue;
                  }

                  if (isAbortError) {
                    logger.error(
                      '❌ [SupervisorStreamV2] Request timeout, using fallback'
                    );
                    fallbackReason = 'cloud_run_timeout';
                    throw error;
                  }

                  logger.error(
                    '❌ [SupervisorStreamV2] Upstream fetch failed, using fallback'
                  );
                  fallbackReason = 'cloud_run_fetch_failed';
                  throw error;
                }
              }

              fallbackReason = 'cloud_run_unavailable';
              throw new Error('No Cloud Run response after retries');
            },
            async () => ({
              type: 'terminal',
              response: createFallbackStreamResponse(fallbackReason),
            })
          );

        if (fetchResult.source === 'fallback') {
          logger.info(
            `[SupervisorStreamV2] Circuit breaker fallback response (${fallbackReason})`
          );
          return fetchResult.data.response;
        }

        if (fetchResult.data.type === 'terminal') {
          return fetchResult.data.response;
        }

        const cloudRunResponse = fetchResult.data.response;

        if (!cloudRunResponse.body) {
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
        return createStreamErrorResponse(
          'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        );
      }
    });
  })
);
