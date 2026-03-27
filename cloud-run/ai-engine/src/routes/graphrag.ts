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
} from '../lib/llamaindex-rag-service';
import { handleApiError, handleValidationError, jsonSuccess } from '../lib/error-handler';
import { logger } from '../lib/logger';

export const graphragRouter = new Hono();

/**
 * POST /graphrag/extract - Extract relationships from knowledge base
 *
 * Automatically identifies and stores relationships between knowledge entries.
 * Uses heuristics-only detection (LLM removed 2025-12-28).
 */
graphragRouter.post('/extract', async (c: Context) => {
  try {
    const { batchSize = 50 } = await c.req.json();

    logger.info(`[GraphRAG] Starting extraction (heuristics-only, batch: ${batchSize})`);

    const results = await extractRelationships({
      batchSize,
      onlyUnprocessed: true,
    });

    const totalRelationships = results.reduce((sum, r) => sum + r.relationships.length, 0);

    logger.info(`[GraphRAG] Extracted ${totalRelationships} relationships from ${results.length} entries`);

    return jsonSuccess(c, {
      entriesProcessed: results.length,
      relationshipsCreated: totalRelationships,
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
