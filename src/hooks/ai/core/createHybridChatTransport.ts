import { DefaultChatTransport } from 'ai';
import type { MutableRefObject } from 'react';
import {
  generateTraceparent,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';

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
    headers: () => ({
      [TRACEPARENT_HEADER]: generateTraceparent(traceIdRef.current),
      [traceIdHeader]: traceIdRef.current,
    }),
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
