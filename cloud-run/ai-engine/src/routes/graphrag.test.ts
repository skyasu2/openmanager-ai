/**
 * GraphRAG Routes Tests
 *
 * POST /graphrag/extract, GET /graphrag/stats, GET /graphrag/related/:nodeId 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/graphrag-service', () => ({
  extractRelationships: vi.fn(async () => [
    {
      entryId: 'e1',
      relationships: [{ type: 'related_to', target: 'e2' }],
      materializedCount: 3,
      insertedCount: 1,
      updatedCount: 2,
    },
    {
      entryId: 'e2',
      relationships: [],
      materializedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
    },
  ]),
  getGraphRAGStats: vi.fn(async () => ({
    totalDocuments: 50,
    totalTriplets: 120,
    totalExtractionEdges: 14,
    lastIndexed: '2026-04-13T01:24:05.870938+00:00',
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
import { extractRelationships, getGraphRAGStats, getRelatedKnowledge } from '../lib/graphrag-service';

const app = new Hono();
app.route('/graphrag', graphragRouter);

describe('GraphRAG Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /graphrag/extract', () => {
    it('비활성화된 엔드포인트로 410을 반환한다', async () => {
      const res = await app.request('/graphrag/extract', {
        method: 'POST',
        body: JSON.stringify({ batchSize: 25 }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('disabled');
    });
  });

  describe('GET /graphrag/stats', () => {
    it('GraphRAG 통계를 반환한다', async () => {
      const res = await app.request('/graphrag/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.totalDocuments).toBe(50);
      expect(json.totalTriplets).toBe(120);
      expect(json.totalExtractionEdges).toBe(14);
      expect(json.lastIndexed).toBe('2026-04-13T01:24:05.870938+00:00');
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
