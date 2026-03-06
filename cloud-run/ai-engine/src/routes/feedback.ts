/**
 * Feedback Routes
 *
 * Human feedback (👍/👎) → Langfuse score recording.
 *
 * @version 1.0.0
 * @created 2026-01-31
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { scoreByTraceId } from '../services/observability/langfuse';
import {
  handleApiError,
  handleValidationError,
  jsonSuccess,
} from '../lib/error-handler';
import { logger } from '../lib/logger';

const feedbackSchema = z.object({
  traceId: z
    .string()
    .min(1, 'traceId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'traceId contains invalid characters'),
  score: z.enum(['positive', 'negative']),
});

export const feedbackRouter = new Hono();

/**
 * POST /feedback - Record user feedback as Langfuse score
 *
 * Body: { traceId: string, score: 'positive' | 'negative' }
 */
feedbackRouter.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const parseResult = feedbackSchema.safeParse(body);

    if (!parseResult.success) {
      const errorDetails = parseResult.error.issues.map((i) => i.message).join(', ');
      return handleValidationError(c, `Invalid request: ${errorDetails}`);
    }

    const { traceId, score } = parseResult.data;
    const value = score === 'positive' ? 1 : 0;

    scoreByTraceId(traceId, 'user-feedback', value);

    logger.info({ traceId, score, value }, 'User feedback recorded to Langfuse');

    return jsonSuccess(c, {
      message: 'Feedback recorded',
      traceId,
      score,
    });
  } catch (error) {
    return handleApiError(c, error, 'Feedback');
  }
});
