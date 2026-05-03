import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  it('includes the latest local route decision in streaming request bodies', () => {
    createHybridChatTransport({
      apiEndpoint: '/api/ai/supervisor/stream/v2',
      traceIdRef: ref('trace-local-route'),
      traceIdHeader: 'X-Trace-Id',
      webSearchEnabledRef: ref(true),
      ragEnabledRef: ref(false),
      analysisModeRef: ref('thinking'),
      localRouteDecisionRef: ref({
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      }),
    });

    const transportConfig = mockDefaultChatTransport.mock.calls[0]?.[0] as {
      body: () => Record<string, unknown>;
    };

    expect(transportConfig.body()).toMatchObject({
      enableWebSearch: true,
      analysisMode: 'thinking',
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
});
