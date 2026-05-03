import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { QueryAsOf } from '../data/query-as-of-context';
import { logger } from '../lib/logger';
import { createErrorResponse } from '../types/api-response';
import {
  MonitoringDataSourceError,
  type MonitoringErrorCode,
  type MonitoringSourceMode,
} from '../services/monitoring/monitoring-data-source';

const MONITORING_ERROR_STATUS: Record<
  MonitoringErrorCode,
  ContentfulStatusCode
> = {
  DATA_SOURCE_UNAVAILABLE: 503,
  SLOT_NOT_FOUND: 404,
  SERVER_NOT_FOUND: 404,
  METRIC_NOT_FOUND: 404,
  LIVE_SOURCE_DISABLED: 503,
  SNAPSHOT_STALE: 503,
};

export type MonitoringApiErrorContext = {
  sourceMode?: MonitoringSourceMode;
  queryAsOf?: QueryAsOf;
};

function readMonitoringRequestId(c: Context): string {
  const cloudTrace = c.req.header('x-cloud-trace-context');
  return (
    c.req.header('x-request-id') ??
    c.req.header('x-correlation-id') ??
    cloudTrace?.split('/')[0] ??
    `monitoring-${Date.now()}`
  );
}

export function handleMonitoringApiError(
  c: Context,
  error: unknown,
  logPrefix: string,
  context: MonitoringApiErrorContext = {}
): Response | null {
  if (!(error instanceof MonitoringDataSourceError)) {
    return null;
  }

  const requestId = readMonitoringRequestId(c);
  const queryAsOf = error.queryAsOf ?? context.queryAsOf?.createdAt ?? null;
  const sourceMode = error.sourceMode ?? context.sourceMode ?? 'replay-json';

  logger.warn(
    {
      err: error,
      code: error.code,
      sourceMode,
      queryAsOf,
      requestId,
      recoverable: error.recoverable,
    },
    `[${logPrefix}] Monitoring data source error`
  );

  return c.json(
    {
      ...createErrorResponse(error.message, error.code),
      sourceMode,
      queryAsOf,
      requestId,
      recoverable: error.recoverable,
    },
    MONITORING_ERROR_STATUS[error.code]
  );
}
