import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { HybridMessage } from '@/lib/ai/utils/message-normalizer';
import { getAPIAuthContext } from '@/lib/auth/api-auth';

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

export const NORMALIZED_MESSAGES_SCHEMA = z
  .array(NORMALIZED_MESSAGE_SCHEMA)
  .min(1)
  .max(50);

const MAX_CONTEXT_MESSAGES = 24;

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

export function getStreamOwnerKey(req: NextRequest): string {
  const authContext = getAPIAuthContext(req);
  if (authContext?.userId) {
    return `user:${hashValue(authContext.userId)}`;
  }
  if (authContext?.keyFingerprint) {
    return `api:${authContext.keyFingerprint}`;
  }

  const authSessionId = req.cookies.get('auth_session_id')?.value;
  if (authSessionId) return `guest:${hashValue(authSessionId)}`;

  const supabaseTokenCookie = req.cookies
    .getAll()
    .find((cookie) => /^sb-.*-auth-token$/.test(cookie.name))?.value;
  if (supabaseTokenCookie) return `supa:${hashValue(supabaseTokenCookie)}`;

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
