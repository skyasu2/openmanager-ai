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
  buildLangfuseDashboardUrl,
  buildLangfuseTraceApiUrl,
} from '../services/observability/langfuse-url';
import {
  handleApiError,
  handleValidationError,
  jsonSuccess,
} from '../lib/error-handler';
import { logger } from '../lib/logger';

const TRACE_ID_HEX_REGEX = /^[0-9a-f]{32}$/;
const INVALID_TRACE_ID = '0'.repeat(32);

const feedbackSchema = z.object({
  traceId: z
    .string()
    .min(1, 'traceId is required')
    .max(128, 'traceId exceeds maximum length')
    .transform((value) => value.trim().toLowerCase().replace(/-/g, ''))
    .refine(
      (value) => TRACE_ID_HEX_REGEX.test(value) && value !== INVALID_TRACE_ID,
      'traceId must be a 32-character lowercase hex string'
    ),
  score: z.enum(['positive', 'negative']),
});

export const feedbackRouter = new Hono();

function getPublicRequestOrigin(c: Context): string {
  const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = c.req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || c.req.header('host')?.split(',')[0]?.trim();

  if (host) {
    return `${forwardedProto || 'https'}://${host}`;
  }

  const fallbackUrl = new URL(c.req.url);
  if (fallbackUrl.protocol === 'http:' && /\.run\.app$/i.test(fallbackUrl.hostname)) {
    fallbackUrl.protocol = 'https:';
  }

  return fallbackUrl.origin;
}

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

    const recorded = scoreByTraceId(traceId, 'user-feedback', value);

    if (!recorded) {
      logger.warn({ traceId, score, value }, 'User feedback not recorded to Langfuse');
      return c.json(
        {
          success: false,
          error: 'Service unavailable',
        },
        503
      );
    }

    logger.info({ traceId, score, value }, 'User feedback recorded to Langfuse');

    const baseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';
    const monitoringLookupUrl = new URL(
      '/monitoring/traces',
      getPublicRequestOrigin(c)
    );
    monitoringLookupUrl.searchParams.set('q', traceId);
    monitoringLookupUrl.searchParams.set('limit', '5');
    monitoringLookupUrl.searchParams.set('includeAuxiliary', 'true');

    return jsonSuccess(c, {
      message: 'Feedback recorded',
      traceId,
      score,
      traceApiUrl: buildLangfuseTraceApiUrl(traceId, baseUrl),
      dashboardUrl: buildLangfuseDashboardUrl(baseUrl),
      monitoringLookupUrl: monitoringLookupUrl.toString(),
    });
  } catch (error) {
    return handleApiError(c, error, 'Feedback');
  }
});
