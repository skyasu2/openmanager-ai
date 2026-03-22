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
  buildLangfuseTraceUrlFromHtmlPath,
} from '../services/observability/langfuse-url';
import {
  handleApiError,
  handleValidationError,
  jsonSuccess,
} from '../lib/error-handler';
import { logger } from '../lib/logger';

const TRACE_ID_HEX_REGEX = /^[0-9a-f]{32}$/;
const INVALID_TRACE_ID = '0'.repeat(32);
const DEFAULT_TRACE_LINK_LOOKUP_TIMEOUT_MS = 1500;
type FeedbackTraceUrlStatus = 'available' | 'unavailable';
type FeedbackSuccessPayload = {
  message: 'Feedback recorded';
  traceId: string;
  score: 'positive' | 'negative';
  traceApiUrl: string;
  dashboardUrl: string;
  traceUrlStatus: FeedbackTraceUrlStatus;
  traceUrl?: string;
  monitoringLookupUrl: string;
};

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

function getTraceLinkLookupTimeoutMs(): number {
  const raw = process.env.LANGFUSE_TRACE_LINK_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_TRACE_LINK_LOOKUP_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 100
    ? parsed
    : DEFAULT_TRACE_LINK_LOOKUP_TIMEOUT_MS;
}

async function fetchLangfuseTraceUrl(
  traceId: string,
  baseUrl: string
): Promise<string | undefined> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return undefined;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getTraceLinkLookupTimeoutMs()
  );

  try {
    const authToken = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    const response = await fetch(
      `${baseUrl}/api/public/traces/${encodeURIComponent(traceId)}`,
      {
        headers: {
          Authorization: `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json().catch(
      () => null as { htmlPath?: unknown } | null
    )) as { htmlPath?: unknown } | null;

    return buildLangfuseTraceUrlFromHtmlPath(
      typeof payload?.htmlPath === 'string' ? payload.htmlPath : undefined,
      baseUrl
    );
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
    const traceUrl = await fetchLangfuseTraceUrl(traceId, baseUrl);
    const monitoringLookupUrl = new URL(
      '/monitoring/traces',
      getPublicRequestOrigin(c)
    );
    monitoringLookupUrl.searchParams.set('q', traceId);
    monitoringLookupUrl.searchParams.set('limit', '5');
    monitoringLookupUrl.searchParams.set('includeAuxiliary', 'true');

    const responseBody: FeedbackSuccessPayload = {
      message: 'Feedback recorded',
      traceId,
      score,
      traceApiUrl: buildLangfuseTraceApiUrl(traceId, baseUrl),
      dashboardUrl: buildLangfuseDashboardUrl(baseUrl),
      traceUrlStatus: traceUrl ? 'available' : 'unavailable',
      ...(traceUrl && { traceUrl }),
      monitoringLookupUrl: monitoringLookupUrl.toString(),
    };

    return jsonSuccess(c, responseBody);
  } catch (error) {
    return handleApiError(c, error, 'Feedback');
  }
});
