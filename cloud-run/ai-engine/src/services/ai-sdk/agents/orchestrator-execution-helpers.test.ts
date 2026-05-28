import { describe, expect, it, vi } from 'vitest';

const { mockFinalizeTrace } = vi.hoisted(() => ({
  mockFinalizeTrace: vi.fn(),
}));

vi.mock('../../observability/langfuse', () => ({
  finalizeTrace: mockFinalizeTrace,
}));

import {
  finalizeMultiAgentResponse,
  streamWithTrace,
  streamFastPathResponse,
} from './orchestrator-execution-helpers';
import type { MultiAgentResponse } from './orchestrator-types';

function createTrace() {
  return {
    id: 'trace-id',
    update: vi.fn(),
    score: vi.fn(),
    generation: vi.fn(),
    span: vi.fn(),
    event: vi.fn(),
  };
}

function createMultiAgentResponse(
  durationMs: number
): MultiAgentResponse {
  return {
    success: true,
    response: 'fallback response',
    handoffs: [{ from: 'Orchestrator', to: 'Metrics Query Agent', reason: 'Routing' }],
    finalAgent: 'Metrics Query Agent',
    toolsCalled: ['getServerMetrics'],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    metadata: {
      provider: 'cerebras',
      modelId: 'llama3.1-8b',
      totalRounds: 2,
      handoffCount: 1,
      durationMs,
    },
  };
}

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
    const trace = createTrace();
    const response = createMultiAgentResponse(123);
    response.metadata.usedFallback = true;
    response.metadata.fallbackReason = 'rate_limit';
    response.metadata.providerAttempts = [
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
    ];

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

  it('normalizes non-finite response duration metadata before tracing', () => {
    const trace = createTrace();
    const response = createMultiAgentResponse(Number.NaN);

    const result = finalizeMultiAgentResponse(trace, response);

    expect(result.metadata.durationMs).toBe(0);
    expect(mockFinalizeTrace).toHaveBeenCalledWith(
      trace,
      'fallback response',
      true,
      expect.objectContaining({
        durationMs: 0,
      })
    );
  });

  it('normalizes non-finite stream duration metadata before tracing', async () => {
    const trace = createTrace();

    async function* stream() {
      yield { type: 'text_delta', data: 'stream response' } as const;
      yield {
        type: 'done',
        data: {
          success: true,
          finalAgent: 'Metrics Query Agent',
          metadata: { durationMs: Number.POSITIVE_INFINITY },
        },
      } as const;
    }

    const events = [];
    for await (const event of streamWithTrace(trace, Date.now(), stream())) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    expect(
      (doneEvent?.data as { metadata?: { durationMs?: number } }).metadata
        ?.durationMs
    ).toBe(0);
    expect(mockFinalizeTrace).toHaveBeenCalledWith(
      trace,
      'stream response',
      true,
      expect.objectContaining({
        durationMs: 0,
      })
    );
  });
});
