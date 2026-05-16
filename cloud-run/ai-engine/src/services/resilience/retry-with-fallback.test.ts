import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockCheckProviderStatus,
  mockGetCerebrasModel,
  mockGetGroqModel,
  mockGetMistralModel,
  mockGetZaiModel,
  mockGetCerebrasModelId,
  mockGetCerebrasFallbackModelIds,
  mockIsCerebrasToolCallingEnabled,
  mockIsOpenRouterVisionToolCallingEnabled,
  mockMarkProviderQuotaCooldown,
  mockReconcileProviderQuotaReservation,
  mockReserveProviderQuota,
  mockIsCerebrasModelExpiredByDate,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockCheckProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    zai: true,
    gemini: false,
    openrouter: false,
  })),
  mockGetCerebrasModel: vi.fn(() => ({ provider: 'cerebras' })),
  mockGetGroqModel: vi.fn(() => ({ provider: 'groq' })),
  mockGetMistralModel: vi.fn(() => ({ provider: 'mistral' })),
  mockGetZaiModel: vi.fn(() => ({ provider: 'zai' })),
  mockGetCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
  mockGetCerebrasFallbackModelIds: vi.fn((): string[] => []),
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
  mockMarkProviderQuotaCooldown: vi.fn(() => Promise.resolve()),
  mockReconcileProviderQuotaReservation: vi.fn(() => Promise.resolve()),
  mockReserveProviderQuota: vi.fn(
    (provider: string, estimatedTokens: number, modelId?: string) =>
      Promise.resolve({
        reserved: true,
        provider,
        modelId,
        estimatedTokens,
        status: {},
      })
  ),
  mockIsCerebrasModelExpiredByDate: vi.fn(() => false),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('../ai-sdk/model-provider', () => ({
  getCerebrasModel: mockGetCerebrasModel,
  getGroqModel: mockGetGroqModel,
  getMistralModel: mockGetMistralModel,
  getZaiModel: mockGetZaiModel,
  checkProviderStatus: mockCheckProviderStatus,
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
  getCerebrasFallbackModelIds: mockGetCerebrasFallbackModelIds,
  getGroqModelId: vi.fn(() => 'groq-model'),
  getMistralModelId: vi.fn(() => 'mistral-small-latest'),
  getZaiModelId: vi.fn(() => 'glm-4.5-flash'),
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isCerebrasLongContextEnabled: vi.fn(() => true),
  isOpenRouterVisionToolCallingEnabled: mockIsOpenRouterVisionToolCallingEnabled,
}));

vi.mock('./circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
  })),
}));

vi.mock('./quota-tracker', () => ({
  markProviderQuotaCooldown: mockMarkProviderQuotaCooldown,
  reconcileProviderQuotaReservation: mockReconcileProviderQuotaReservation,
  reserveProviderQuota: mockReserveProviderQuota,
}));

vi.mock('../ai-sdk/provider-model-policy', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../ai-sdk/provider-model-policy')>();
  return {
    ...actual,
    isCerebrasModelExpiredByDate: mockIsCerebrasModelExpiredByDate,
  };
});

import {
  __resetRetryBudgetForTests,
  FALLBACK_ERROR_CODES,
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
      zai: true,
      gemini: false,
      openrouter: false,
    });
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
    mockGetCerebrasModelId.mockReturnValue('llama3.1-8b');
    mockGetCerebrasFallbackModelIds.mockReturnValue([]);
    mockIsCerebrasModelExpiredByDate.mockReturnValue(false);
    mockMarkProviderQuotaCooldown.mockResolvedValue(undefined);
    mockReconcileProviderQuotaReservation.mockResolvedValue(undefined);
    mockReserveProviderQuota.mockImplementation(
      (provider: string, estimatedTokens: number, modelId?: string) =>
        Promise.resolve({
          reserved: true,
          provider,
          modelId,
          estimatedTokens,
          status: {},
        })
    );
  });

  it('falls back to the next provider after the Cerebras runtime rejects tool calling', async () => {
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
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'cerebras',
      'groq',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'llama3.1-8b',
      'groq-model',
    ]);
  });

  it('tries a configured intra-Cerebras fallback before leaving Cerebras', async () => {
    mockGetCerebrasModelId.mockReturnValue('custom-cerebras-model');
    mockGetCerebrasFallbackModelIds.mockReturnValue(['llama3.1-8b']);
    mockGenerateText
      .mockRejectedValueOnce(new Error('Model custom-cerebras-model does not exist or 404'))
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
      'custom-cerebras-model',
      'llama3.1-8b',
    ]);
    expect(mockGetGroqModel).not.toHaveBeenCalled();
  });

  it('skips only deprecated Cerebras models before the SDK call after the runtime deprecation date', async () => {
    mockGetCerebrasFallbackModelIds.mockReturnValue(['gpt-oss-120b']);
    mockIsCerebrasModelExpiredByDate.mockImplementation(
      (modelId: string) => modelId === 'llama3.1-8b'
    );
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok from gpt-oss',
      steps: [],
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '현재 상태 요약' }],
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('cerebras');
    expect(result.modelId).toBe('gpt-oss-120b');
    expect(result.usedFallback).toBe(true);
    expect(mockGetCerebrasModel).toHaveBeenCalledWith('gpt-oss-120b');
    expect(mockGetGroqModel).not.toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'cerebras' },
    });
    expect(result.attempts).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        error: 'CEREBRAS_DEPRECATED:2026-05-27',
      },
      {
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      },
    ]);
  });

  it('keeps Cerebras in the provider loop before the runtime deprecation date', async () => {
    mockIsCerebrasModelExpiredByDate.mockReturnValue(false);
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok from cerebras',
      steps: [],
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '현재 상태 요약' }],
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('cerebras');
    expect(mockGetCerebrasModel).toHaveBeenCalledWith('llama3.1-8b');
    expect(mockGetGroqModel).not.toHaveBeenCalled();
    expect(result.attempts).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
      },
    ]);
  });

  it('skips short-context Cerebras fallback for long prompt contexts', async () => {
    mockGenerateText.mockResolvedValueOnce({
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
      'llama3.1-8b',
      'groq-model',
    ]);
    expect(result.attempts[0]?.error).toContain('context-window');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('honors caller minContextTokens even when prompt estimate is short', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok from groq',
      steps: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '디스크 해결 방법' }],
        tools: {} as Record<string, unknown>,
        requiredCapabilities: {
          requireToolCalling: true,
          minContextTokens: 32_000,
        },
      } as Parameters<typeof generateTextWithRetry>[0],
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'llama3.1-8b',
      'groq-model',
    ]);
    expect(result.attempts[0]?.error).toContain('context-window');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
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
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'cerebras',
      'groq',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'llama3.1-8b',
      'groq-model',
    ]);
  });

  it('skips a provider/model before calling the SDK when quota admission blocks it', async () => {
    mockReserveProviderQuota.mockImplementation(
      (provider: string, estimatedTokens: number, modelId?: string) =>
        Promise.resolve({
          reserved: provider !== 'cerebras',
          provider,
          modelId,
          estimatedTokens,
          status: {},
          reason: provider === 'cerebras' ? 'minute_request_threshold' : undefined,
        })
    );
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok from groq',
      steps: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '현재 상태 요약' }],
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'groq' },
    });
    expect(result.attempts).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        error: 'QUOTA_ADMISSION:minute_request_threshold',
      },
      {
        provider: 'groq',
        modelId: 'groq-model',
      },
    ]);
  });

  it('marks provider cooldown when the SDK returns queue_exceeded', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('429 queue_exceeded'))
      .mockResolvedValueOnce({
        text: 'ok from groq',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: '원인 분석' }],
      },
      ['cerebras', 'groq'],
      { maxRetries: 0, timeoutMs: 3000 }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(mockMarkProviderQuotaCooldown).toHaveBeenCalledWith(
      'cerebras',
      'llama3.1-8b',
      '429 queue_exceeded'
    );
    expect(mockReconcileProviderQuotaReservation).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'cerebras' }),
      0
    );
  });

  it('treats provider 404 and 410 responses as fallback-triggering statuses', () => {
    expect(FALLBACK_ERROR_CODES).toEqual(
      expect.arrayContaining([404, 410, 429, 502, 503, 504])
    );
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

  it('does not let the AI SDK retry Cerebras queue_exceeded before provider fallback', async () => {
    const queueExceeded = Object.assign(
      new Error("We're experiencing high traffic right now! Please try again soon."),
      {
        statusCode: 429,
        data: {
          type: 'too_many_requests_error',
          param: 'queue',
          code: 'queue_exceeded',
        },
      }
    );

    mockGenerateText
      .mockRejectedValueOnce(queueExceeded)
      .mockResolvedValueOnce({
        text: 'ok from groq',
        steps: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });

    const result = await generateTextWithRetry(
      {
        messages: [{ role: 'user', content: 'queue exceeded fallback test' }],
      },
      ['cerebras', 'groq'],
      {
        maxRetries: 2,
        fallbackDelayMs: 0,
        fallbackJitterMs: 0,
        retryBudgetPerMinute: 10,
        timeoutMs: 3000,
      }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      'cerebras',
      'groq',
    ]);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      maxRetries: 0,
    });
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

  it('falls back to Mistral after Groq and Z.AI fail in the default mesh', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
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
      'zai',
      'mistral',
    ]);
    expect(result.attempts.map((attempt) => attempt.modelId)).toEqual([
      'groq-model',
      'glm-4.5-flash',
      'mistral-small-latest',
    ]);
    expect(mockGetMistralModel).toHaveBeenCalledWith('mistral-small-latest');
  });

  it.each([
    {
      label: 'A-B-C',
      order: ['groq', 'zai', 'mistral'] as const,
      expectedModelIds: ['groq-model', 'glm-4.5-flash', 'mistral-small-latest'],
      recoveredProvider: 'mistral',
    },
    {
      label: 'B-C-A',
      order: ['zai', 'mistral', 'groq'] as const,
      expectedModelIds: ['glm-4.5-flash', 'mistral-small-latest', 'groq-model'],
      recoveredProvider: 'groq',
    },
    {
      label: 'C-A-B',
      order: ['mistral', 'groq', 'zai'] as const,
      expectedModelIds: ['mistral-small-latest', 'groq-model', 'glm-4.5-flash'],
      recoveredProvider: 'zai',
    },
  ])(
    'walks the rotated text-provider mesh $label before recovering',
    async ({ order, expectedModelIds, recoveredProvider }) => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
        .mockRejectedValueOnce(new Error('service unavailable: 503'))
        .mockResolvedValueOnce({
          text: `ok from ${recoveredProvider}`,
          steps: [],
          usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
        });

      const result = await generateTextWithRetry(
        {
          messages: [{ role: 'user', content: 'rotated fallback mesh smoke' }],
        },
        [...order],
        {
          maxRetries: 0,
          fallbackDelayMs: 0,
          fallbackJitterMs: 0,
          retryBudgetPerMinute: 10,
          timeoutMs: 3000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe(recoveredProvider);
      expect(result.usedFallback).toBe(true);
      expect(result.attempts.map((attempt) => attempt.provider)).toEqual(order);
      expect(result.attempts.map((attempt) => attempt.modelId)).toEqual(
        expectedModelIds
      );
    }
  );
});
