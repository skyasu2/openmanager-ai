/**
 * Jobs Routes Tests
 *
 * POST /jobs/process, GET /jobs/:id, GET /jobs/:id/progress 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/model-config', () => ({
  validateAPIKeys: vi.fn(() => ({ all: true })),
  logAPIKeyStatus: vi.fn(),
}));

vi.mock('../lib/job-notifier', () => ({
  markJobProcessing: vi.fn(async () => {}),
  storeJobResult: vi.fn(async () => {}),
  storeJobError: vi.fn(async () => {}),
  getJobResult: vi.fn(async () => null),
  updateJobProgress: vi.fn(async () => {}),
  isJobNotifierAvailable: vi.fn(() => true),
  getJobProgress: vi.fn(async () => null),
}));

vi.mock('../services/ai-sdk', () => ({
  executeSupervisor: vi.fn(async () => ({
    success: true,
    response: 'AI 응답',
    toolsCalled: ['detectAnomalies'],
    ragSources: [],
    metadata: { provider: 'cerebras', modelId: 'gpt-oss-120b', stepsExecuted: 2, durationMs: 500 },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  })),
  logProviderStatus: vi.fn(),
}));

import { jobsRouter } from './jobs';
import {
  getJobResult,
  isJobNotifierAvailable,
  markJobProcessing,
  storeJobError,
} from '../lib/job-notifier';
import { executeSupervisor } from '../services/ai-sdk';

const app = new Hono();
app.route('/jobs', jobsRouter);

describe('Jobs Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /jobs/process', () => {
    it('유효한 요청으로 job 처리를 완료한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-123',
          messages: [{ role: 'user', content: '서버 상태 확인' }],
          sessionId: 'session-1',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('job-123');
      expect(json.status).toBe('completed');
      expect(vi.mocked(executeSupervisor)).toHaveBeenCalledTimes(1);
    });

    it('jobId 누락 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('jobId');
    });

    it('messages 누락 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'job-456' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('빈 messages 배열 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'job-789', messages: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('Redis 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(isJobNotifierAvailable).mockReturnValueOnce(false);

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-no-redis',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.fallback).toBeDefined();
    });

    it('메시지에 content가 없으면 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-no-content',
          messages: [{ role: 'user' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(storeJobError).toHaveBeenCalled();
    });

    it('process 예외 시 내부 메시지 대신 공개 메시지를 반환한다', async () => {
      vi.mocked(markJobProcessing).mockRejectedValueOnce(
        new Error('provider secret leaked')
      );

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-process-error',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Service unavailable');
      expect(json.error).not.toContain('secret');
    });

    it('동기 처리 예외를 저장할 때 내부 메시지 대신 공개 메시지를 사용한다', async () => {
      vi.mocked(executeSupervisor).mockRejectedValueOnce(
        new Error('provider secret leaked')
      );

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-background-error',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('failed');

      expect(vi.mocked(storeJobError).mock.calls).toContainEqual([
        'job-background-error',
        'Service unavailable',
        expect.any(String),
      ]);
    });
  });

  describe('GET /jobs/:id', () => {
    it('완료된 job 결과를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'completed',
        response: 'AI 분석 결과',
        completedAt: '2026-03-03T00:00:00Z',
        processingTimeMs: 1500,
      });

      const res = await app.request('/jobs/job-done');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('job-done');
      expect(json.status).toBe('completed');
    });

    it('존재하지 않는 job에 404를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce(null);

      const res = await app.request('/jobs/job-missing');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /jobs/:id/progress', () => {
    it('완료된 job의 진행률을 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'completed',
        completedAt: '2026-03-03T00:00:00Z',
        processingTimeMs: 2000,
      });

      const res = await app.request('/jobs/job-prog/progress');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.progress).toBe(100);
      expect(json.status).toBe('completed');
    });

    it('존재하지 않는 job에 404를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce(null);

      const res = await app.request('/jobs/job-none/progress');

      expect(res.status).toBe(404);
    });
  });
});
