/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabaseFrom, mockInsert, mockInfo, mockWarn, mockError } =
  vi.hoisted(() => ({
    mockSupabaseFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockInfo: vi.fn(),
    mockWarn: vi.fn(),
    mockError: vi.fn(),
  }));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: { default: {} },
  withRateLimit:
    (
      _rateLimiter: unknown,
      handler: (request: NextRequest) => Promise<Response>
    ) =>
    (request: NextRequest) =>
      handler(request),
}));

vi.mock('@/utils/security/csrf', () => ({
  withCSRFProtection:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('@/lib/logger', () => ({
  aiLogger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('https://openmanager.test/api/ai/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/feedback', () => {
  const originalCloudRunUrl = process.env.CLOUD_RUN_AI_URL;
  const originalCloudRunSecret = process.env.CLOUD_RUN_API_SECRET;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSupabaseFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
    process.env.CLOUD_RUN_AI_URL = 'https://ai-engine.example.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.CLOUD_RUN_AI_URL = originalCloudRunUrl;
    process.env.CLOUD_RUN_API_SECRET = originalCloudRunSecret;
  });

  it('Cloud Run이 trace links를 반환하면 프록시 응답에 그대로 포함한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        traceId: '1234567890abcdef1234567890abcdef',
        traceApiUrl:
          'https://langfuse.example.com/api/public/traces/1234567890abcdef1234567890abcdef',
        dashboardUrl: 'https://langfuse.example.com/project',
        traceUrlStatus: 'available',
        traceUrl:
          'https://langfuse.example.com/project/project-feedback/traces/1234567890abcdef1234567890abcdef',
        monitoringLookupUrl:
          'https://ai-engine.example.run.app/monitoring/traces?q=1234567890abcdef1234567890abcdef&limit=5&includeAuxiliary=true',
      }),
    });

    const response = await POST(
      createRequest({
        messageId: 'msg-1',
        type: 'negative',
        traceId: '1234567890abcdef1234567890abcdef',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.langfuseStatus).toBe('success');
    expect(body.traceId).toBe('1234567890abcdef1234567890abcdef');
    expect(body.traceApiUrl).toBe(
      'https://langfuse.example.com/api/public/traces/1234567890abcdef1234567890abcdef'
    );
    expect(body.dashboardUrl).toBe('https://langfuse.example.com/project');
    expect(body.traceUrlStatus).toBe('available');
    expect(body.traceUrl).toBe(
      'https://langfuse.example.com/project/project-feedback/traces/1234567890abcdef1234567890abcdef'
    );
    expect(body.monitoringLookupUrl).toBe(
      'https://ai-engine.example.run.app/monitoring/traces?q=1234567890abcdef1234567890abcdef&limit=5&includeAuxiliary=true'
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ai-engine.example.run.app/api/ai/feedback',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-secret',
        }),
      })
    );
  });

  it('traceId가 있어도 Cloud Run link payload가 없으면 traceId만 유지한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    const response = await POST(
      createRequest({
        messageId: 'msg-2',
        type: 'positive',
        traceId: 'abcdefabcdefabcdefabcdefabcdefab',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.langfuseStatus).toBe('success');
    expect(body.traceId).toBe('abcdefabcdefabcdefabcdefabcdefab');
    expect(body).not.toHaveProperty('traceApiUrl');
    expect(body).not.toHaveProperty('dashboardUrl');
    expect(body).not.toHaveProperty('traceUrlStatus');
    expect(body).not.toHaveProperty('traceUrl');
    expect(body).not.toHaveProperty('monitoringLookupUrl');
  });

  it('traceId가 없으면 Langfuse 프록시를 건너뛴다', async () => {
    global.fetch = vi.fn();

    const response = await POST(
      createRequest({
        messageId: 'msg-3',
        type: 'positive',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.langfuseStatus).toBe('skipped');
    expect(body).not.toHaveProperty('traceId');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
