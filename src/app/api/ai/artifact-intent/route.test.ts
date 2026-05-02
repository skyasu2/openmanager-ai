/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const model = vi.fn((modelId: string) => ({
    provider: 'mistral',
    modelId,
  }));

  return {
    capturedLimiters: [] as Array<{ config?: { maxRequests?: number } }>,
    createMistral: vi.fn(() => model),
    generateObject: vi.fn(),
    model,
  };
});

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: mocks.createMistral,
}));

vi.mock('ai', () => ({
  generateObject: mocks.generateObject,
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    aiAnalysis: {
      config: {
        maxRequests: 10,
        dailyLimit: 100,
      },
    },
  },
  withRateLimit: (
    limiter: { config?: { maxRequests?: number } },
    handler: unknown
  ) => {
    mocks.capturedLimiters.push(limiter);
    return handler;
  },
}));

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/artifact-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  vi.resetModules();
  return import('./route');
}

describe('artifact intent route', () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mocks.capturedLimiters.length = 0;
    mocks.createMistral.mockClear();
    mocks.generateObject.mockReset();
    mocks.model.mockClear();
  });

  it('binds POST to the AI analysis rate limiter', async () => {
    await importRoute();

    expect(mocks.capturedLimiters[0]?.config?.maxRequests).toBe(10);
  });

  it('returns none without calling Mistral when API key is missing', async () => {
    delete process.env.MISTRAL_API_KEY;
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: '장애 리포트 만들어줘' })
    );
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'llm_unavailable' });
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('keeps non-candidate chat behind the local gate', async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: 'CPU 높은 서버 알려줘' })
    );
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'local_gate_none' });
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('runs the local gate before checking provider availability', async () => {
    delete process.env.MISTRAL_API_KEY;
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: 'CPU 높은 서버 알려줘' })
    );
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'local_gate_none' });
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('classifies artifact candidates with deterministic Mistral structured output', async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: { kind: 'incident-report' },
    });
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: '장애 리포트 만들어줘' })
    );
    const body = await response.json();

    expect(body).toEqual({
      kind: 'incident-report',
      reason: 'llm_artifact_classification',
    });
    expect(mocks.createMistral).toHaveBeenCalledWith({
      apiKey: 'test-mistral-key',
    });
    expect(mocks.model).toHaveBeenCalledWith('ministral-3b-latest');
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        maxOutputTokens: 24,
        providerOptions: {
          mistral: {
            strictJsonSchema: true,
            structuredOutputs: true,
          },
        },
      })
    );
  });

  it('maps monitoring-analysis classification', async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: { kind: 'monitoring-analysis' },
    });
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: '트렌드 분석 좀 해줘' })
    );
    const body = await response.json();

    expect(body).toEqual({
      kind: 'monitoring-analysis',
      reason: 'llm_artifact_classification',
    });
  });

  it('falls back to none when Mistral returns none or fails', async () => {
    mocks.generateObject.mockResolvedValueOnce({ object: { kind: 'none' } });
    const { POST } = await importRoute();

    const noneResponse = await POST(
      createPostRequest({ query: '장애 리포트 만들어줘' })
    );
    await expect(noneResponse.json()).resolves.toEqual({
      kind: 'none',
      reason: 'llm_none',
    });

    mocks.generateObject.mockRejectedValueOnce(
      new Error('provider unavailable')
    );
    const errorResponse = await POST(
      createPostRequest({ query: '장애 리포트 만들어줘' })
    );
    await expect(errorResponse.json()).resolves.toEqual({
      kind: 'none',
      reason: 'llm_unavailable',
    });
  });
});
