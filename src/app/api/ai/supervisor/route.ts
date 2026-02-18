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
  parseTraceparentTraceId,
  TRACEPARENT_HEADER,
  traceIdToUUID,
} from '@/config/ai-proxy.config';
import { type AIEndpoint, getAICache } from '@/lib/ai/cache/ai-response-cache';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import {
  compressContext,
  shouldCompress,
} from '@/lib/ai/utils/context-compressor';
import {
  extractLastUserQuery,
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
import { requestSchema } from './schemas';
import { securityCheck } from './security';
import { buildServerContextMessage } from './server-context';

// ============================================================================
// 🔐 사용자 식별 헬퍼
// ============================================================================

function getUserId(req: NextRequest): string {
  // 1. NextAuth 세션 쿠키에서 추출 (실제 인증된 사용자)
  const cookieHeader = req.headers.get('cookie') || '';
  const hasAuthSession =
    cookieHeader.includes('next-auth.session-token') ||
    cookieHeader.includes('__Secure-next-auth.session-token');

  if (hasAuthSession) {
    // 세션 토큰의 해시 prefix를 userId 대용으로 사용
    const sessionMatch = cookieHeader.match(
      /(?:__Secure-)?next-auth\.session-token=([^;]{16})/
    );
    return sessionMatch ? `user_${sessionMatch[1]}` : 'user_authenticated';
  }

  // 2. API 키 인증
  if (req.headers.get('x-api-key')) {
    return 'api_key';
  }

  // 3. Guest / 미인증
  return 'guest';
}

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js가 정적 분석하므로 리터럴 값 필수. 티어 변경 시 아래 값 수동 변경:
// - Free tier:  export const maxDuration = 10;
// - Pro tier:   export const maxDuration = 60;  ← 현재
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60; // 🔧 현재: Pro tier

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
    const traceId = upstreamTraceId
      ? traceIdToUUID(upstreamTraceId)
      : legacyTraceId || generateTraceId();

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

        const { messages, sessionId: bodySessionId } = parseResult.data;

        // 2. sessionId 추출 (Header > Body > Query Param)
        const url = new URL(req.url);
        const headerSessionId = req.headers.get('X-Session-Id');
        const querySessionId = url.searchParams.get('sessionId');
        const clientSessionId =
          headerSessionId || bodySessionId || querySessionId;

        // 3. 사용자 쿼리 추출 + 보안 검사
        const rawQuery = extractLastUserQuery(messages as HybridMessage[]);

        if (!rawQuery || rawQuery.trim() === '') {
          return NextResponse.json(
            {
              success: false,
              error: 'Empty query',
              message: '쿼리를 입력해주세요.',
            },
            { status: 400 }
          );
        }

        const {
          sanitizedInput,
          shouldBlock,
          inputCheck,
          warning: securityWarning,
        } = securityCheck(rawQuery);
        if (shouldBlock) {
          logger.warn(
            `🛡️ [Supervisor] Blocked injection attempt: ${inputCheck.patterns.join(', ')}`
          );
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
        if (securityWarning) {
          logger.warn(`🛡️ [Supervisor] Security warning: ${securityWarning}`);
        }
        const userQuery = sanitizedInput;

        // C4: userId를 sessionId에 결합하여 사용자 간 캐시 충돌 방지
        const userId = getUserId(req);
        const sessionId = `${userId}_${clientSessionId || `session_${Date.now()}`}`;

        // 4. 동적 타임아웃 계산
        const dynamicTimeout = calculateDynamicTimeout(userQuery, {
          messageCount: messages.length,
          minTimeout: getMinTimeout('supervisor'),
          maxTimeout: getMaxTimeout('supervisor'),
        });

        logger.info(`🚀 [Supervisor] Query: "${userQuery.slice(0, 50)}..."`);
        logger.info(`📡 [Supervisor] Session: ${sessionId}`);
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
            sessionId,
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
        if (isCloudRunEnabled()) {
          logger.info('☁️ [Supervisor] Using Cloud Run backend');

          const normalizedMessages = normalizeMessagesForCloudRun(messages);

          // 서버 메트릭 컨텍스트 주입 (alert 서버만, ~100-200 토큰)
          const contextMessage = await buildServerContextMessage();
          const messagesWithContext = contextMessage
            ? [contextMessage, ...normalizedMessages]
            : normalizedMessages;

          let messagesToSend = messagesWithContext;
          if (shouldCompress(normalizedMessages.length, 4)) {
            const compression = compressContext(normalizedMessages, {
              keepRecentCount: 4,
              maxTotalMessages: 8,
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
            `📝 [Supervisor] Normalized ${messages.length} messages → ${messagesToSend.length} for Cloud Run`
          );

          const handlerParams = {
            messagesToSend,
            sessionId,
            userQuery,
            dynamicTimeout,
            skipCache,
            cacheEndpoint,
            securityWarning,
          };

          return wantsStream
            ? handleCloudRunStream(handlerParams)
            : handleCloudRunJson(handlerParams);
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
