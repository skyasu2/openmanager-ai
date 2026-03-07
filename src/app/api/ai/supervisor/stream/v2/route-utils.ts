import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { HybridMessage } from '@/lib/ai/utils/message-normalizer';
import { getSessionOwnerKey } from '../../session-owner';

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

export function getStreamOwnerKey(req: NextRequest): string {
  return getSessionOwnerKey(req);
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
