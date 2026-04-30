import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateTextWithRetry,
  mockGetCerebrasModelId,
} = vi.hoisted(() => ({
  mockGenerateTextWithRetry: vi.fn(),
  mockGetCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
}));

vi.mock('../resilience/retry-with-fallback', () => ({
  generateTextWithRetry: mockGenerateTextWithRetry,
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { generateService } from './generate-service';

describe('CloudRunGenerateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateTextWithRetry.mockResolvedValue({
      success: true,
      provider: 'cerebras',
      modelId: 'llama3.1-8b',
      attempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 25,
        },
      ],
      totalDurationMs: 25,
      usedFallback: false,
      result: {
        text: '정상 응답',
        usage: { inputTokens: 8, outputTokens: 12, totalTokens: 20 },
      },
    });
  });

  it('uses the shared quota-aware provider fallback path for text generation', async () => {
    const result = await generateService.generate('서버 상태 요약', {
      temperature: 0.5,
      maxTokens: 512,
      topP: 0.9,
    });

    expect(result).toMatchObject({
      success: true,
      text: '정상 응답',
      provider: 'cerebras',
      model: 'llama3.1-8b',
      usage: {
        promptTokens: 8,
        completionTokens: 12,
        totalTokens: 20,
      },
    });
    expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
      {
        messages: [{ role: 'user', content: '서버 상태 요약' }],
        temperature: 0.5,
        maxOutputTokens: 512,
        topP: 0.9,
      },
      ['cerebras', 'groq', 'mistral'],
      {
        maxRetries: 0,
        timeoutMs: 30_000,
      }
    );
  });

  it('returns fallback provider metadata when Cerebras is skipped or unavailable', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce({
      success: true,
      provider: 'groq',
      modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
      attempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          error: 'QUOTA_ADMISSION:rpm_exceeded',
          durationMs: 1,
        },
        {
          provider: 'groq',
          modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
          attempt: 1,
          durationMs: 20,
        },
      ],
      totalDurationMs: 21,
      usedFallback: true,
      result: {
        text: 'Groq fallback 응답',
        usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
      },
    });

    const result = await generateService.generate('fallback 확인');

    expect(result).toMatchObject({
      success: true,
      text: 'Groq fallback 응답',
      provider: 'groq',
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      usedFallback: true,
    });
  });

  it('surfaces quota admission failure without calling a raw provider path', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce({
      success: false,
      provider: 'cerebras',
      modelId: 'llama3.1-8b',
      attempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          error: 'QUOTA_ADMISSION:rpm_exceeded',
          durationMs: 1,
        },
      ],
      totalDurationMs: 1,
      usedFallback: false,
    });

    const result = await generateService.generate('quota 확인');

    expect(result).toMatchObject({
      success: false,
      error: 'QUOTA_ADMISSION:rpm_exceeded',
      provider: 'cerebras',
      model: 'llama3.1-8b',
    });
  });

  it('streams through the same quota-aware generation path', async () => {
    const stream = await generateService.generateStream('stream 확인');

    expect(stream).not.toBeNull();
    expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'stream 확인' }],
      }),
      ['cerebras', 'groq', 'mistral'],
      expect.objectContaining({ maxRetries: 0 })
    );

    const body = await new Response(stream).text();
    expect(body).toContain('data:');
    expect(body).toContain('정상 응답');
    expect(body).toContain('[DONE]');
  });
});
