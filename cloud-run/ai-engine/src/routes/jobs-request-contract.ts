import { logger } from '../lib/logger';
import { normalizeSupervisorLocalRouteDecision } from '../services/ai-sdk/supervisor-mode';
import type {
  AnalysisMode,
  SupervisorRequest,
} from '../services/ai-sdk/supervisor-types';
import {
  normalizeQueryAsOf,
  type QueryAsOf,
} from '../data/query-as-of-context';

export type JobProcessToolOptions = Pick<
  SupervisorRequest,
  | 'analysisMode'
  | 'enableRAG'
  | 'enableWebSearch'
  | 'internalDisclosureMode'
  | 'localRouteDecision'
>;

const PROCESSING_DUPLICATE_GRACE_MS = 30 * 60 * 1000;

function isLocalTargetHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export function buildJobProcessTargetUrl(
  requestUrl: string,
  forwardedProto?: string
): string {
  const targetUrl = new URL('/api/jobs/process', requestUrl);
  const forwardedScheme = forwardedProto
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();

  if (forwardedScheme === 'https') {
    targetUrl.protocol = 'https:';
  } else if (
    forwardedScheme === 'http' &&
    isLocalTargetHostname(targetUrl.hostname)
  ) {
    targetUrl.protocol = 'http:';
  } else if (
    targetUrl.protocol === 'http:' &&
    !isLocalTargetHostname(targetUrl.hostname)
  ) {
    targetUrl.protocol = 'https:';
  }

  return targetUrl.toString();
}

function isAnalysisMode(value: unknown): value is AnalysisMode {
  return value === 'auto' || value === 'thinking';
}

function isWebSearchOption(
  value: unknown
): value is SupervisorRequest['enableWebSearch'] {
  return value === true || value === false || value === 'auto';
}

function isInternalDisclosureMode(
  value: unknown
): value is SupervisorRequest['internalDisclosureMode'] {
  return value === 'user' || value === 'developer';
}

export function extractJobProcessToolOptions(
  payload: Record<string, unknown>
): JobProcessToolOptions {
  const localRouteDecision = normalizeSupervisorLocalRouteDecision(
    payload.localRouteDecision
  );
  if (payload.localRouteDecision !== undefined && !localRouteDecision) {
    logger.warn('[Jobs] Ignoring invalid localRouteDecision payload');
  }

  return {
    ...(isAnalysisMode(payload.analysisMode) && {
      analysisMode: payload.analysisMode,
    }),
    ...(typeof payload.enableRAG === 'boolean' && {
      enableRAG: payload.enableRAG,
    }),
    ...(isWebSearchOption(payload.enableWebSearch) && {
      enableWebSearch: payload.enableWebSearch,
    }),
    ...(isInternalDisclosureMode(payload.internalDisclosureMode) && {
      internalDisclosureMode: payload.internalDisclosureMode,
    }),
    ...(localRouteDecision && { localRouteDecision }),
  };
}

export function extractJobProcessQueryAsOf(
  payload: Record<string, unknown>
): QueryAsOf | undefined {
  const queryAsOf = normalizeQueryAsOf(payload.queryAsOf);
  if (payload.queryAsOf !== undefined && !queryAsOf) {
    logger.warn('[Jobs] Ignoring invalid queryAsOf payload');
  }
  return queryAsOf;
}

export function isRecentProcessingJob(startedAt?: string): boolean {
  if (!startedAt) return true;
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return true;
  return Date.now() - startedAtMs < PROCESSING_DUPLICATE_GRACE_MS;
}
