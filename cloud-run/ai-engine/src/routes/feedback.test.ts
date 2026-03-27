/**
 * Feedback Routes Tests
 *
 * POST /feedback 엔드포인트 (Langfuse score 기록) 테스트.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/observability/langfuse', () => ({
  scoreByTraceId: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { feedbackRouter } from './feedback';
import { scoreByTraceId } from '../services/observability/langfuse';

const app = new Hono();
app.route('/feedback', feedbackRouter);

describe('Feedback Routes', () => {
  const originalBaseUrl = process.env.LANGFUSE_BASE_URL;
  const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scoreByTraceId).mockReturnValue(true);
    process.env.LANGFUSE_BASE_URL = 'https://langfuse.example.com';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        htmlPath:
          '/project/project-feedback/traces/1234567890abcdef1234567890abcdef',
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.LANGFUSE_BASE_URL = originalBaseUrl;
    process.env.LANGFUSE_PUBLIC_KEY = originalPublicKey;
    process.env.LANGFUSE_SECRET_KEY = originalSecretKey;
  });

  it('positive 피드백을 score 1로 기록한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '12345678-90ab-cdef-1234-567890abcdef',
        score: 'positive',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.score).toBe('positive');
    expect(json.traceApiUrl).toBe(
      'https://langfuse.example.com/api/public/traces/1234567890abcdef1234567890abcdef'
    );
    expect(json.dashboardUrl).toBe('https://langfuse.example.com/project');
    expect(json.traceUrlStatus).toBe('available');
    expect(json.traceUrl).toBe(
      'https://langfuse.example.com/project/project-feedback/traces/1234567890abcdef1234567890abcdef'
    );
    expect(json.monitoringLookupUrl).toBe(
      'http://localhost/monitoring/traces?q=1234567890abcdef1234567890abcdef&limit=5&includeAuxiliary=true'
    );
    expect(scoreByTraceId).toHaveBeenCalledWith(
      '1234567890abcdef1234567890abcdef',
      'user-feedback',
      1
    );
  });

  it('forwarded proto/host 기준으로 public monitoring link를 만든다', async () => {
    const res = await app.request('http://internal/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '1234567890abcdef1234567890abcdef',
        score: 'positive',
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'ai-engine.example.run.app',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.monitoringLookupUrl).toBe(
      'https://ai-engine.example.run.app/monitoring/traces?q=1234567890abcdef1234567890abcdef&limit=5&includeAuxiliary=true'
    );
  });

  it('trace detail lookup가 실패해도 feedback 성공 응답은 유지한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    }) as unknown as typeof fetch;

    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '1234567890abcdef1234567890abcdef',
        score: 'positive',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.traceApiUrl).toBe(
      'https://langfuse.example.com/api/public/traces/1234567890abcdef1234567890abcdef'
    );
    expect(json.traceUrlStatus).toBe('unavailable');
    expect(json).not.toHaveProperty('traceUrl');
  });

  it('negative 피드백을 score 0으로 기록한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: 'ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB',
        score: 'negative',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe('negative');
    expect(scoreByTraceId).toHaveBeenCalledWith(
      'abcdefabcdefabcdefabcdefabcdefab',
      'user-feedback',
      0
    );
  });

  it('traceId 누락 시 400을 반환한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ score: 'positive' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('잘못된 score 값 시 400을 반환한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '1234567890abcdef1234567890abcdef',
        score: 'invalid',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  it('traceId가 32-hex 형식이 아니면 400을 반환한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ traceId: 'trace<script>', score: 'positive' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  it('Langfuse 기록이 거부되면 503을 반환한다', async () => {
    vi.mocked(scoreByTraceId).mockReturnValueOnce(false);

    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '1234567890abcdef1234567890abcdef',
        score: 'positive',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Service unavailable');
  });

  it('내부 예외 메시지를 그대로 노출하지 않는다', async () => {
    vi.mocked(scoreByTraceId).mockImplementationOnce(() => {
      throw new Error('langfuse provider secret leaked');
    });

    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        traceId: '1234567890abcdef1234567890abcdef',
        score: 'positive',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Service unavailable');
    expect(json.error).not.toContain('secret');
  });
});
