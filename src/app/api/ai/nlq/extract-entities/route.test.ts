import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateGroq, mockGenerateObject } = vi.hoisted(() => ({
  mockCreateGroq: vi.fn(() => (modelId: string) => ({ modelId })),
  mockGenerateObject: vi.fn(),
}));

vi.mock('@ai-sdk/groq', () => ({
  createGroq: mockCreateGroq,
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
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
    mockGenerateObject.mockResolvedValue({
      object: {
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
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('is protected by rate limiting before invoking Groq', async () => {
    const response = await POST(
      buildRequest(
        { query: 'api-was-dc1-01 CPU 어때?' },
        { 'x-test-rate-limit': 'deny' }
      )
    );

    expect(response.status).toBe(429);
    expect(mockGenerateObject).not.toHaveBeenCalled();
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
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { modelId: 'llama-4-scout-17b-8e-instruct' },
        prompt: 'api-was-dc1-01 CPU 어때?',
      })
    );
  });

  it('does not invoke Groq for empty queries', async () => {
    const response = await POST(buildRequest({ query: '   ' }));

    expect(response.status).toBe(400);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});
