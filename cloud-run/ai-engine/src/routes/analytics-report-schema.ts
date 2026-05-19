import { z } from 'zod';

const SeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'warning',
  'info',
]);

export const IncidentReportOutputSchema = z
  .object({
    title: z.string(),
    severity: SeveritySchema,
    description: z.string(),
    affected_servers: z.array(z.string()),
    affectedServers: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          severity: z.string(),
          metric: z.string().nullable(),
          value: z.number().nullable(),
        })
      ),
    root_cause: z.string(),
    recommendations: z
      .array(
        z.object({
          action: z.string(),
          priority: z.string(),
          expected_impact: z.string(),
        })
      ),
    pattern: z.string(),
    postmortem: z.object({
      timeline: z.array(z.string()),
      hypotheses: z.array(z.string()),
      prevention: z.array(z.string()),
    }),
  })
  .passthrough();

export type IncidentReportOutput = z.infer<typeof IncidentReportOutputSchema>;

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

export function getReporterDegradationReasonCode(
  reason?: string
): ReporterDegradationReasonCode {
  const message = reason?.toLowerCase() ?? '';
  if (!message) return 'reporter_degraded';
  if (message.includes('reporter_unavailable')) return 'reporter_unavailable';
  if (
    message.includes('invalid json schema') ||
    message.includes('expected schema') ||
    message.includes('response_format') ||
    message.includes('jsonschema')
  ) {
    return 'provider_schema_drift';
  }
  if (
    message.includes('no object generated') ||
    message.includes('could not parse') ||
    message.includes('parse the response')
  ) {
    return 'provider_parse_drift';
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('quota') ||
    message.includes('429')
  ) {
    return 'provider_rate_limit';
  }
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline')
  ) {
    return 'provider_timeout';
  }
  if (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('service unavailable')
  ) {
    return 'provider_unavailable';
  }
  return 'reporter_degraded';
}
