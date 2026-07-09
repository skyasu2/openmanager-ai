import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import { z } from 'zod';
import type { HybridMessage } from '@/lib/ai/utils/message-normalizer';

export const UI_MESSAGE_STREAM_HEADERS = {
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
        mimeType: z.enum([
          'image/png',
          'image/jpeg',
          'image/gif',
          'image/webp',
        ]),
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
        mimeType: z.enum([
          'application/pdf',
          'text/plain',
          'text/markdown',
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
        ]),
        name: z.string().max(255).optional(),
      })
    )
    .optional(),
});

export const NORMALIZED_MESSAGES_SCHEMA = z
  .array(NORMALIZED_MESSAGE_SCHEMA)
  .min(1)
  .max(50);

const MAX_CONTEXT_MESSAGES = 24;

export function trimMessagesForContext(
  messages: HybridMessage[]
): HybridMessage[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) {
    return messages;
  }

  const systemMessages = messages.filter((m) => m.role === 'system').slice(-2);
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');
  const tailLimit = Math.max(1, MAX_CONTEXT_MESSAGES - systemMessages.length);

  return [...systemMessages, ...nonSystemMessages.slice(-tailLimit)];
}

export function createStreamErrorResponse(errorMessage: string): Response {
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

export const SECURITY_POLICY_BLOCK_MESSAGE =
  '⚠️ 정책상 처리할 수 없는 요청입니다. 시스템 지시문 공개, 역할 우회, 보안 정책 회피 요청은 처리하지 않습니다. 서버 모니터링 관련 질문으로 다시 요청해주세요.';

export function createStreamPolicyBlockResponse(): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const blockId = `policy-block-${generateId()}`;
      writer.write({ type: 'text-start', id: blockId });
      writer.write({
        type: 'text-delta',
        id: blockId,
        delta: SECURITY_POLICY_BLOCK_MESSAGE,
      });
      writer.write({ type: 'text-end', id: blockId });
      writer.write({
        type: 'data-warning',
        data: {
          code: 'SECURITY_POLICY_BLOCKED',
          message: SECURITY_POLICY_BLOCK_MESSAGE,
          reason: 'prompt_injection_high',
        },
      });
      writer.write({
        type: 'data-done',
        data: {
          success: true,
          blocked: true,
          blockReason: 'prompt_injection_high',
        },
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      'X-AI-Policy-Blocked': 'true',
      'X-AI-Source': 'guardrail',
      'X-AI-Mode': 'streaming',
      'X-AI-Cache-Status': 'BYPASS',
    },
  });
}

interface StreamTextResponseOptions {
  message: string;
  headers?: Record<string, string>;
  dataParts?: Array<{ type: `data-${string}`; data: unknown }>;
}

export function createStreamTextResponse(
  options: StreamTextResponseOptions
): Response {
  const { message, headers = {}, dataParts = [] } = options;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      for (const dataPart of dataParts) {
        writer.write(dataPart);
      }
      const messageId = `cached-${generateId()}`;
      writer.write({ type: 'text-start', id: messageId });
      writer.write({ type: 'text-delta', id: messageId, delta: message });
      writer.write({ type: 'text-end', id: messageId });
      writer.write({
        type: 'data-done',
        data: {
          success: true,
          cached: true,
        },
      });
    },
  });

  return createUIMessageStreamResponse({ stream, headers });
}

interface StreamFallbackResponseOptions {
  message: string;
  reason?: string;
  retryAfterMs?: number;
  headers?: Record<string, string>;
  dataParts?: Array<{ type: `data-${string}`; data: unknown }>;
}

/**
 * Fallback text response for temporary upstream failures.
 * Emits a normal assistant text block (no stream error marker) so UI can recover gracefully.
 */
export function createStreamFallbackResponse(
  options: StreamFallbackResponseOptions
): Response {
  const {
    message,
    reason = 'upstream_unavailable',
    retryAfterMs = 30_000,
    headers = {},
    dataParts = [],
  } = options;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      for (const dataPart of dataParts) {
        writer.write(dataPart);
      }
      const fallbackId = `fallback-${generateId()}`;
      writer.write({ type: 'text-start', id: fallbackId });
      writer.write({ type: 'text-delta', id: fallbackId, delta: message });
      writer.write({ type: 'text-end', id: fallbackId });
      writer.write({
        type: 'data-warning',
        data: {
          code: 'FALLBACK_RESPONSE',
          message: 'AI 엔진 지연으로 기본 응답을 제공합니다.',
          reason,
          retryAfterMs,
        },
      });
      writer.write({
        type: 'data-done',
        data: {
          success: true,
          fallback: true,
          fallbackReason: reason,
        },
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      'X-Fallback-Response': 'true',
      'X-Retry-After': String(retryAfterMs),
      'X-AI-Source': 'fallback',
      'X-AI-Mode': 'streaming',
      'X-AI-Cache-Status': 'BYPASS',
      ...headers,
    },
  });
}
