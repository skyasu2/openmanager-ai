/**
 * Embedding Routes Tests
 *
 * POST /embedding, POST /embedding/batch, GET /embedding/stats 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/embedding', () => ({
  createEmbedding: vi.fn(async (text: string) => ({
    embedding: [0.1, 0.2, 0.3],
    model: 'mistral-embed',
    dimensions: 3,
  })),
  createBatchEmbeddings: vi.fn(async (texts: string[]) => ({
    embeddings: texts.map(() => [0.1, 0.2]),
    model: 'mistral-embed',
    dimensions: 2,
    count: texts.length,
  })),
  getEmbeddingStats: vi.fn(() => ({
    totalRequests: 100,
    cacheHits: 30,
    cacheMisses: 70,
  })),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { embeddingRouter } from './embedding';
import { createEmbedding, createBatchEmbeddings } from '../lib/embedding';

const app = new Hono();
app.route('/embedding', embeddingRouter);

describe('Embedding Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /embedding', () => {
    it('단일 텍스트 임베딩을 반환한다', async () => {
      const res = await app.request('/embedding', {
        method: 'POST',
        body: JSON.stringify({ text: '서버 CPU 높음' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(createEmbedding).toHaveBeenCalledWith('서버 CPU 높음');
    });

    it('text 누락 시 400을 반환한다', async () => {
      const res = await app.request('/embedding', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('서비스 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(createEmbedding).mockRejectedValueOnce(new Error('API key invalid'));

      const res = await app.request('/embedding', {
        method: 'POST',
        body: JSON.stringify({ text: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401); // classifyError: 'api key' → 401
    });
  });

  describe('POST /embedding/batch', () => {
    it('배치 임베딩을 반환한다', async () => {
      const res = await app.request('/embedding/batch', {
        method: 'POST',
        body: JSON.stringify({ texts: ['텍스트1', '텍스트2'] }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(2);
      expect(createBatchEmbeddings).toHaveBeenCalledWith(['텍스트1', '텍스트2']);
    });

    it('texts 누락 시 400을 반환한다', async () => {
      const res = await app.request('/embedding/batch', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('texts가 배열이 아닐 때 400을 반환한다', async () => {
      const res = await app.request('/embedding/batch', {
        method: 'POST',
        body: JSON.stringify({ texts: 'not-array' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('100개 초과 시 400을 반환한다', async () => {
      const texts = Array.from({ length: 101 }, (_, i) => `text-${i}`);
      const res = await app.request('/embedding/batch', {
        method: 'POST',
        body: JSON.stringify({ texts }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /embedding/stats', () => {
    it('임베딩 통계를 반환한다', async () => {
      const res = await app.request('/embedding/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.totalRequests).toBe(100);
    });
  });
});
