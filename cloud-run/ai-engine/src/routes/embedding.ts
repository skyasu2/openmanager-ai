/**
 * Embedding Routes
 *
 * Text embedding endpoints for vector operations.
 *
 * @version 1.0.0
 * @created 2025-12-28
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { createBatchEmbeddings, createEmbedding, getEmbeddingStats } from '../lib/embedding';
import { handleApiError, handleValidationError, jsonSuccess } from '../lib/error-handler';

export const embeddingRouter = new Hono();

/**
 * POST /embedding - Single text embedding
 */
embeddingRouter.post('/', async (c: Context) => {
  try {
    const { text } = await c.req.json();

    if (!text) {
      return handleValidationError(c, 'text is required');
    }

    const result = await createEmbedding(text);
    return c.json(result);
  } catch (error) {
    return handleApiError(c, error, 'Embedding');
  }
});

/**
 * POST /embedding/batch - Batch text embeddings
 */
embeddingRouter.post('/batch', async (c: Context) => {
  try {
    const { texts } = await c.req.json();

    if (!texts || !Array.isArray(texts)) {
      return handleValidationError(c, 'texts array is required');
    }

    const result = await createBatchEmbeddings(texts);
    return c.json(result);
  } catch (error) {
    return handleApiError(c, error, 'Embedding Batch');
  }
});

/**
 * GET /embedding/stats - Embedding service statistics
 */
embeddingRouter.get('/stats', (c: Context) => {
  const stats = getEmbeddingStats();
  return jsonSuccess(c, stats);
});
