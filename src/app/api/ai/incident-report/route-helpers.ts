import { z } from 'zod';
import {
  clampTimeout,
  getFunctionTimeoutReserveMs,
  getMaxFunctionDurationMs,
  getMaxTimeout,
  getMinTimeout,
  getRouteMaxExecutionMs,
} from '@/config/ai-proxy.config';

export const IncidentReportRequestSchema = z
  .object({
    action: z.string().min(1),
    serverId: z.string().optional(),
    sessionId: z.string().optional(),
    severity: z.string().optional(),
  })
  .passthrough();

interface AffectedServer {
  serverId: string;
  hostname?: string;
  status: string;
  metrics?: { cpu?: number; memory?: number; disk?: number };
}

interface Anomaly {
  metric: string;
  serverId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  description?: string;
}

interface RootCauseAnalysis {
  summary: string;
  confidence: number;
  causes: Array<{ description: string; probability: number }>;
  evidence?: string[];
}

interface Recommendation {
  action: string;
  priority: 'immediate' | 'short-term' | 'long-term';
  description?: string;
  estimatedImpact?: string;
}

interface TimelineEvent {
  timestamp: string;
  event: string;
  severity?: string;
  serverId?: string;
}

export interface IncidentReport {
  id: string;
  title: string;
  severity: string;
  created_at: string;
  affected_servers?: AffectedServer[];
  anomalies?: Anomaly[];
  root_cause_analysis?: RootCauseAnalysis;
  recommendations?: Recommendation[];
  timeline?: TimelineEvent[];
  pattern?: string;
  system_summary?: string | null;
  [key: string]: unknown;
}

const NO_STORE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
} as const;

export const INCIDENT_REPORT_ENDPOINT: 'incident-report' = 'incident-report';
const ATTEMPT_GUARD_MS = 250;
export const DIRECT_RETRY_MIN_BUFFER_MS = 1_000;
const INCIDENT_REPORT_ROUTE_MAX_DURATION_SECONDS = 60;

export function getIncidentReportRouteBudgetMs(): number {
  return getRouteMaxExecutionMs(INCIDENT_REPORT_ROUTE_MAX_DURATION_SECONDS);
}

export function getMaxRequestTimeoutMs(routeBudgetMs: number): number {
  return Math.max(500, routeBudgetMs - getFunctionTimeoutReserveMs());
}

export function getIncidentRetryTimeout(
  preferredTimeout: number,
  consumedMs: number,
  routeBudgetMs: number,
  minBufferMs = 0
): { retryAllowed: boolean; timeoutMs: number } {
  const budgetReserveMs = getFunctionTimeoutReserveMs();
  const projectedRemainingMs = Math.max(
    0,
    routeBudgetMs - budgetReserveMs - consumedMs - ATTEMPT_GUARD_MS
  );

  if (
    projectedRemainingMs <
    getMinTimeout(INCIDENT_REPORT_ENDPOINT) + minBufferMs
  ) {
    return { retryAllowed: false, timeoutMs: 0 };
  }

  const maxTimeoutMs = Math.min(
    preferredTimeout,
    projectedRemainingMs,
    getMaxTimeout(INCIDENT_REPORT_ENDPOINT)
  );
  const clampedTimeout = clampTimeout(INCIDENT_REPORT_ENDPOINT, maxTimeoutMs);

  return {
    retryAllowed: true,
    timeoutMs: clampedTimeout,
  };
}

export function withNoStoreHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  return {
    ...NO_STORE_RESPONSE_HEADERS,
    ...headers,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFallbackPayload(payload: Record<string, unknown>): boolean {
  if (payload._fallback === true) {
    return true;
  }

  if (payload.source === 'fallback') {
    return true;
  }

  if (isRecord(payload.data) && payload.data.source === 'fallback') {
    return true;
  }

  return false;
}

export function getFallbackMessage(
  payload: Record<string, unknown>
): string | null {
  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }

  if (
    isRecord(payload.data) &&
    typeof payload.data.message === 'string' &&
    payload.data.message.length > 0
  ) {
    return payload.data.message;
  }

  return null;
}

export function getRetryAfterMs(payload: Record<string, unknown>): number {
  const retryAfter = payload.retryAfter;
  if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
    return Math.max(1000, retryAfter);
  }
  return 30000;
}

export function getFallbackReason(
  payload: Record<string, unknown>
): string | null {
  if (
    typeof payload._fallbackReason === 'string' &&
    payload._fallbackReason.length > 0
  ) {
    return payload._fallbackReason;
  }

  if (
    isRecord(payload.data) &&
    typeof payload.data._fallbackReason === 'string' &&
    payload.data._fallbackReason.length > 0
  ) {
    return payload.data._fallbackReason;
  }

  return null;
}

export function toFallbackReasonCode(reason: string | null): string {
  const fallbackReason = reason ?? null;
  if (!fallbackReason) return 'unknown';

  const normalized = fallbackReason.toLowerCase();
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('abort')
  ) {
    return 'timeout';
  }

  if (
    normalized.includes('api key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('401')
  ) {
    return 'auth';
  }

  if (normalized.includes('403') || normalized.includes('forbidden')) {
    return 'forbidden';
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many') ||
    normalized.includes('429')
  ) {
    return 'rate_limit';
  }

  if (
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('504') ||
    normalized.includes('service unavailable')
  ) {
    return 'upstream_unavailable';
  }

  if (normalized.includes('circuit')) {
    return 'circuit_open';
  }

  if (normalized.includes('cloud run is not enabled')) {
    return 'cloud_run_disabled';
  }

  return 'upstream_error';
}
