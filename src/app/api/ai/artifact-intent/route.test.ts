/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const model = vi.fn((modelId: string) => ({
    provider: 'mistral',
    modelId,
  }));

  return {
    capturedLimiters: [] as Array<{ config?: { maxRequests?: number } }>,
    createMistral: vi.fn(() => model),
    generateText: vi.fn(),
    model,
    outputObject: vi.fn((config: unknown) => ({
      kind: 'object-output',
      config,
    })),
  };
});

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: mocks.createMistral,
}));

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  Output: {
    object: mocks.outputObject,
  },
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
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalScalePlanConfirmed = process.env.MISTRAL_SCALE_PLAN_CONFIRMED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
    if (originalScalePlanConfirmed === undefined) {
      delete process.env.MISTRAL_SCALE_PLAN_CONFIRMED;
    } else {
      process.env.MISTRAL_SCALE_PLAN_CONFIRMED = originalScalePlanConfirmed;
    }
  });

  beforeEach(() => {
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    delete process.env.VERCEL_ENV;
    delete process.env.MISTRAL_SCALE_PLAN_CONFIRMED;
    mocks.capturedLimiters.length = 0;
    mocks.createMistral.mockClear();
    mocks.generateText.mockReset();
    mocks.model.mockClear();
    mocks.outputObject.mockReset();
    mocks.outputObject.mockImplementation((config: unknown) => ({
      kind: 'object-output',
      config,
    }));
  });

  it('binds POST to the AI analysis rate limiter', async () => {
    await importRoute();

    expect(mocks.capturedLimiters[0]?.config?.maxRequests).toBe(10);
  });

  it('returns none without calling Mistral when API key is missing', async () => {
    delete process.env.MISTRAL_API_KEY;
    const { POST } = await importRoute();

    const response = await POST(createPostRequest({ query: '보고서 뽑아줘' }));
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'llm_unavailable' });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('keeps non-candidate chat behind the local gate', async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: 'CPU 높은 서버 알려줘' })
    );
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'local_gate_none' });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('runs the local gate before checking provider availability', async () => {
    delete process.env.MISTRAL_API_KEY;
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: 'CPU 높은 서버 알려줘' })
    );
    const body = await response.json();

    expect(body).toEqual({ kind: 'none', reason: 'local_gate_none' });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('blocks the Mistral classifier in production unless Scale plan usage is explicitly confirmed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const { POST } = await importRoute();

    const response = await POST(createPostRequest({ query: '보고서 뽑아줘' }));
    const body = await response.json();

    expect(body).toEqual({
      kind: 'none',
      reason: 'production_llm_gate_disabled',
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('allows the production classifier only when Scale plan usage is confirmed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    process.env.MISTRAL_SCALE_PLAN_CONFIRMED = 'true';
    mocks.generateText.mockResolvedValueOnce({
      output: { kind: 'incident-report' },
    });
    const { POST } = await importRoute();

    const response = await POST(createPostRequest({ query: '보고서 뽑아줘' }));
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'incident-report',
      reason: 'llm_artifact_classification',
      ruleVersion: expect.any(String),
      decidedBy: 'bff',
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('classifies artifact candidates with deterministic Mistral structured output', async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: { kind: 'incident-report' },
    });
    const { POST } = await importRoute();

    const response = await POST(createPostRequest({ query: '보고서 뽑아줘' }));
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'incident-report',
      reason: 'llm_artifact_classification',
      ruleVersion: expect.any(String),
      decidedBy: 'bff',
    });
    expect(mocks.createMistral).toHaveBeenCalledWith({
      apiKey: 'test-mistral-key',
    });
    expect(mocks.model).toHaveBeenCalledWith('ministral-3b-latest');
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ kind: 'object-output' }),
        temperature: 0,
        maxOutputTokens: 24,
        providerOptions: {
          mistral: {
            strictJsonSchema: true,
            structuredOutputs: true,
          },
        },
        timeout: 3000,
      })
    );
    expect(mocks.outputObject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'artifact_intent',
      })
    );
  });

  it('maps monitoring-analysis classification', async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: { kind: 'monitoring-analysis' },
    });
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: '리스크 리포트 뽑아줘' })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'monitoring-analysis',
      reason: 'llm_artifact_classification',
      ruleVersion: expect.any(String),
      decidedBy: 'bff',
    });
  });

  it('falls back to none when Mistral returns none or fails', async () => {
    mocks.generateText.mockResolvedValueOnce({ output: { kind: 'none' } });
    const { POST } = await importRoute();

    const noneResponse = await POST(
      createPostRequest({ query: '보고서 뽑아줘' })
    );
    await expect(noneResponse.json()).resolves.toEqual({
      kind: 'none',
      reason: 'llm_none',
    });

    mocks.generateText.mockRejectedValueOnce(new Error('provider unavailable'));
    const errorResponse = await POST(
      createPostRequest({ query: '보고서 뽑아줘' })
    );
    await expect(errorResponse.json()).resolves.toEqual({
      kind: 'none',
      reason: 'llm_unavailable',
    });
  });

  it('returns deterministic incident-report intent in production without Mistral Scale confirmation', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: '장애 리포트 만들어줘' })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'incident-report',
      reason: 'incident_report_action_pattern',
      ruleVersion: expect.any(String),
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('returns deterministic server-monitoring intent with a resolved server id', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ query: 'api-was-dc1-01 이상감지 분석해줘' })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'server-monitoring-analysis',
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      reason: 'server_monitoring_action_pattern',
      ruleVersion: expect.any(String),
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('returns deterministic server-snapshot and ops-procedure intents without the LLM fallback', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const { POST } = await importRoute();

    const snapshotResponse = await POST(
      createPostRequest({ query: '서버 상태 스냅샷' })
    );
    await expect(snapshotResponse.json()).resolves.toMatchObject({
      kind: 'server-snapshot',
      reason: 'server_snapshot_implicit_artifact_keyword',
      ruleVersion: expect.any(String),
    });

    const procedureResponse = await POST(
      createPostRequest({
        query: 'CPU 임계치 90% 넘으면 슬랙 알림 규칙 만들어줘',
      })
    );
    await expect(procedureResponse.json()).resolves.toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'alert-rule',
      reason: 'ops_procedure_action_pattern',
      ruleVersion: expect.any(String),
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
