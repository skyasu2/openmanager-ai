/**
 * GraphRAG Routes
 *
 * Knowledge graph relationship extraction and traversal endpoints.
 *
 * @version 1.0.0
 * @created 2025-12-28
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  extractRelationships,
  getGraphRAGStats,
  getRelatedKnowledge,
} from '../lib/graphrag-service';
import { handleApiError, handleValidationError, jsonSuccess } from '../lib/error-handler';
import { logger } from '../lib/logger';

export const graphragRouter = new Hono();

/**
 * POST /graphrag/extract - DISABLED (410)
 *
 * Auto-extraction backfill has been stopped. knowledge_relationships are now
 * managed exclusively via seed-knowledge-base.ts.
 *
 * The underlying extractRelationships() implementation is kept in graphrag-relations.ts
 * pending graph hit-rate telemetry review. Remove once confirmed unused.
 */
graphragRouter.post('/extract', async (c: Context) => {
  // Auto-extraction disabled. Manage relationships via seed-knowledge-base.ts.
  return c.json(
    { error: 'disabled', message: '/graphrag/extract is disabled. Manage relationships via seed-knowledge-base.ts.' },
    410
  );

  // eslint-disable-next-line no-unreachable
  try {
    const payload = await c.req.json();
    const batchSize =
      typeof payload.batchSize === 'number' && Number.isFinite(payload.batchSize)
        ? payload.batchSize
        : 50;
    const titles = Array.isArray(payload.titles)
      ? payload.titles
          .map((value: unknown) => String(value).trim())
          .filter((value: string) => value.length > 0)
      : [];
    const onlyUnprocessed =
      typeof payload.onlyUnprocessed === 'boolean'
        ? payload.onlyUnprocessed
        : titles.length === 0;

    logger.info(
      `[GraphRAG] Starting extraction (triplet materialization, batch: ${batchSize}, onlyUnprocessed: ${onlyUnprocessed}, titles: ${titles.length})`
    );

    const results = await extractRelationships({
      batchSize,
      onlyUnprocessed,
      titles,
    });

    const totalCreated = results.reduce(
      (sum, r) => sum + (r.insertedCount ?? r.materializedCount ?? r.relationships.length),
      0
    );
    const totalUpdated = results.reduce((sum, r) => sum + (r.updatedCount ?? 0), 0);

    logger.info(
      `[GraphRAG] Materialized relationships from ${results.length} entries (created=${totalCreated}, updated=${totalUpdated})`
    );

    return jsonSuccess(c, {
      entriesProcessed: results.length,
      relationshipsCreated: totalCreated,
      relationshipsUpdated: totalUpdated,
      details: results.slice(0, 10), // Return first 10 for brevity
    });
  } catch (error) {
    return handleApiError(c, error, 'GraphRAG Extract');
  }
});

/**
 * GET /graphrag/stats - Get GraphRAG statistics
 */
graphragRouter.get('/stats', async (c: Context) => {
  try {
    const stats = await getGraphRAGStats();

    if (!stats) {
      return c.json({
        success: false,
        error: 'Could not retrieve GraphRAG stats',
        timestamp: new Date().toISOString(),
      }, 500);
    }

    return jsonSuccess(c, stats);
  } catch (error) {
    return handleApiError(c, error, 'GraphRAG Stats');
  }
});

/**
 * GET /graphrag/related/:nodeId - Get related knowledge via graph traversal
 *
 * @param nodeId - UUID of the source knowledge entry
 * @query maxHops - Maximum graph traversal depth (default: 2)
 * @query maxResults - Maximum results to return (default: 10)
 */
graphragRouter.get('/related/:nodeId', async (c: Context) => {
  try {
    const nodeId = c.req.param('nodeId');
    const maxHops = parseInt(c.req.query('maxHops') || '2', 10);
    const maxResults = parseInt(c.req.query('maxResults') || '10', 10);

    if (!nodeId) {
      return handleValidationError(c, 'nodeId is required');
    }

    logger.info(`[GraphRAG] Finding related for ${nodeId} (hops: ${maxHops})`);

    const related = await getRelatedKnowledge(nodeId, {
      maxHops,
      maxResults,
    });

    return jsonSuccess(c, {
      nodeId,
      relatedCount: related.length,
      related,
    });
  } catch (error) {
    return handleApiError(c, error, 'GraphRAG Related');
  }
});
