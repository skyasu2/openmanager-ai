import { describe, expect, it, vi } from 'vitest';

const { mockFinalizeTrace } = vi.hoisted(() => ({
  mockFinalizeTrace: vi.fn(),
}));

vi.mock('../../observability/langfuse', () => ({
  finalizeTrace: mockFinalizeTrace,
}));

import {
  finalizeMultiAgentResponse,
  streamFastPathResponse,
} from './orchestrator-execution-helpers';
import type { MultiAgentResponse } from './orchestrator-types';

describe('streamFastPathResponse contract', () => {
  it('includes totalTokens in done usage', async () => {
    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of streamFastPathResponse('빠른 응답', Date.now())) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(0);
  });
});

describe('orchestrator execution Langfuse metadata', () => {
  it('passes provider attempts and fallback reason into final trace metadata', () => {
    const trace = {
      id: 'trace-id',
      update: vi.fn(),
      score: vi.fn(),
      generation: vi.fn(),
      span: vi.fn(),
      event: vi.fn(),
    };
    const response: MultiAgentResponse = {
      success: true,
      response: 'fallback response',
      handoffs: [{ from: 'Orchestrator', to: 'NLQ Agent', reason: 'Routing' }],
      finalAgent: 'NLQ Agent',
      toolsCalled: ['getServerMetrics'],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      metadata: {
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        totalRounds: 2,
        handoffCount: 1,
        durationMs: 123,
        usedFallback: true,
        fallbackReason: 'rate_limit',
        providerAttempts: [
          {
            provider: 'groq',
            modelId: 'groq-model',
            attempt: 1,
            durationMs: 50,
            error: 'rate limit exceeded: 429',
          },
          {
            provider: 'cerebras',
            modelId: 'llama3.1-8b',
            attempt: 1,
            durationMs: 73,
          },
        ],
      },
    };

    finalizeMultiAgentResponse(trace, response);

    expect(mockFinalizeTrace).toHaveBeenCalledWith(
      trace,
      'fallback response',
      true,
      expect.objectContaining({
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        usedFallback: true,
        fallbackReason: 'rate_limit',
        providerAttempts: response.metadata.providerAttempts,
      })
    );
  });
});
