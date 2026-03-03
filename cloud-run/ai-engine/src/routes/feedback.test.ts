/**
 * Feedback Routes Tests
 *
 * POST /feedback 엔드포인트 (Langfuse score 기록) 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('positive 피드백을 score 1로 기록한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ traceId: 'trace-123', score: 'positive' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.score).toBe('positive');
    expect(scoreByTraceId).toHaveBeenCalledWith('trace-123', 'user-feedback', 1);
  });

  it('negative 피드백을 score 0으로 기록한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ traceId: 'trace-456', score: 'negative' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe('negative');
    expect(scoreByTraceId).toHaveBeenCalledWith('trace-456', 'user-feedback', 0);
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
      body: JSON.stringify({ traceId: 'trace-789', score: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  it('traceId에 특수문자가 포함되면 400을 반환한다', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ traceId: 'trace<script>', score: 'positive' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });
});
