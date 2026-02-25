import { DefaultChatTransport } from 'ai';
import type { MutableRefObject } from 'react';
import {
  generateTraceparent,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import { consumeWarmupStartedAtForFirstQuery } from '@/utils/ai-warmup';

function detectDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

interface CreateHybridChatTransportParams {
  apiEndpoint: string;
  traceIdRef: MutableRefObject<string>;
  traceIdHeader: string;
  warmingUpRef: MutableRefObject<boolean>;
  webSearchEnabledRef: MutableRefObject<boolean | undefined>;
}

export function createHybridChatTransport(
  params: CreateHybridChatTransportParams
) {
  const {
    apiEndpoint,
    traceIdRef,
    traceIdHeader,
    warmingUpRef,
    webSearchEnabledRef,
  } = params;

  return new DefaultChatTransport({
    api: apiEndpoint,
    headers: () => {
      const headers: Record<string, string> = {
        [TRACEPARENT_HEADER]: generateTraceparent(traceIdRef.current),
        [traceIdHeader]: traceIdRef.current,
        'X-Device-Type': detectDeviceType(),
      };

      const warmupStartedAt = consumeWarmupStartedAtForFirstQuery();
      if (warmupStartedAt) {
        headers['X-AI-Warmup-Started-At'] = String(warmupStartedAt);
        headers['X-AI-First-Query'] = '1';
      }

      return headers;
    },
    // warmup 동안 web search를 비활성화해 cold start 부하를 낮춘다.
    body: () => ({
      enableWebSearch: warmingUpRef.current
        ? false
        : webSearchEnabledRef.current,
    }),
    prepareReconnectToStreamRequest: ({ id }) => ({
      api: `${apiEndpoint}?sessionId=${id}`,
    }),
  });
}
