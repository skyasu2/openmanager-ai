/**
 * Supervisor trace helpers
 */

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
      const hex = match[1];
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  return legacyTraceId || undefined;
}
