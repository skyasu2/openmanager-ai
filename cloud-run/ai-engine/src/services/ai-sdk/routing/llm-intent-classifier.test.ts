import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateObject,
  mockGetGroqModel,
} = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
  mockGetGroqModel: vi.fn(() => ({ modelId: 'test-groq-scout' })),
}));

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

vi.mock('../model-provider', () => ({
  getGroqModel: (...args: unknown[]) => mockGetGroqModel(...args),
}));

import {
  classifyRoutingIntentWithLLM,
  clearRoutingIntentClassifierCache,
} from './llm-intent-classifier';

describe('classifyRoutingIntentWithLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRoutingIntentClassifierCache();
  });

  it('maps a structured metrics_query label to Metrics Query Agent', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        agent: 'metrics_query',
        confidence: 0.9,
      },
    });

    await expect(
      classifyRoutingIntentWithLLM('DB vs Cache 비교', { timeoutMs: 100 })
    ).resolves.toEqual({
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.9,
    });
    expect(mockGetGroqModel).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { modelId: 'test-groq-scout' },
        schema: expect.anything(),
        temperature: 0,
      })
    );
    expect(mockGenerateObject.mock.calls[0]?.[0]).toHaveProperty('abortSignal');
    expect(mockGenerateObject.mock.calls[0]?.[0]).not.toHaveProperty('timeout');
  });

  it('returns no specialist override for general labels', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        agent: 'general',
        confidence: 0.88,
      },
    });

    await expect(
      classifyRoutingIntentWithLLM('좋은 오후야', { timeoutMs: 100 })
    ).resolves.toEqual({
      confidence: 0.88,
    });
  });

  it('uses an in-memory cache for repeated normalized queries', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        agent: 'metrics_query',
        confidence: 0.84,
      },
    });

    const first = await classifyRoutingIntentWithLLM(
      '재시작이 필요해?',
      { timeoutMs: 100 }
    );
    const second = await classifyRoutingIntentWithLLM(
      '  재시작이 필요해?  ',
      { timeoutMs: 100 }
    );

    expect(first).toEqual({
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.84,
    });
    expect(second).toEqual(first);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('returns null on timeout so deterministic routing can fall back', async () => {
    mockGenerateObject.mockImplementationOnce(() => new Promise(() => undefined));

    await expect(
      classifyRoutingIntentWithLLM('새로운 표현', { timeoutMs: 5 })
    ).resolves.toBeNull();
  });

  it('returns null on provider or generation errors', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      classifyRoutingIntentWithLLM('신규 라우팅 표현', { timeoutMs: 100 })
    ).resolves.toBeNull();
  });
});
