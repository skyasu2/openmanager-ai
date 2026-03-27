/**
 * Supervisor 공통 요청 처리 유틸리티
 *
 * supervisor/route.ts 와 supervisor/stream/v2/route.ts 에서
 * 중복되는 요청 처리 로직을 추출한 공유 모듈.
 *
 * @created 2026-02-26
 */

import type { NextRequest } from 'next/server';
import {
  extractLastUserQuery,
  extractTextFromHybridMessage,
  type HybridMessage,
} from '@/lib/ai/utils/message-normalizer';
import type { InjectionDetectionResult } from './security';
import { securityCheck } from './security';

// ============================================================================
// Session ID 추출
// ============================================================================

/**
 * 요청에서 세션 ID를 추출 (Header > Body > QueryParam)
 */
export function resolveSessionId(
  req: NextRequest,
  bodySessionId?: string,
  fallbackId?: string
): string {
  const url = new URL(req.url);
  const headerSessionId = req.headers.get('X-Session-Id');
  const querySessionId = url.searchParams.get('sessionId');
  return headerSessionId || bodySessionId || querySessionId || fallbackId || '';
}

// ============================================================================
// 쿼리 추출 + 보안 검증
// ============================================================================

export type QueryValidationResult =
  | {
      ok: true;
      userQuery: string;
      inputCheck: InjectionDetectionResult;
      warning?: string;
    }
  | {
      ok: false;
      reason: 'empty_query' | 'blocked';
      inputCheck?: InjectionDetectionResult;
      warning?: string;
    };

/**
 * 메시지에서 사용자 쿼리를 추출하고 보안 검사를 수행
 *
 * supervisor/route.ts, stream/v2/route.ts 모두에서 사용하는
 * 공통 패턴을 단일 함수로 추출.
 */
export function extractAndValidateQuery(
  messages: HybridMessage[]
): QueryValidationResult {
  const rawQuery = extractLastUserQuery(messages);

  if (!rawQuery?.trim()) {
    return { ok: false, reason: 'empty_query' };
  }

  const { sanitizedInput, shouldBlock, inputCheck, warning } =
    securityCheck(rawQuery);

  if (shouldBlock) {
    return { ok: false, reason: 'blocked', inputCheck, warning };
  }

  return { ok: true, userQuery: sanitizedInput, inputCheck };
}

function replaceHybridMessageText(
  message: HybridMessage,
  sanitizedQuery: string
): HybridMessage {
  const nextMessage: HybridMessage = {
    ...message,
    content: sanitizedQuery,
  };

  if (!Array.isArray(message.parts)) {
    return nextMessage;
  }

  const nextParts: HybridMessage['parts'] = [];
  let textPartReplaced = false;

  for (const part of message.parts) {
    if (part?.type === 'text') {
      if (!textPartReplaced) {
        nextParts.push({ ...part, text: sanitizedQuery });
        textPartReplaced = true;
      }
      continue;
    }
    nextParts.push(part);
  }

  if (!textPartReplaced) {
    nextParts.unshift({ type: 'text', text: sanitizedQuery });
  }

  nextMessage.parts = nextParts;
  return nextMessage;
}

export function applySanitizedQueryToMessages(
  messages: HybridMessage[],
  sanitizedQuery: string
): HybridMessage[] {
  if (!sanitizedQuery) {
    return messages;
  }

  let targetIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message?.role === 'user' &&
      extractTextFromHybridMessage(message).trim().length > 0
    ) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return messages;
  }

  return messages.map((message, index) =>
    index === targetIndex
      ? replaceHybridMessageText(message, sanitizedQuery)
      : message
  );
}
