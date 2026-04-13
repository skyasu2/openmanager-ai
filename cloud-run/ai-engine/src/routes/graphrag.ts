/**
 * GraphRAG Routes
 *
 * Knowledge graph traversal and stats endpoints.
 *
 * @version 1.1.0
 * @created 2025-12-28
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getGraphRAGStats,
  getRelatedKnowledge,
} from '../lib/graphrag-service';
import { handleApiError, handleValidationError, jsonSuccess } from '../lib/error-handler';
import { logger } from '../lib/logger';

export const graphragRouter = new Hono();

/**
 * POST /graphrag/extract - GONE (410)
 *
 * RFC 9110 recommends 410 when a resource is intentionally unavailable and the
 * condition is likely to be permanent. Auto-extraction backfill is no longer
 * part of the runtime API. Manage relationships via seed-knowledge-base.ts.
 */
graphragRouter.post('/extract', async (c: Context) => {
  return c.json(
    { error: 'disabled', message: '/graphrag/extract is disabled. Manage relationships via seed-knowledge-base.ts.' },
    410
  );
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
