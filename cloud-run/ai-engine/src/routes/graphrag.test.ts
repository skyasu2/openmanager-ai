/**
 * GraphRAG Routes Tests
 *
 * POST /graphrag/extract, GET /graphrag/stats, GET /graphrag/related/:nodeId 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/llamaindex-rag-service', () => ({
  extractRelationships: vi.fn(async () => [
    { entryId: 'e1', relationships: [{ type: 'related_to', target: 'e2' }] },
    { entryId: 'e2', relationships: [] },
  ]),
  getGraphRAGStats: vi.fn(async () => ({
    totalEntries: 50,
    totalRelationships: 120,
    averageDegree: 2.4,
  })),
  getRelatedKnowledge: vi.fn(async () => [
    { id: 'r1', title: 'Redis OOM', similarity: 0.92 },
    { id: 'r2', title: 'CPU Spike', similarity: 0.85 },
  ]),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { graphragRouter } from './graphrag';
import { extractRelationships, getGraphRAGStats, getRelatedKnowledge } from '../lib/llamaindex-rag-service';

const app = new Hono();
app.route('/graphrag', graphragRouter);

describe('GraphRAG Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /graphrag/extract', () => {
    it('관계를 추출하고 결과를 반환한다', async () => {
      const res = await app.request('/graphrag/extract', {
        method: 'POST',
        body: JSON.stringify({ batchSize: 25 }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.entriesProcessed).toBe(2);
      expect(json.relationshipsCreated).toBe(1);
      expect(extractRelationships).toHaveBeenCalledWith({
        batchSize: 25,
        onlyUnprocessed: true,
      });
    });

    it('기본 batchSize 50을 사용한다', async () => {
      await app.request('/graphrag/extract', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(extractRelationships).toHaveBeenCalledWith({
        batchSize: 50,
        onlyUnprocessed: true,
      });
    });

    it('서비스 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(extractRelationships).mockRejectedValueOnce(new Error('DB not found'));

      const res = await app.request('/graphrag/extract', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(404); // classifyError: 'not found' → 404
    });
  });

  describe('GET /graphrag/stats', () => {
    it('GraphRAG 통계를 반환한다', async () => {
      const res = await app.request('/graphrag/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.totalEntries).toBe(50);
      expect(json.totalRelationships).toBe(120);
    });

    it('통계 조회 실패 시 500을 반환한다', async () => {
      vi.mocked(getGraphRAGStats).mockResolvedValueOnce(null);

      const res = await app.request('/graphrag/stats');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('GET /graphrag/related/:nodeId', () => {
    it('관련 지식을 반환한다', async () => {
      const res = await app.request('/graphrag/related/node-abc');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.nodeId).toBe('node-abc');
      expect(json.relatedCount).toBe(2);
      expect(json.related).toHaveLength(2);
      expect(getRelatedKnowledge).toHaveBeenCalledWith('node-abc', {
        maxHops: 2,
        maxResults: 10,
      });
    });

    it('쿼리 파라미터로 maxHops, maxResults를 지정한다', async () => {
      await app.request('/graphrag/related/node-xyz?maxHops=3&maxResults=5');

      expect(getRelatedKnowledge).toHaveBeenCalledWith('node-xyz', {
        maxHops: 3,
        maxResults: 5,
      });
    });
  });
});
