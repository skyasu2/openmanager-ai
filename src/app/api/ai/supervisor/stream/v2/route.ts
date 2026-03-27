/**
 * Cloud Run AI Supervisor Stream V2 Proxy
 *
 * @endpoint POST /api/ai/supervisor/stream/v2
 * @endpoint GET /api/ai/supervisor/stream/v2?sessionId=xxx (Resume stream)
 *
 * AI SDK v6 Native UIMessageStream proxy to Cloud Run.
 *
 * Features:
 * - Upstash-compatible resumable stream (polling-based)
 * - Redis List storage for stream chunks
 * - Auto-expire after 10 minutes
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
 * @created 2026-01-24
 * @updated 2026-01-24 - Implemented Upstash-compatible resumable stream
 */

import { generateId } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getFunctionTimeoutReserveMs,
  getMaxTimeout,
  getRouteMaxExecutionMs,
} from '@/config/ai-proxy.config';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import { buildAITimingHeaders, startAITimer } from '@/lib/ai/observability';
import {
  INVALID_SESSION_ID_MESSAGE,
  normalizeSupervisorDeviceType,
  normalizeSupervisorSessionId,
} from '@/lib/ai/supervisor/request-contracts';
import {
  type HybridMessage,
  normalizeMessagesForCloudRun,
} from '@/lib/ai/utils/message-normalizer';
import { getRequiredCloudRunConfig } from '@/lib/ai-proxy/cloud-run-config';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import {
  applySanitizedQueryToMessages,
  extractAndValidateQuery,
} from '../../request-utils';
import { requestSchemaLoose } from '../../schemas';
import { resolveScopedSessionIds } from '../../session-owner';
import {
  createStreamErrorResponse,
  createStreamFallbackResponse,
  getStreamOwnerKey,
  NORMALIZED_MESSAGES_SCHEMA,
  trimMessagesForContext,
  UI_MESSAGE_STREAM_HEADERS,
} from './route-utils';
import {
  clearActiveStreamId,
  getActiveStreamId,
  saveActiveStreamId,
} from './stream-state';
import { createUpstashResumableContext } from './upstash-resumable';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;
const SUPERVISOR_STREAM_ROUTE_MAX_DURATION_SECONDS = maxDuration;
const AI_WARMUP_STARTED_AT_HEADER = 'x-ai-warmup-started-at';
const AI_FIRST_QUERY_HEADER = 'x-ai-first-query';
const WARMUP_SIGNAL_MAX_AGE_MS = 10 * 60 * 1000; // 10분
const STREAM_SOFT_TARGET_TIMEOUT_MS = 50_000;
const STREAM_COLD_START_FIRST_ATTEMPT_TIMEOUT_MS = 45_000;
const STREAM_COLD_START_RETRY_TIMEOUT_MS = 18_000;

function getSupervisorStreamRequestTimeoutMs(): number {
  const routeBudgetMs = getRouteMaxExecutionMs(
    SUPERVISOR_STREAM_ROUTE_MAX_DURATION_SECONDS
  );
  return Math.max(0, routeBudgetMs - getFunctionTimeoutReserveMs());
}

function isWarmupAwareFirstQuery(
  warmupStartedAt: number | null,
  isFirstQuery: boolean
): boolean {
  if (!isFirstQuery || !warmupStartedAt) return false;
  const elapsed = Date.now() - warmupStartedAt;
  return elapsed >= 0 && elapsed <= WARMUP_SIGNAL_MAX_AGE_MS;
}

function getSupervisorStreamAbortTimeoutMs(options?: {
  isFirstQuery?: boolean;
  warmupStartedAt?: number | null;
}): number {
  // Cold start(30-40s) 상황의 첫 질의는 단일 45초 timeout으로 콜드스타트를
  // 충분히 커버한다. UI에 "최대 1분 소요" 안내가 표시되므로 UX 일관성 유지.
  const isFirstWarmupQuery = isWarmupAwareFirstQuery(
    options?.warmupStartedAt ?? null,
    options?.isFirstQuery === true
  );
  const targetTimeout = isFirstWarmupQuery
    ? STREAM_COLD_START_FIRST_ATTEMPT_TIMEOUT_MS
    : STREAM_SOFT_TARGET_TIMEOUT_MS;

  return Math.max(
    0,
    Math.min(
      targetTimeout,
      getMaxTimeout('supervisor'),
      getSupervisorStreamRequestTimeoutMs()
    )
  );
}

function getSupervisorStreamRetryTimeoutMs(
  primaryTimeoutMs: number
): number | null {
  const remainingBudgetMs = Math.max(
    0,
    getSupervisorStreamRequestTimeoutMs() - primaryTimeoutMs
  );
  const retryTimeoutMs = Math.min(
    STREAM_COLD_START_RETRY_TIMEOUT_MS,
    getMaxTimeout('supervisor'),
    remainingBudgetMs
  );

  return retryTimeoutMs > 0 ? retryTimeoutMs : null;
}

function parseWarmupStartedAt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseOptionalDurationHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed);
}

// ============================================================================
// 🔁 GET - Resume Stream (Upstash-compatible polling)
// ============================================================================

const resumeStreamHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const rawSessionId = url.searchParams.get('sessionId');
  const skipParam = url.searchParams.get('skip');

  // 🎯 CODEX Review Fix: skip 파라미터 검증 (NaN/음수 방지)
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
  const ownerKey = getStreamOwnerKey(req);

  logger.info(
    `🔄 [SupervisorStreamV2] Resume request for session: ${sessionId}, skip: ${skipChunks}`
  );

  // Check for active stream in Redis
  const activeStreamId = await getActiveStreamId(sessionId, ownerKey);

  if (!activeStreamId) {
    logger.debug(
      `[SupervisorStreamV2] No active stream for session: ${sessionId}`
    );
    return new Response(null, { status: 204 });
  }

  // Create resumable context and attempt to resume
  const resumableContext = createUpstashResumableContext();
  const streamStatus = await resumableContext.hasExistingStream(activeStreamId);

  if (!streamStatus) {
    logger.debug(
      `[SupervisorStreamV2] Stream not found in Redis: ${activeStreamId}`
    );
    await clearActiveStreamId(sessionId, ownerKey);
    return new Response(null, { status: 204 });
  }

  // 🎯 CODEX Review Fix: completed 상태에서도 남은 chunk 재전송 허용
  // 네트워크 단절 후 복구 시 이미 완료된 스트림도 이어받기 가능
  if (streamStatus === 'completed') {
    logger.info(
      `[SupervisorStreamV2] Stream completed, attempting resume for remaining chunks: ${activeStreamId}`
    );
  }

  // Resume the stream (works for both active and completed)
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

  // 🎯 CODEX Review R3 Fix: 완료된 스트림은 one-shot replay이므로
  // session mapping 즉시 정리 (더 이상 polling 불필요)
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

export const GET = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(resumeStreamHandler)
);

// ============================================================================
// 🌊 POST - Create UIMessageStream (Pass-through, no resumable)
// ============================================================================

export const POST = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(async (req: NextRequest) => {
    try {
      // 1. Validate request (using loose schema - Cloud Run does full validation)
      const body = await req.json();
      const parseResult = requestSchemaLoose.safeParse(body);

      if (!parseResult.success) {
        logger.warn(
          '⚠️ [SupervisorStreamV2] Invalid payload:',
          parseResult.error.issues
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request payload',
            details: parseResult.error.issues.map((i) => i.message).join(', '),
          },
          { status: 400 }
        );
      }

      const {
        messages,
        sessionId: bodySessionId,
        enableWebSearch,
        enableRAG,
      } = parseResult.data;

      // 2. Extract session ID
      const { sessionId, ownerKey } = resolveScopedSessionIds(
        req,
        bodySessionId
      );
      const deviceType = normalizeSupervisorDeviceType(
        req.headers.get('X-Device-Type')
      );
      const warmupStartedAt = parseWarmupStartedAt(
        req.headers.get(AI_WARMUP_STARTED_AT_HEADER)
      );
      const isFirstQuery = req.headers.get(AI_FIRST_QUERY_HEADER) === '1';
      const isFirstWarmupQuery = isWarmupAwareFirstQuery(
        warmupStartedAt,
        isFirstQuery
      );

      if (isFirstQuery && warmupStartedAt) {
        const latencyMs = Date.now() - warmupStartedAt;
        if (latencyMs >= 0 && latencyMs <= 15 * 60 * 1000) {
          logger.info(
            {
              event: 'first_query_latency',
              sessionId,
              first_query_latency_ms: latencyMs,
              warmup_started_at_ms: warmupStartedAt,
            },
            '[AI Warmup] First query latency tracked'
          );
        } else {
          logger.warn(
            {
              event: 'first_query_latency_invalid',
              sessionId,
              warmup_started_at_ms: warmupStartedAt,
              computed_latency_ms: latencyMs,
            },
            '[AI Warmup] Invalid first query latency window'
          );
        }
      }

      // 3. Extract and sanitize query
      const queryResult = extractAndValidateQuery(messages as HybridMessage[]);
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
        }
        return NextResponse.json(
          {
            success: false,
            error:
              queryResult.reason === 'empty_query'
                ? 'Empty query'
                : 'Security: blocked input',
            ...(queryResult.reason === 'blocked' && {
              message: '보안 정책에 의해 차단된 요청입니다.',
            }),
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

      // 4. Normalize messages for Cloud Run
      const sanitizedMessages = applySanitizedQueryToMessages(
        messages as HybridMessage[],
        userQuery
      );
      const trimmedMessages = trimMessagesForContext(sanitizedMessages);
      const normalizedMessages = normalizeMessagesForCloudRun(trimmedMessages);
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

      // 5. Get Cloud Run URL
      const cloudRunConfig = getRequiredCloudRunConfig();
      if (!cloudRunConfig.ok) {
        logger.error(`❌ [SupervisorStreamV2] ${cloudRunConfig.message}`);
        return NextResponse.json(
          { success: false, error: 'Streaming not available' },
          { status: 503 }
        );
      }

      // 6. Generate stream ID for tracking
      const streamId = generateId();

      // Best-effort cleanup for stale stream mapping in same owner/session scope
      try {
        const staleStreamId = await getActiveStreamId(sessionId, ownerKey);
        if (staleStreamId && staleStreamId !== streamId) {
          const cleanupContext = createUpstashResumableContext();
          await cleanupContext.clearStream(staleStreamId);
          await clearActiveStreamId(sessionId, ownerKey);
        }
      } catch (cleanupError) {
        logger.warn(
          { err: cleanupError },
          '[SupervisorStreamV2] Stale stream cleanup failed'
        );
      }

      // 7. Proxy to Cloud Run v2 endpoint
      const streamUrl = `${cloudRunConfig.url}/api/ai/supervisor/stream/v2`;

      logger.info(`🔗 [SupervisorStreamV2] Connecting to: ${streamUrl}`);
      logger.info(`🆔 [SupervisorStreamV2] Stream ID: ${streamId}`);
      const aiTimer = startAITimer();

      try {
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

        let cloudRunResponse: Response | null = null;
        let lastError: unknown = null;

        for (let i = 0; i < attemptTimeouts.length; i++) {
          const attempt = i + 1;
          const timeoutMs = attemptTimeouts[i];
          const hasNextAttempt = i < attemptTimeouts.length - 1;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          try {
            logger.info(
              `[SupervisorStreamV2] Cloud Run attempt ${attempt}/${attemptTimeouts.length} (timeout=${timeoutMs}ms)`
            );
            const response = await fetch(streamUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                // NOTE: API secret in header is safe in transit (HTTPS) but may appear
                // in Cloud Run access logs. Accept this trade-off for standard auth header usage.
                'X-API-Key': cloudRunConfig.apiSecret,
              },
              body: JSON.stringify({
                messages: normalizedMessages,
                sessionId,
                deviceType,
                enableWebSearch,
                enableRAG,
              }),
              signal: controller.signal,
            });

            if (response.ok) {
              cloudRunResponse = response;
              break;
            }

            const errorText = await response.text();
            const status = response.status;
            const isRetryableStatus =
              status >= 500 || status === 408 || status === 504;

            logger.error(
              `❌ [SupervisorStreamV2] Cloud Run error (attempt ${attempt}): ${status} - ${errorText}`
            );

            if (isRetryableStatus && hasNextAttempt) {
              logger.warn(
                `[SupervisorStreamV2] Retrying after upstream ${status} (attempt ${attempt + 1}/${attemptTimeouts.length})`
              );
              continue;
            }

            if (isRetryableStatus) {
              return createStreamFallbackResponse({
                message: fallbackText,
                reason: `cloud_run_${status}`,
                retryAfterMs: fallback.retryAfter,
                headers: buildAITimingHeaders({
                  latencyMs: aiTimer.elapsed(),
                  cacheStatus: 'BYPASS',
                  mode: 'streaming',
                  source: 'fallback',
                }),
              });
            }

            return createStreamErrorResponse(
              `AI 엔진 오류 (${status}). 잠시 후 다시 시도해주세요.`
            );
          } catch (error) {
            lastError = error;
            const isAbortError =
              error instanceof Error && error.name === 'AbortError';

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
              return createStreamFallbackResponse({
                message: fallbackText,
                reason: 'cloud_run_timeout',
                retryAfterMs: fallback.retryAfter,
                headers: buildAITimingHeaders({
                  latencyMs: aiTimer.elapsed(),
                  cacheStatus: 'BYPASS',
                  mode: 'streaming',
                  source: 'fallback',
                }),
              });
            }

            logger.error(
              '❌ [SupervisorStreamV2] Upstream fetch failed, using fallback'
            );
            return createStreamFallbackResponse({
              message: fallbackText,
              reason: 'cloud_run_fetch_failed',
              retryAfterMs: fallback.retryAfter,
              headers: buildAITimingHeaders({
                latencyMs: aiTimer.elapsed(),
                cacheStatus: 'BYPASS',
                mode: 'streaming',
                source: 'fallback',
              }),
            });
          } finally {
            clearTimeout(timeout);
          }
        }

        if (!cloudRunResponse) {
          logger.error(
            '[SupervisorStreamV2] No Cloud Run response after retries, using fallback',
            lastError
          );
          return createStreamFallbackResponse({
            message: fallbackText,
            reason: 'cloud_run_unavailable',
            retryAfterMs: fallback.retryAfter,
            headers: buildAITimingHeaders({
              latencyMs: aiTimer.elapsed(),
              cacheStatus: 'BYPASS',
              mode: 'streaming',
              source: 'fallback',
            }),
          });
        }

        if (!cloudRunResponse.body) {
          return NextResponse.json(
            { success: false, error: 'No response body' },
            { status: 500 }
          );
        }

        // 8. Save stream ID to Redis for tracking
        await saveActiveStreamId(sessionId, streamId, ownerKey);

        // 9. Wrap stream with Upstash-compatible resumable context
        const resumableContext = createUpstashResumableContext();
        const resumableStream = await resumableContext.createNewResumableStream(
          streamId,
          () => cloudRunResponse.body!
        );

        logger.info(`✅ [SupervisorStreamV2] Stream started (resumable)`);

        // 10. Return resumable stream response
        const processingTimeMs = parseOptionalDurationHeader(
          cloudRunResponse.headers.get('x-ai-latency-ms')
        );
        return new Response(resumableStream, {
          headers: {
            ...UI_MESSAGE_STREAM_HEADERS,
            'X-Session-Id': sessionId,
            'X-Stream-Id': streamId,
            'X-Backend': 'cloud-run-stream-v2',
            'X-Stream-Protocol': 'ui-message-stream',
            'X-Resumable': 'true',
            ...buildAITimingHeaders({
              latencyMs: aiTimer.elapsed(),
              processingTimeMs,
              cacheStatus: 'BYPASS',
              mode: 'streaming',
              source: 'cloud-run',
            }),
          },
        });
      } catch (error) {
        // Clear both session mapping and resumable stream data
        await clearActiveStreamId(sessionId, ownerKey);
        const cleanupContext = createUpstashResumableContext();
        await cleanupContext.clearStream(streamId);
        throw error;
      }
    } catch (error) {
      logger.error('❌ [SupervisorStreamV2] Error:', error);
      return createStreamErrorResponse(
        'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
    }
  })
);
