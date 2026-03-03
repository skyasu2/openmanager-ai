/**
 * Generate Routes Tests
 *
 * POST /generate, POST /generate/stream, GET /generate/stats 엔드포인트 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/generate/generate-service', () => ({
  generateService: {
    generate: vi.fn(async (prompt: string) => ({
      text: `응답: ${prompt}`,
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    })),
    generateStream: vi.fn(async () => new ReadableStream()),
    getStats: vi.fn(() => ({
      totalRequests: 42,
      averageLatencyMs: 150,
    })),
  },
}));

vi.mock('../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateRouter } from './generate';
import { generateService } from '../services/generate/generate-service';

const app = new Hono();
app.route('/generate', generateRouter);

describe('Generate Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /generate', () => {
    it('유효한 prompt로 텍스트를 생성한다', async () => {
      const res = await app.request('/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: '서버 상태 요약' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.text).toContain('서버 상태 요약');
      expect(generateService.generate).toHaveBeenCalledWith('서버 상태 요약', {});
    });

    it('prompt 누락 시 400을 반환한다', async () => {
      const res = await app.request('/generate', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('options를 서비스에 전달한다', async () => {
      await app.request('/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', options: { temperature: 0.5 } }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(generateService.generate).toHaveBeenCalledWith('test', { temperature: 0.5 });
    });

    it('서비스 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(generateService.generate).mockRejectedValueOnce(new Error('Model unavailable'));

      const res = await app.request('/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(503);
    });
  });

  describe('POST /generate/stream', () => {
    it('prompt 누락 시 400을 반환한다', async () => {
      const res = await app.request('/generate/stream', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /generate/stats', () => {
    it('통계를 반환한다', async () => {
      const res = await app.request('/generate/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.totalRequests).toBe(42);
    });
  });
});
