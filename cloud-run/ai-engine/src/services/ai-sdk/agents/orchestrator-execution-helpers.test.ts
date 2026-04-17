import { describe, expect, it, vi } from 'vitest';

vi.mock('./response-quality', () => ({
  evaluateAgentResponseQuality: vi.fn((_agentName: string, text: string) => ({
    responseChars: text.length,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('./orchestrator-routing', () => ({
  executeForcedRouting: vi.fn(),
  executeWithAgentFactory: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { streamFastPathResponse } from './orchestrator-execution-helpers';

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
