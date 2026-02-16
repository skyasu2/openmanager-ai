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

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMaxTimeout } from '@/config/ai-proxy.config';
import {
  extractLastUserQuery,
  type HybridMessage,
  normalizeMessagesForCloudRun,
} from '@/lib/ai/utils/message-normalizer';
import { getAPIAuthContext, withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { requestSchemaLoose } from '../../schemas';
import { securityCheck } from '../../security';
import {
  clearActiveStreamId,
  getActiveStreamId,
  saveActiveStreamId,
} from './stream-state';
import { createUpstashResumableContext } from './upstash-resumable';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js가 정적 분석하므로 리터럴 값 필수. 티어 변경 시 아래 값 수동 변경:
// - Free tier:  export const maxDuration = 10;
// - Pro tier:   export const maxDuration = 60;  ← 현재
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60; // 🔧 현재: Pro tier

// UI Message Stream headers (AI SDK v6 standard)
// 🎯 CRITICAL: x-vercel-ai-ui-message-stream header is REQUIRED for AI SDK v6
// Cloud Run uses createUIMessageStreamResponse which produces UIMessageStream format.
// Without this header, the SDK cannot parse the stream correctly.
// @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
const UI_MESSAGE_STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
};

const NORMALIZED_MESSAGE_SCHEMA = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(50_000),
  images: z
    .array(
      z.object({
        data: z
          .string()
          .min(1)
          .max(14 * 1024 * 1024),
        mimeType: z.string().min(1).max(255),
        name: z.string().max(255).optional(),
      })
    )
    .optional(),
  files: z
    .array(
      z.object({
        data: z
          .string()
          .min(1)
          .max(14 * 1024 * 1024),
        mimeType: z.string().min(1).max(255),
        name: z.string().max(255).optional(),
      })
    )
    .optional(),
});

const NORMALIZED_MESSAGES_SCHEMA = z
  .array(NORMALIZED_MESSAGE_SCHEMA)
  .min(1)
  .max(50);

const MAX_CONTEXT_MESSAGES = 24;

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function getStreamOwnerKey(req: NextRequest): string {
  const authContext = getAPIAuthContext(req);
  if (authContext?.userId) {
    return `user:${hashValue(authContext.userId)}`;
  }
  if (authContext?.keyFingerprint) {
    return `api:${authContext.keyFingerprint}`;
  }

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return `api:${hashValue(apiKey)}`;

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) return `cookie:${hashValue(cookieHeader)}`;

  const testSecret = req.headers.get('x-test-secret');
  if (testSecret) return `test:${hashValue(testSecret)}`;

  const ip =
    req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '';
  const ua = req.headers.get('user-agent') || '';
  return `fp:${hashValue(`${ip}|${ua}`)}`;
}

function trimMessagesForContext(messages: HybridMessage[]): HybridMessage[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) {
    return messages;
  }

  const systemMessages = messages.filter((m) => m.role === 'system').slice(-2);
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');
  const tailLimit = Math.max(1, MAX_CONTEXT_MESSAGES - systemMessages.length);

  return [...systemMessages, ...nonSystemMessages.slice(-tailLimit)];
}

/** Cloud Run 연결 실패 시 UIMessageStream 형식으로 에러 반환 */
function createStreamErrorResponse(errorMessage: string): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const errorId = `error-${generateId()}`;
      writer.write({ type: 'text-start', id: errorId });
      writer.write({
        type: 'text-delta',
        id: errorId,
        delta: `⚠️ 오류: ${errorMessage}`,
      });
      writer.write({ type: 'text-end', id: errorId });
      writer.write({ type: 'error', errorText: errorMessage });
    },
  });

  return createUIMessageStreamResponse({ stream });
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

  const sessionIdResult = z.string().min(8).max(128).safeParse(rawSessionId);
  if (!sessionIdResult.success) {
    return NextResponse.json(
      { error: 'sessionId required (8-128 chars)' },
      { status: 400 }
    );
  }
  const sessionId = sessionIdResult.data;
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
      } = parseResult.data;

      // 2. Extract session ID
      const url = new URL(req.url);
      const headerSessionId = req.headers.get('X-Session-Id');
      const querySessionId = url.searchParams.get('sessionId');
      const sessionId =
        headerSessionId || bodySessionId || querySessionId || generateId();
      const ownerKey = getStreamOwnerKey(req);

      // 3. Extract and sanitize query
      const rawQuery = extractLastUserQuery(messages as HybridMessage[]);
      if (!rawQuery?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Empty query' },
          { status: 400 }
        );
      }
      // Security check: block prompt injection attempts
      const { shouldBlock, inputCheck, sanitizedInput } =
        securityCheck(rawQuery);
      if (shouldBlock) {
        logger.warn(
          `🛡️ [SupervisorStreamV2] Blocked injection: ${inputCheck.patterns.join(', ')}`
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Security: blocked input',
            message: '보안 정책에 의해 차단된 요청입니다.',
          },
          { status: 400 }
        );
      }
      const userQuery = sanitizedInput;

      logger.info(
        `🌊 [SupervisorStreamV2] Query: "${userQuery.slice(0, 50)}..."`
      );
      logger.info(`📡 [SupervisorStreamV2] Session: ${sessionId}`);

      // 4. Normalize messages for Cloud Run
      const trimmedMessages = trimMessagesForContext(
        messages as HybridMessage[]
      );
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
      const cloudRunUrl = process.env.CLOUD_RUN_AI_URL;
      if (!cloudRunUrl) {
        logger.error('❌ [SupervisorStreamV2] CLOUD_RUN_AI_URL not configured');
        return NextResponse.json(
          { success: false, error: 'Streaming not available' },
          { status: 503 }
        );
      }

      // 6. Generate stream ID for tracking
      const streamId = generateId();

      // Best-effort cleanup for stale stream mapping in same owner/session scope
      const staleStreamId = await getActiveStreamId(sessionId, ownerKey);
      if (staleStreamId && staleStreamId !== streamId) {
        const cleanupContext = createUpstashResumableContext();
        await cleanupContext.clearStream(staleStreamId);
        await clearActiveStreamId(sessionId, ownerKey);
      }

      // 7. Proxy to Cloud Run v2 endpoint
      const apiSecret = process.env.CLOUD_RUN_API_SECRET;
      const streamUrl = `${cloudRunUrl}/api/ai/supervisor/stream/v2`;

      logger.info(`🔗 [SupervisorStreamV2] Connecting to: ${streamUrl}`);
      logger.info(`🆔 [SupervisorStreamV2] Stream ID: ${streamId}`);

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        getMaxTimeout('supervisor')
      );

      try {
        const cloudRunResponse = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(apiSecret && { 'X-API-Key': apiSecret }),
          },
          body: JSON.stringify({
            messages: normalizedMessages,
            sessionId,
            enableWebSearch,
          }),
          signal: controller.signal,
        });

        if (!cloudRunResponse.ok) {
          const errorText = await cloudRunResponse.text();
          logger.error(
            `❌ [SupervisorStreamV2] Cloud Run error: ${cloudRunResponse.status} - ${errorText}`
          );

          return createStreamErrorResponse(
            `AI 엔진 오류 (${cloudRunResponse.status}). 잠시 후 다시 시도해주세요.`
          );
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
        return new Response(resumableStream, {
          headers: {
            ...UI_MESSAGE_STREAM_HEADERS,
            'X-Session-Id': sessionId,
            'X-Stream-Id': streamId,
            'X-Backend': 'cloud-run-stream-v2',
            'X-Stream-Protocol': 'ui-message-stream',
            'X-Resumable': 'true',
          },
        });
      } catch (error) {
        // Clear both session mapping and resumable stream data
        await clearActiveStreamId(sessionId, ownerKey);
        const cleanupContext = createUpstashResumableContext();
        await cleanupContext.clearStream(streamId);

        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('❌ [SupervisorStreamV2] Request timeout');
          return createStreamErrorResponse(
            'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          );
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      logger.error('❌ [SupervisorStreamV2] Error:', error);
      return createStreamErrorResponse(
        'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
    }
  })
);
