/**
 * Supervisor trace helpers
 */

const TRACE_ID_HEX_REGEX = /^[0-9a-f]{32}$/;
const INVALID_TRACE_ID = '0'.repeat(32);

function normalizeTraceId(traceId?: string): string | undefined {
  if (typeof traceId !== 'string') {
    return undefined;
  }

  const normalized = traceId.trim().toLowerCase().replace(/-/g, '');
  if (!TRACE_ID_HEX_REGEX.test(normalized) || normalized === INVALID_TRACE_ID) {
    return undefined;
  }

  return normalized;
}

/**
 * Extract trace ID from W3C `traceparent` or legacy `x-trace-id` header.
 */
export function extractTraceId(
  traceparent: string | undefined,
  legacyTraceId: string | undefined,
): string | undefined {
  if (traceparent) {
    const match = traceparent.match(
      /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/,
    );
    if (match) {
      return normalizeTraceId(match[1]);
    }
  }

  return normalizeTraceId(legacyTraceId) ?? legacyTraceId ?? undefined;
}
