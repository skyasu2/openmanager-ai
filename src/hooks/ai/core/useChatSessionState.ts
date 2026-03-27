'use client';

import { useMemo } from 'react';
import type { SessionState } from '@/types/session';
import { SESSION_LIMITS } from '@/types/session';

const SESSION_MESSAGE_LIMIT = SESSION_LIMITS.MESSAGE_LIMIT;
const SESSION_WARNING_THRESHOLD = SESSION_LIMITS.WARNING_THRESHOLD;

export function useChatSessionState(
  messageCount: number,
  disableSessionLimit?: boolean
): SessionState {
  return useMemo<SessionState>(() => {
    if (disableSessionLimit) {
      return {
        count: 0,
        remaining: Infinity,
        isWarning: false,
        isLimitReached: false,
      };
    }
    const count = messageCount;
    const remaining = SESSION_MESSAGE_LIMIT - count;
    const isWarning = count >= SESSION_WARNING_THRESHOLD;
    const isLimitReached = count >= SESSION_MESSAGE_LIMIT;

    return { count, remaining, isWarning, isLimitReached };
  }, [messageCount, disableSessionLimit]);
}
