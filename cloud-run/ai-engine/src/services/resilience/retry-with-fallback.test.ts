import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockCheckProviderStatus,
  mockGetCerebrasModel,
  mockGetGroqModel,
  mockGetMistralModel,
  mockGetCerebrasModelId,
  mockGetCerebrasFallbackModelIds,
  mockIsCerebrasToolCallingEnabled,
  mockIsOpenRouterVisionToolCallingEnabled,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockCheckProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: false,
    openrouter: false,
  })),
  mockGetCerebrasModel: vi.fn(() => ({ provider: 'cerebras' })),
  mockGetGroqModel: vi.fn(() => ({ provider: 'groq' })),
  mockGetMistralModel: vi.fn(() => ({ provider: 'mistral' })),
  mockGetCerebrasModelId: vi.fn(() => 'qwen-3-235b-a22b-instruct-2507'),
  mockGetCerebrasFallbackModelIds: vi.fn(() => ['llama3.1-8b']),
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('../ai-sdk/model-provider', () => ({
  getCerebrasModel: mockGetCerebrasModel,
  getGroqModel: mockGetGroqModel,
  getMistralModel: mockGetMistralModel,
  checkProviderStatus: mockCheckProviderStatus,
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
  getCerebrasFallbackModelIds: mockGetCerebrasFallbackModelIds,
  getGroqModelId: vi.fn(() => 'groq-model'),
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isCerebrasLongContextEnabled: vi.fn(() => true),
  isOpenRouterVisionToolCallingEnabled: mockIsOpenRouterVisionToolCallingEnabled,
}));

vi.mock('./circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
  })),
}));

import {
  __resetRetryBudgetForTests,
  generateTextWithRetry,
} from './retry-with-fallback';

describe('generateTextWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockReset();
    __resetRetryBudgetForTests();
    mockCheckProviderStatus.mockReturnValue({
      cerebras: true,
      groq: true,
      mistral: true,
      gemini: false,
      openrouter: false,
    });
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
    mockGetCerebrasModelId.mockReturnValue('qwen-3-235b-a22b-instruct-2507');
    mockGetCerebrasFallbackModelIds.mockReturnValue(['llama3.1-8b']);
  });

  it('falls back to next provider after Cerebras primary and fallback reject tool calling', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('tool_calls are not supported for this model'))
      .mockRejectedValueOnce(new Error('tool_calls are not supported for this model'))
      .mockResolvedValueOnce({
        text: 'ok from groq',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '현재 상태 요약' }],
        tools: {} as Record<string, unknown>,
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.usedFallback).toBe(true);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'cerebras',
      'cerebras',
      'groq',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'llama3.1-8b',
      'groq-model',
    ]);
  });

  it('tries llama3.1-8b as intra-Cerebras fallback before leaving Cerebras', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('Model qwen-3-235b-a22b-instruct-2507 does not exist or 404'))
      .mockResolvedValueOnce({
        text: 'ok from llama fallback',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '현재 상태 요약' }],
        tools: {} as Record<string, unknown>,
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('cerebras');
    expect(result.modelId).toBe('llama3.1-8b');
    expect(result.usedFallback).toBe(true);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'llama3.1-8b',
    ]);
    expect(mockGetGroqModel).not.toHaveBeenCalled();
  });

  it('skips short-context Cerebras fallback for long prompt contexts', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('Model qwen-3-235b-a22b-instruct-2507 does not exist or 404'))
      .mockResolvedValueOnce({
        text: 'ok from groq',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: 'x'.repeat(40_000) }],
        maxOutputTokens: 2048,
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'llama3.1-8b',
      'groq-model',
    ]);
    expect(result.attempts[1]?.error).toContain('context-window');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it('returns failure when every provider rejects tool calling', async () => {
    mockGenerateText.mockRejectedValue(new Error('tool_calls are not supported for this model'));

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '서버 이상 분석' }],
        tools: {} as Record<string, unknown>,
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(false);
    expect(result.usedFallback).toBe(true);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'cerebras',
      'cerebras',
      'groq',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'llama3.1-8b',
      'groq-model',
    ]);
  });

  it('skips Cerebras immediately when tool calling is disabled by env gate', async () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok from groq',
      steps: [],
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '요약해줘' }],
        tools: {} as Record<string, unknown>,
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.error).toContain('tool-calling');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('fails fast when retry budget blocks same-provider retries', async () => {
    mockGenerateText.mockRejectedValue(new Error('Request timeout'));

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '재시도 예산 테스트' }],
      },
      ['groq'],
      {
        maxRetries: 2,
        initialDelayMs: 0,
        maxDelayMs: 0,
        fallbackDelayMs: 0,
        fallbackJitterMs: 0,
        retryBudgetPerMinute: 0,
        timeoutMs: 3000,
      }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.provider).toBe('groq');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('fails fast when retry budget blocks provider fallback', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
      .mockResolvedValueOnce({
        text: 'would have succeeded from fallback provider',
        steps: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: 'fallback 예산 테스트' }],
      },
      ['cerebras', 'groq'],
      {
        maxRetries: 0,
        fallbackDelayMs: 0,
        fallbackJitterMs: 0,
        retryBudgetPerMinute: 0,
        timeoutMs: 3000,
      }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.provider).toBe('cerebras');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight AI SDK call when the retry timeout elapses', async () => {
    vi.useFakeTimers();
    const observed: { signal?: AbortSignal } = {};

    mockGenerateText.mockImplementationOnce(
      (options: { abortSignal?: AbortSignal }) => {
        observed.signal = options.abortSignal;
        return new Promise((_resolve, reject) => {
          options.abortSignal?.addEventListener('abort', () => {
            reject(new Error('aborted by timeout signal'));
          });
        });
      }
    );

    try {
      const resultPromise = generateTextWithRetry(
        {
          messages: [{ role: 'user', content: 'timeout abort test' }],
        },
        ['groq'],
        {
          maxRetries: 0,
          fallbackDelayMs: 0,
          fallbackJitterMs: 0,
          retryBudgetPerMinute: 10,
          timeoutMs: 50,
        }
      );

      await vi.advanceTimersByTimeAsync(50);
      await vi.runOnlyPendingTimersAsync();
      const result = await resultPromise;

      expect(observed.signal).toBeDefined();
      expect(observed.signal?.aborted).toBe(true);
      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]?.error).toMatch(/abort|timeout/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to Mistral as last resort after Groq and Cerebras fail', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
      .mockRejectedValueOnce(new Error('service unavailable: 503'))
      .mockRejectedValueOnce(new Error('service unavailable: 503'))
      .mockResolvedValueOnce({
        text: 'ok from mistral',
        steps: [],
        usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: 'fallback chain smoke' }],
      },
      undefined,
      {
        maxRetries: 0,
        fallbackDelayMs: 0,
        fallbackJitterMs: 0,
        retryBudgetPerMinute: 10,
        timeoutMs: 3000,
      }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('mistral');
    expect(result.usedFallback).toBe(true);
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'groq',
      'cerebras',
      'cerebras',
      'mistral',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'groq-model',
      'qwen-3-235b-a22b-instruct-2507',
      'llama3.1-8b',
      'mistral-large-latest',
    ]);
    expect(mockGetMistralModel).toHaveBeenCalledWith('mistral-large-latest');
  });
});
