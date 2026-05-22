import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SemanticIntentFrame } from '@/lib/ai/entity-extractor';

const { mockDefaultChatTransport } = vi.hoisted(() => ({
  mockDefaultChatTransport: vi.fn(function DefaultChatTransport(config) {
    return { config };
  }),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: mockDefaultChatTransport,
}));

vi.mock('@/config/constants', () => ({
  BREAKPOINTS: { MOBILE: 768 },
}));

vi.mock('@/config/ai-proxy.config', () => ({
  generateTraceparent: () => '00-trace-parent',
  TRACEPARENT_HEADER: 'traceparent',
}));

vi.mock('@/utils/ai-warmup', () => ({
  consumeWarmupStartedAtForFirstQuery: () => null,
}));

import { createHybridChatTransport } from './createHybridChatTransport';

function ref<T>(current: T): MutableRefObject<T> {
  return { current };
}

describe('createHybridChatTransport', () => {
  it('includes the latest sessionId in initial streaming request bodies', () => {
    const sessionIdRef = ref('session-initial-1234');

    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-session-id'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(undefined),
      ragEnabledRef: ref(undefined),
      sessionIdRef,
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      body: () => Record<string, unknown>;
    };

    expect(transportConfig.body()).toMatchObject({
      sessionId: 'session-initial-1234',
    });

    sessionIdRef.current = 'session-next-1234';

    expect(transportConfig.body()).toMatchObject({
      sessionId: 'session-next-1234',
    });
  });

  it('includes the latest local route decision in streaming request bodies', () => {
    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-local-route'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(true),
      ragEnabledRef: ref(false),
      localRouteDecisionRef: ref({
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      }),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      body: () => Record<string, unknown>;
    };

    expect(transportConfig.body()).toMatchObject({
      enableWebSearch: true,
      localRouteDecision: {
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      },
    });
  });

  it('forwards valid semantic intent frames through the AI SDK transport body', () => {
    const semanticIntentFrame: SemanticIntentFrame = {
      domain: 'monitoring',
      intent: 'metric_peak',
      scope: 'whole_fleet',
      targets: [],
      metric: 'load1',
      timeWindow: '24h',
      aggregation: 'peak',
      topN: 3,
      ambiguity: 'low',
      executionMode: 'single',
      confidence: 91,
    };

    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-semantic-frame'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(undefined),
      ragEnabledRef: ref(undefined),
      currentQueryRef: ref('최근 24시간 load1 피크 알려줘'),
      semanticIntentFrameRef: ref(semanticIntentFrame),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      body: () => Record<string, unknown>;
    };

    expect(transportConfig.body()).toMatchObject({
      metadata: {
        intentFrame: {
          domainId: 'openmanager-monitoring',
          capabilityId: 'monitoring.metric_peak',
          confidence: 0.91,
        },
      },
      semanticQueryTrace: {
        originalQuery: '최근 24시간 load1 피크 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
      },
    });
  });

  it('drops low-confidence semantic frames from the transport body but keeps reason codes', () => {
    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-low-confidence-frame'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(undefined),
      ragEnabledRef: ref(undefined),
      currentQueryRef: ref('최근 24시간 load1 피크 알려줘'),
      semanticIntentFrameRef: ref({
        domain: 'monitoring',
        intent: 'metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 79,
      }),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      body: () => Record<string, unknown>;
    };
    const body = transportConfig.body();

    expect(body.metadata).toBeUndefined();
    expect(body.semanticQueryTrace).toMatchObject({
      reasonCodes: ['semantic_frame_low_confidence'],
    });
  });

  it('forwards NLQ preprocessing metadata through the streaming transport body', () => {
    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-log-preprocess'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(undefined),
      ragEnabledRef: ref(undefined),
      currentQueryRef: ref('ERROR 로그 분석해줘'),
      semanticPreprocessingRef: ref({
        inputType: 'log_paste',
        logExtract: 'ERROR api-was-dc1-01 timeout',
      }),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      body: () => Record<string, unknown>;
    };

    expect(transportConfig.body()).toMatchObject({
      metadata: {
        inputType: 'log_paste',
        logExtract: 'ERROR api-was-dc1-01 timeout',
      },
    });
  });

  it('does not advertise unsupported AI SDK stream resume requests', () => {
    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-no-resume'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(undefined),
      ragEnabledRef: ref(undefined),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls.at(-1)?.[0] as {
      prepareReconnectToStreamRequest?: unknown;
    };

    expect(transportConfig.prepareReconnectToStreamRequest).toBeUndefined();
  });
});
