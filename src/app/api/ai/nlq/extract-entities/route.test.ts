import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateGroq, mockGenerateText, mockOutputObject } = vi.hoisted(
  () => ({
    mockCreateGroq: vi.fn(() => (modelId: string) => ({ modelId })),
    mockGenerateText: vi.fn(),
    mockOutputObject: vi.fn((config: unknown) => ({
      kind: 'object-output',
      config,
    })),
  })
);

vi.mock('@ai-sdk/groq', () => ({
  createGroq: mockCreateGroq,
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  Output: {
    object: mockOutputObject,
  },
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth:
    (handler: (request: NextRequest) => Promise<Response>) =>
    async (request: NextRequest) => {
      if (request.headers.get('x-test-auth') === 'deny') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handler(request);
    },
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: { aiAnalysis: { name: 'aiAnalysis' } },
  withRateLimit:
    (_limiter: unknown, handler: (request: NextRequest) => Promise<Response>) =>
    async (request: NextRequest) => {
      if (request.headers.get('x-test-rate-limit') === 'deny') {
        return Response.json({ error: 'Too Many Requests' }, { status: 429 });
      }
      return handler(request);
    },
}));

import { POST } from './route';

function buildRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/ai/nlq/extract-entities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/nlq/extract-entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateGroq.mockReturnValue((modelId: string) => ({ modelId }));
    mockOutputObject.mockImplementation((config: unknown) => ({
      kind: 'object-output',
      config,
    }));
    mockGenerateText.mockResolvedValue({
      output: {
        server: 'api-was-dc1-01',
        metric: 'cpu',
        timeRange: '1h',
        confidence: 93,
      },
    });
  });

  it('is protected by auth before invoking Groq', async () => {
    const response = await POST(
      buildRequest(
        { query: 'api-was-dc1-01 CPU 어때?' },
        { 'x-test-auth': 'deny' }
      )
    );

    expect(response.status).toBe(401);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('is protected by rate limiting before invoking Groq', async () => {
    const response = await POST(
      buildRequest(
        { query: 'api-was-dc1-01 CPU 어때?' },
        { 'x-test-rate-limit': 'deny' }
      )
    );

    expect(response.status).toBe(429);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns extracted entities for valid requests', async () => {
    const response = await POST(
      buildRequest({ query: 'api-was-dc1-01 CPU 어때?' })
    );

    await expect(response.json()).resolves.toEqual({
      server: 'api-was-dc1-01',
      metric: 'cpu',
      timeRange: '1h',
      confidence: 93,
    });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { modelId: 'llama-4-scout-17b-8e-instruct' },
        prompt: 'api-was-dc1-01 CPU 어때?',
        temperature: 0,
        maxOutputTokens: 64,
        output: expect.objectContaining({ kind: 'object-output' }),
      })
    );
    expect(mockOutputObject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'nlq_entities',
      })
    );
  });

  it('returns a semantic intent frame without exposing provider implementation names', async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: {
        metric: 'load1',
        timeRange: '24h',
        confidence: 91,
        intentFrame: {
          domain: 'monitoring',
          intent: 'metric_peak',
          scope: 'whole_fleet',
          targets: [],
          metric: 'load1',
          timeWindow: '24h',
          aggregation: 'peak',
          topN: 3,
          ambiguity: 'low',
          confidence: 91,
          provider: 'monitoringPeakMetricEvidenceProvider',
        },
      },
    });

    const response = await POST(
      buildRequest({
        query: '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?',
      })
    );

    await expect(response.json()).resolves.toEqual({
      timeRange: '24h',
      confidence: 91,
      intentFrame: {
        domain: 'monitoring',
        intent: 'metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        topN: 3,
        ambiguity: 'low',
        confidence: 91,
      },
    });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 160,
        output: expect.objectContaining({ kind: 'object-output' }),
      })
    );
  });

  it('does not invoke Groq for empty queries', async () => {
    const response = await POST(buildRequest({ query: '   ' }));

    expect(response.status).toBe(400);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('does not invoke Groq for malformed JSON', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/nlq/extract-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad-json',
      })
    );

    expect(response.status).toBe(400);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('falls back gracefully when structured output generation fails', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('provider unavailable'));

    const response = await POST(
      buildRequest({ query: 'api-was-dc1-01 CPU 어때?' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ confidence: 0 });
  });
});
