import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockCheckProviderStatus,
  mockGetCerebrasModel,
  mockGetGroqModel,
  mockGetMistralModel,
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
  getCerebrasModelId: vi.fn(() => 'cerebras-model'),
  getGroqModelId: vi.fn(() => 'groq-model'),
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
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
  });

  it('falls back to next provider when first provider rejects tool calling', async () => {
    mockGenerateText
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
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.provider).toBe('cerebras');
    expect(result.attempts[1]?.provider).toBe('groq');
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
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual(['cerebras', 'groq']);
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
});
