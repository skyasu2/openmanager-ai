/**
 * Cloud Run AI Supervisor Proxy
 *
 * @endpoint POST /api/ai/supervisor
 *
 * Architecture:
 * - Primary: Cloud Run ai-engine (Multi-Agent System)
 * - Fallback: Simple error response
 * - All AI processing handled by Cloud Run
 *
 * Modules:
 * - schemas.ts: Zod 요청/응답 검증
 * - cache-utils.ts: 캐시 전략
 * - security.ts: Prompt Injection 방어
 * - cloud-run-handler.ts: Cloud Run 프록시 (stream/json)
 * - error-handler.ts: 에러 분류 및 응답
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  generateTraceId,
  getMaxTimeout,
  getMinTimeout,
  getObservabilityConfig,
  normalizeTraceId,
  parseTraceparentTraceId,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import { type AIEndpoint, getAICache } from '@/lib/ai/cache/ai-response-cache';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import {
  logAIRequest,
  logAIResponse,
  startAITimer,
} from '@/lib/ai/observability';
import { normalizeSupervisorDeviceType } from '@/lib/ai/supervisor/request-contracts';
import {
  compressContext,
  shouldCompress,
} from '@/lib/ai/utils/context-compressor';
import {
  type HybridMessage,
  normalizeMessagesForCloudRun,
} from '@/lib/ai/utils/message-normalizer';
import {
  analyzeQueryComplexity,
  calculateDynamicTimeout,
} from '@/lib/ai/utils/query-complexity';
import { isCloudRunEnabled } from '@/lib/ai-proxy/proxy';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { runWithTraceId } from '@/lib/tracing/async-context';
import { isStatusQuery, shouldSkipCache } from './cache-utils';
import { handleCloudRunJson, handleCloudRunStream } from './cloud-run-handler';
import { handleSupervisorError } from './error-handler';
import {
  applySanitizedQueryToMessages,
  extractAndValidateQuery,
} from './request-utils';
import { requestSchema } from './schemas';
import { buildServerContextMessage } from './server-context';
import { resolveScopedSessionIds } from './session-owner';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;

// ============================================================================
// 🧠 Main Handler - Cloud Run Multi-Agent System
// ============================================================================

export const POST = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(async (req: NextRequest) => {
    // 🎯 W3C Trace Context: traceparent 헤더 우선, X-Trace-Id 폴백
    const observabilityConfig = getObservabilityConfig();
    const traceparent = req.headers.get(TRACEPARENT_HEADER);
    const upstreamTraceId = traceparent
      ? parseTraceparentTraceId(traceparent)
      : null;
    const legacyTraceId = req.headers.get(observabilityConfig.traceIdHeader);
    const traceId =
      upstreamTraceId ?? normalizeTraceId(legacyTraceId) ?? generateTraceId();

    // 🎯 AsyncLocalStorage: traceId를 요청 컨텍스트에 저장 → logger 자동 주입
    return runWithTraceId(traceId, async () => {
      if (observabilityConfig.verboseLogging) {
        logger.info(
          `[Supervisor] Request started (upstream: ${upstreamTraceId ? 'yes' : 'no'})`
        );
      }

      try {
        // 1. Zod 스키마 검증
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
          logger.warn(
            '⚠️ [Supervisor] Invalid payload:',
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
          messages,
          sessionId: bodySessionId,
          enableWebSearch,
          enableRAG,
        } = parseResult.data;

        // 2. sessionId를 owner 스코프와 분리해 정규화
        const { sessionId, cacheSessionId, ownerKey } = resolveScopedSessionIds(
          req,
          bodySessionId
        );

        // 3. 사용자 쿼리 추출 + 보안 검사
        const queryResult = extractAndValidateQuery(
          messages as HybridMessage[]
        );

        if (!queryResult.ok) {
          if (queryResult.reason === 'empty_query') {
            return NextResponse.json(
              {
                success: false,
                error: 'Empty query',
                message: '쿼리를 입력해주세요.',
              },
              { status: 400 }
            );
          }
          // blocked
          logger.warn(
            `🛡️ [Supervisor] Blocked injection attempt: ${queryResult.inputCheck?.patterns.join(', ')}`
          );
          if (queryResult.warning) {
            logger.warn(
              `🛡️ [Supervisor] Security warning: ${queryResult.warning}`
            );
          }
          return NextResponse.json(
            {
              success: false,
              error: 'Security: blocked input',
              message: '보안 정책에 의해 차단된 요청입니다.',
              traceId,
            },
            {
              status: 400,
              headers: { [observabilityConfig.traceIdHeader]: traceId },
            }
          );
        }
        const userQuery = queryResult.userQuery;

        // 4. 동적 타임아웃 계산
        const dynamicTimeout = calculateDynamicTimeout(userQuery, {
          messageCount: messages.length,
          minTimeout: getMinTimeout('supervisor'),
          maxTimeout: getMaxTimeout('supervisor'),
        });

        logger.info(`🚀 [Supervisor] Query: "${userQuery.slice(0, 50)}..."`);
        logger.info(
          `📡 [Supervisor] Session: ${sessionId} (owner: ${ownerKey.slice(0, 16)}...)`
        );
        logger.info(`⏱️ [Supervisor] Dynamic timeout: ${dynamicTimeout}ms`);

        // 5. 복잡도 기반 Job Queue 리다이렉트
        const complexity = analyzeQueryComplexity(userQuery);
        const shouldUseJobQueue =
          complexity.level === 'very_complex' ||
          (complexity.level === 'complex' &&
            /보고서|리포트|근본.*원인|장애.*분석/i.test(userQuery));

        if (shouldUseJobQueue) {
          logger.info(
            `🔀 [Supervisor] Redirecting to Job Queue (complexity: ${complexity.level})`
          );
          return NextResponse.json(
            {
              success: true,
              redirect: 'job-queue',
              complexity: complexity.level,
              estimatedTime: Math.round(complexity.recommendedTimeout / 1000),
              message: '복잡한 분석 요청입니다. 비동기 처리로 전환합니다.',
              traceId,
            },
            {
              status: 202,
              headers: {
                'X-Session-Id': sessionId,
                'X-Redirect-Mode': 'job-queue',
                [observabilityConfig.traceIdHeader]: traceId,
              },
            }
          );
        }

        // 6. 캐시 조회
        const skipCache = shouldSkipCache(userQuery, messages.length);
        const cacheEndpoint: AIEndpoint = isStatusQuery(userQuery)
          ? 'supervisor-status'
          : 'supervisor';

        if (!skipCache) {
          const cacheResult = await getAICache(
            cacheSessionId,
            userQuery,
            cacheEndpoint
          );
          if (cacheResult.hit && cacheResult.data?.response) {
            logger.info(
              `📦 [Supervisor] Cache HIT (${cacheResult.source}, ${cacheResult.latencyMs}ms)`
            );
            const acceptHeader = req.headers.get('accept') || '';
            const wantsJsonOnly = acceptHeader === 'application/json';

            if (wantsJsonOnly) {
              return NextResponse.json(
                { ...cacheResult.data, _cached: true, traceId },
                {
                  headers: {
                    'X-Session-Id': sessionId,
                    'X-Cache': 'HIT',
                    [observabilityConfig.traceIdHeader]: traceId,
                  },
                }
              );
            }
            return new NextResponse(cacheResult.data.response, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Session-Id': sessionId,
                'X-Cache': 'HIT',
                'X-Backend': 'cache',
                [observabilityConfig.traceIdHeader]: traceId,
              },
            });
          }
          logger.info(`📦 [Supervisor] Cache MISS`);
        } else {
          logger.info(`📦 [Supervisor] Cache SKIP (context or realtime query)`);
        }

        // 7. Accept 헤더 → stream/json 분기
        const acceptHeaderFinal = req.headers.get('accept') || '';
        const wantsStream = acceptHeaderFinal !== 'application/json';

        // 8. Cloud Run 프록시
        const aiTimer = startAITimer();

        if (isCloudRunEnabled()) {
          logger.info('☁️ [Supervisor] Using Cloud Run backend');

          logAIRequest({
            operation: 'chat',
            system: 'cloud-run',
            model: 'multi-agent',
            sessionId,
            traceId,
            querySummary: userQuery.slice(0, 80),
          });

          const sanitizedMessages = applySanitizedQueryToMessages(
            messages as HybridMessage[],
            userQuery
          );
          const normalizedMessages =
            normalizeMessagesForCloudRun(sanitizedMessages);

          // 서버 메트릭 컨텍스트 주입 (alert 서버만, ~100-200 토큰)
          const contextMessage = await buildServerContextMessage();
          const messagesWithContext = contextMessage
            ? [contextMessage, ...normalizedMessages]
            : normalizedMessages;

          let messagesToSend = messagesWithContext;
          if (shouldCompress(normalizedMessages.length, 4)) {
            const maxCompressedMessages = contextMessage ? 7 : 8;
            const compression = compressContext(normalizedMessages, {
              keepRecentCount: 4,
              maxTotalMessages: maxCompressedMessages,
              maxCharsPerMessage: 1000,
            });
            messagesToSend = contextMessage
              ? [contextMessage, ...compression.messages]
              : compression.messages;
            logger.info(
              `🗜️ [Supervisor] Context compressed: ${compression.originalCount} → ${compression.compressedCount} messages (${compression.compressionRatio}% saved)`
            );
          }

          logger.info(
            `📝 [Supervisor] Normalized ${sanitizedMessages.length} messages → ${messagesToSend.length} for Cloud Run`
          );

          const deviceType = normalizeSupervisorDeviceType(
            req.headers.get('X-Device-Type')
          );

          const handlerParams = {
            messagesToSend,
            sessionId,
            cacheSessionId,
            userQuery,
            dynamicTimeout,
            skipCache,
            cacheEndpoint,
            securityWarning: queryResult.ok ? queryResult.warning : undefined,
            enableWebSearch,
            enableRAG,
            deviceType,
          };

          const response = wantsStream
            ? await handleCloudRunStream(handlerParams)
            : await handleCloudRunJson(handlerParams);

          logAIResponse({
            operation: 'chat',
            system: 'cloud-run',
            model: 'multi-agent',
            latencyMs: aiTimer.elapsed(),
            success: response.ok || response.status < 400,
            agent: complexity.level,
            traceId,
          });

          return response;
        }

        // 9. Fallback: Cloud Run 비활성화
        logger.warn(`⚠️ [Supervisor] Cloud Run disabled, returning fallback`);
        const fallback = createFallbackResponse('supervisor', {
          query: userQuery,
        });

        return NextResponse.json(
          { ...fallback, sessionId, _backend: 'fallback', traceId },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'X-Session-Id': sessionId,
              'Retry-After': '30',
              [observabilityConfig.traceIdHeader]: traceId,
            },
          }
        );
      } catch (error) {
        return handleSupervisorError(error);
      }
    }); // runWithTraceId
  })
);

// ============================================================================
// 📊 Architecture Note
// ============================================================================
//
// All AI agents run on Cloud Run ai-engine:
// - Supervisor (Groq Llama-8b): Intent classification & routing
// - NLQ Agent (Groq Llama-70b): Server metrics queries
// - Analyst Agent (Mistral): Pattern analysis & anomaly detection
// - Reporter Agent (Cerebras): Incident reports & RAG
//
// This proxy forwards all requests to Cloud Run.
//
// ============================================================================
