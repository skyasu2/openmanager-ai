import { DefaultChatTransport } from 'ai';
import type { MutableRefObject } from 'react';
import {
  generateTraceparent,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import { BREAKPOINTS } from '@/config/constants';
import type { SemanticIntentFrame } from '@/lib/ai/entity-extractor';
import type { RouteDecision } from '@/lib/ai/route-decision';
import {
  buildSemanticIntentRequestMetadata,
  type SemanticPreprocessingMetadata,
} from '@/lib/ai/semantic-intent-frame';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type { JobDataSlot } from '@/types/ai-jobs';
import { consumeWarmupStartedAtForFirstQuery } from '@/utils/ai-warmup';
import { buildSourceToolRequestOptions } from './source-tool-request-options';

function detectDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < BREAKPOINTS.MOBILE ? 'mobile' : 'desktop';
}

interface CreateHybridChatTransportParams {
  apiEndpoint: string;
  traceIdRef: MutableRefObject<string>;
  traceIdHeader: string;
  webSearchEnabledRef: MutableRefObject<boolean | undefined>;
  ragEnabledRef: MutableRefObject<boolean | undefined>;
  analysisModeRef: MutableRefObject<AnalysisMode | undefined>;
  queryAsOfDataSlotRef?: MutableRefObject<JobDataSlot | undefined>;
  localRouteDecisionRef?: MutableRefObject<RouteDecision | undefined>;
  currentQueryRef?: MutableRefObject<string | null>;
  semanticIntentFrameRef?: MutableRefObject<
    SemanticIntentFrame | undefined | null
  >;
  semanticPreprocessingRef?: MutableRefObject<
    SemanticPreprocessingMetadata | undefined | null
  >;
}

export function createHybridChatTransport(
  params: CreateHybridChatTransportParams
) {
  const {
    apiEndpoint,
    traceIdRef,
    traceIdHeader,
    webSearchEnabledRef,
    ragEnabledRef,
    analysisModeRef,
    queryAsOfDataSlotRef,
    localRouteDecisionRef,
    currentQueryRef,
    semanticIntentFrameRef,
    semanticPreprocessingRef,
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
    body: () => {
      const semanticIntentPayload = buildSemanticIntentRequestMetadata({
        frame: semanticIntentFrameRef?.current,
        originalQuery: currentQueryRef?.current,
        preprocessing: semanticPreprocessingRef?.current,
      });

      return {
        ...buildSourceToolRequestOptions({
          webSearchEnabled: webSearchEnabledRef.current,
          ragEnabled: ragEnabledRef.current,
        }),
        analysisMode: analysisModeRef.current,
        ...(queryAsOfDataSlotRef?.current && {
          queryAsOfDataSlot: queryAsOfDataSlotRef.current,
        }),
        ...(localRouteDecisionRef?.current && {
          localRouteDecision: localRouteDecisionRef.current,
        }),
        ...semanticIntentPayload,
      };
    },
    prepareReconnectToStreamRequest: ({ id }) => ({
      api: `${apiEndpoint}?sessionId=${id}`,
    }),
  });
}
