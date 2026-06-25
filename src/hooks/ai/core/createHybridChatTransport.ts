import { DefaultChatTransport } from 'ai';
import type { MutableRefObject } from 'react';
import {
  generateTraceparent,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import { BREAKPOINTS } from '@/config/constants';
import type { SemanticIntentFrame } from '@/lib/ai/entity-extractor';
import {
  AI_QA_CORRELATION_STORAGE_KEY,
  type AiQaCorrelationMetadata,
  normalizeAiQaCorrelationMetadata,
} from '@/lib/ai/qa-correlation';
import type { RouteDecision } from '@/lib/ai/route-decision';
import {
  buildSemanticIntentRequestMetadata,
  type SemanticPreprocessingMetadata,
} from '@/lib/ai/semantic-intent-frame';
import type { JobDataSlot } from '@/types/ai-jobs';
import { consumeWarmupStartedAtForFirstQuery } from '@/utils/ai-warmup';
import { buildSourceToolRequestOptions } from './source-tool-request-options';

function detectDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < BREAKPOINTS.MOBILE ? 'mobile' : 'desktop';
}

function getBrowserStorageCandidates(): Storage[] {
  if (typeof window === 'undefined') return [];

  const candidates: Storage[] = [];
  try {
    candidates.push(window.sessionStorage);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  try {
    candidates.push(window.localStorage);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  return candidates;
}

function readStoredAiQaCorrelationMetadata():
  | AiQaCorrelationMetadata
  | undefined {
  if (typeof window === 'undefined') return undefined;

  for (const storage of getBrowserStorageCandidates()) {
    try {
      const raw = storage.getItem(AI_QA_CORRELATION_STORAGE_KEY);
      if (!raw) continue;
      const metadata = normalizeAiQaCorrelationMetadata(JSON.parse(raw));
      if (metadata) return metadata;
    } catch {
      // Invalid QA metadata must never break normal AI chat requests.
    }
  }

  return undefined;
}

interface CreateHybridChatTransportParams {
  apiEndpoint: string;
  traceIdRef: MutableRefObject<string>;
  traceIdHeader: string;
  webSearchEnabledRef: MutableRefObject<boolean | undefined>;
  ragEnabledRef: MutableRefObject<boolean | undefined>;
  sessionIdRef?: MutableRefObject<string | undefined>;
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
    sessionIdRef,
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
      const metadata = {
        ...(semanticIntentPayload.metadata ?? {}),
        ...(readStoredAiQaCorrelationMetadata() ?? {}),
      };

      return {
        ...buildSourceToolRequestOptions({
          webSearchEnabled: webSearchEnabledRef.current,
          ragEnabled: ragEnabledRef.current,
        }),
        ...(sessionIdRef?.current && { sessionId: sessionIdRef.current }),
        ...(queryAsOfDataSlotRef?.current && {
          queryAsOfDataSlot: queryAsOfDataSlotRef.current,
        }),
        ...(localRouteDecisionRef?.current && {
          localRouteDecision: localRouteDecisionRef.current,
        }),
        ...(Object.keys(metadata).length > 0 && { metadata }),
        ...(semanticIntentPayload.semanticQueryTrace && {
          semanticQueryTrace: semanticIntentPayload.semanticQueryTrace,
        }),
      };
    },
  });
}
