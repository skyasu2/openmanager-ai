export const REPORTER_DEGRADATION_REASON_CODES = [
  'reporter_degraded',
  'reporter_unavailable',
  'provider_schema_drift',
  'provider_parse_drift',
  'provider_rate_limit',
  'provider_timeout',
  'provider_unavailable',
] as const;

export type ReporterDegradationReasonCode =
  (typeof REPORTER_DEGRADATION_REASON_CODES)[number];

export const REPORTER_FALLBACK_SOURCES = ['tool-based'] as const;

export type ReporterFallbackSource = (typeof REPORTER_FALLBACK_SOURCES)[number];

const REPORTER_DEGRADATION_REASON_CODE_SET = new Set<string>(
  REPORTER_DEGRADATION_REASON_CODES
);
const REPORTER_FALLBACK_SOURCE_SET = new Set<string>(REPORTER_FALLBACK_SOURCES);

export function normalizeReporterDegradationReasonCode(
  value: unknown
): ReporterDegradationReasonCode {
  return typeof value === 'string' &&
    REPORTER_DEGRADATION_REASON_CODE_SET.has(value)
    ? (value as ReporterDegradationReasonCode)
    : 'reporter_degraded';
}

export function normalizeReporterFallbackSource(
  value: unknown
): ReporterFallbackSource {
  return typeof value === 'string' && REPORTER_FALLBACK_SOURCE_SET.has(value)
    ? (value as ReporterFallbackSource)
    : 'tool-based';
}
