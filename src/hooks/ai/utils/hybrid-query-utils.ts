import type { UIMessage } from '@ai-sdk/react';

/**
 * 고유 메시지 ID 생성
 * @description crypto.randomUUID 사용 (Date.now() 대비 충돌 방지)
 */
export function generateMessageId(prefix: string = 'msg'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 메시지 배열에서 undefined parts를 정리 (AI SDK 에러 방지)
 *
 * AI SDK가 메시지를 직렬화할 때 undefined parts가 있으면
 * "Cannot read properties of undefined (reading 'text')" 에러 발생
 */
export function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    // parts가 없거나 비어있으면 빈 text part로 대체
    if (!msg.parts || msg.parts.length === 0) {
      return {
        ...msg,
        parts: [{ type: 'text' as const, text: '' }],
      };
    }

    // undefined parts 필터링 및 유효한 text 보장
    const sanitizedParts = msg.parts
      .filter((part): part is NonNullable<typeof part> => part != null)
      .map((part) => {
        // text 타입이면서 text가 undefined인 경우 빈 문자열로 대체
        if (
          part.type === 'text' &&
          typeof (part as { text?: string }).text !== 'string'
        ) {
          return { ...part, text: '' };
        }
        return part;
      });

    // 정리 후에도 parts가 비어있으면 빈 text part 추가
    if (sanitizedParts.length === 0) {
      return {
        ...msg,
        parts: [{ type: 'text' as const, text: '' }],
      };
    }

    return {
      ...msg,
      parts: sanitizedParts,
    };
  });
}
