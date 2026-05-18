import { NextResponse } from 'next/server';
import { clampTimeout, getDefaultTimeout } from '@/config/ai-proxy.config';
import type { CacheableAIResponse } from '@/lib/ai/cache/ai-response-cache';
import { executeWithCircuitBreakerAndFallback } from '@/lib/ai/circuit-breaker';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import {
  buildAITimingHeaders,
  logAIRequest,
  logAIResponse,
  startAITimer,
} from '@/lib/ai/observability';
import { isCloudRunEnabled, proxyToCloudRun } from '@/lib/ai-proxy/proxy';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';
import { enrichIncidentReportPayload } from './enrichment';
import { executeGenerateRetry } from './retry-handler';
import {
  getFallbackMessage,
  getFallbackReason,
  getIncidentReportRouteBudgetMs,
  getIncidentRetryTimeout,
  getMaxRequestTimeoutMs,
  getRetryAfterMs,
  INCIDENT_REPORT_ENDPOINT,
  type IncidentReportRequest,
  isFallbackPayload,
  normalizeReporterDegradationReasonCode,
  normalizeReporterFallbackSource,
  toFallbackReasonCode,
  withNoStoreHeaders,
} from './route-helpers';

type ValidationFieldErrors = Record<string, string[] | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readIncidentReportDegradation(responseData: Record<string, unknown>) {
  const report = responseData.report;
  if (!isRecord(report) || report.degraded !== true) return null;

  return {
    reasonCode: normalizeReporterDegradationReasonCode(
      report.fallbackReasonCode ?? report.degradationReasonCode
    ),
    fallbackSource: normalizeReporterFallbackSource(report.fallbackSource),
  };
}

function normalizeIncidentReportDegradationFields(
  report: Record<string, unknown>
): Record<string, unknown> {
  if (report.degraded !== true) return report;

  return {
    ...report,
    fallbackReasonCode: normalizeReporterDegradationReasonCode(
      report.fallbackReasonCode ?? report.degradationReasonCode
    ),
    fallbackSource: normalizeReporterFallbackSource(report.fallbackSource),
  };
}

export function createValidationErrorResponse(
  fieldErrors: ValidationFieldErrors
) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      details: fieldErrors,
    },
    { status: 400, headers: withNoStoreHeaders() }
  );
}

export function createIncidentReportHandlerErrorResponse(error: unknown) {
  debug.error('Incident report proxy error:', error);

  const fallback = createFallbackResponse('incident-report') as Record<
    string,
    unknown
  >;
  const retryAfterMs = getRetryAfterMs(fallback);

  return NextResponse.json(
    {
      success: false,
      report: null,
      message:
        getFallbackMessage(fallback) ||
        '보고서 생성 서비스가 일시적으로 불안정합니다.',
      source: 'fallback',
      retryAfter: retryAfterMs,
    },
    {
      headers: withNoStoreHeaders({
        'X-Fallback-Response': 'true',
        'X-Error': getErrorMessage(error),
        'X-Retry-After': String(retryAfterMs),
        'X-Fallback-Reason': 'handler_error',
        ...buildAITimingHeaders({
          latencyMs: 0,
          cacheStatus: 'BYPASS',
          mode: 'proxy',
          source: 'fallback',
        }),
      }),
    }
  );
}

function createCloudRunDisabledResponse() {
  const fallback = createFallbackResponse('incident-report');
  return NextResponse.json(fallback, {
    headers: withNoStoreHeaders({ 'X-Fallback-Response': 'true' }),
  });
}

function createFallbackResultResponse(
  responseData: Record<string, unknown>,
  latencyMs: number,
  didGenerateRetry: boolean,
  attemptedDirectRetry: boolean
) {
  logAIResponse({
    operation: 'chat',
    system: 'cloud-run',
    model: 'multi-agent',
    latencyMs,
    success: false,
    errorMessage: 'fallback response',
  });

  const retryAfterMs = getRetryAfterMs(responseData);
  const fallbackReasonCode = toFallbackReasonCode(
    getFallbackReason(responseData)
  );

  debug.info('[incident-report] Using fallback response');

  return NextResponse.json(
    {
      success: false,
      report: null,
      message:
        getFallbackMessage(responseData) ||
        '보고서 생성 서비스가 일시적으로 불안정합니다.',
      source: 'fallback',
      retryAfter: retryAfterMs,
    },
    {
      headers: withNoStoreHeaders({
        'X-Fallback-Response': 'true',
        'X-Retry-After': String(retryAfterMs),
        'X-Retry-Attempt': didGenerateRetry ? '1' : '0',
        'X-Direct-Retry-Attempt': attemptedDirectRetry ? '1' : '0',
        'X-Fallback-Reason': fallbackReasonCode,
        ...buildAITimingHeaders({
          latencyMs,
          cacheStatus: 'BYPASS',
          mode: 'proxy',
          source: 'cloud-run',
        }),
      }),
    }
  );
}

function createSuccessResponse(
  responseData: Record<string, unknown>,
  latencyMs: number,
  didGenerateRetry: boolean,
  didDirectRetry: boolean
) {
  logAIResponse({
    operation: 'chat',
    system: 'cloud-run',
    model: 'multi-agent',
    latencyMs,
    success: true,
  });

  debug.info('[incident-report] Cloud Run success');

  const successHeaders: Record<string, string> = { 'X-Cache': 'MISS' };
  if (didGenerateRetry) {
    successHeaders['X-Retry-Attempt'] = '1';
  }
  if (didDirectRetry) {
    successHeaders['X-Direct-Retry'] = '1';
  }
  const degradation = readIncidentReportDegradation(responseData);
  if (degradation) {
    successHeaders['X-AI-Degraded'] = 'true';
    successHeaders['X-AI-Degradation-Reason'] = degradation.reasonCode;
    successHeaders['X-AI-Fallback-Source'] = degradation.fallbackSource;
  }

  return NextResponse.json(responseData, {
    headers: withNoStoreHeaders({
      ...successHeaders,
      ...buildAITimingHeaders({
        latencyMs,
        cacheStatus: 'MISS',
        mode: 'proxy',
        source: 'cloud-run',
      }),
    }),
  });
}

export async function handleValidatedIncidentReportRequest(
  body: IncidentReportRequest
) {
  try {
    const { action, serverId } = body;
    const sessionId = body.sessionId ?? `incident_${serverId ?? 'system'}`;

    if (!isCloudRunEnabled()) {
      return createCloudRunDisabledResponse();
    }

    const aiTimer = startAITimer();
    logAIRequest({
      operation: 'chat',
      system: 'cloud-run',
      model: 'multi-agent',
      sessionId,
      querySummary: `incident-report:${action}:${serverId ?? 'all'}`,
    });

    debug.info(`[incident-report] Proxying action '${action}' to Cloud Run...`);

    const defaultTimeout = getDefaultTimeout(INCIDENT_REPORT_ENDPOINT);
    const routeBudgetMs = getIncidentReportRouteBudgetMs();
    const maxRequestTimeout = getMaxRequestTimeoutMs(routeBudgetMs);
    const effectiveDefaultTimeout = clampTimeout(
      INCIDENT_REPORT_ENDPOINT,
      Math.min(defaultTimeout, maxRequestTimeout)
    );
    const getSecondAttemptPlan = () =>
      getIncidentRetryTimeout(
        effectiveDefaultTimeout,
        effectiveDefaultTimeout,
        routeBudgetMs
      );

    const fetchCloudRunIncidentReport = async (
      timeout = effectiveDefaultTimeout
    ): Promise<CacheableAIResponse> => {
      const cloudRunResult = await proxyToCloudRun({
        path: '/api/ai/incident-report',
        method: 'POST',
        body,
        timeout,
        endpoint: INCIDENT_REPORT_ENDPOINT,
      });

      if (!cloudRunResult.success || !cloudRunResult.data) {
        throw new Error(cloudRunResult.error ?? 'Cloud Run request failed');
      }

      const cloudRunReport: Record<string, unknown> = isRecord(
        cloudRunResult.data
      )
        ? { ...cloudRunResult.data }
        : {};
      delete cloudRunReport.fallbackReason;
      delete cloudRunReport._fallbackReason;
      const enrichedReport = await enrichIncidentReportPayload(
        {
          ...cloudRunReport,
          _source: 'Cloud Run AI Engine',
        },
        body.queryAsOf
      );
      const report = normalizeIncidentReportDegradationFields(enrichedReport);

      return {
        success: true,
        report,
      };
    };

    const fetchIncidentReport = async (
      timeout = effectiveDefaultTimeout
    ): Promise<CacheableAIResponse> => {
      const result = await executeWithCircuitBreakerAndFallback<
        Record<string, unknown>
      >(
        'incident-report',
        () => fetchCloudRunIncidentReport(timeout),
        () =>
          createFallbackResponse('incident-report') as Record<string, unknown>
      );

      const fallbackReason =
        result.source === 'fallback'
          ? (result.originalError?.message ?? null)
          : null;

      return {
        ...result.data,
        success: result.source === 'primary',
        _fallback: result.source === 'fallback',
        ...(fallbackReason ? { _fallbackReason: fallbackReason } : {}),
      } as CacheableAIResponse;
    };

    let responseData = (await fetchIncidentReport()) as Record<string, unknown>;
    let isFallback = isFallbackPayload(responseData);
    let didGenerateRetry = false;
    let attemptedDirectRetry = false;
    let didDirectRetry = false;

    if (action === 'generate' && isFallback) {
      const retryResult = await executeGenerateRetry(responseData, {
        fetchIncidentReport,
        fetchCloudRunDirect: fetchCloudRunIncidentReport,
        getSecondAttemptPlan,
        effectiveDefaultTimeout,
        routeBudgetMs,
      });
      responseData = retryResult.responseData;
      isFallback = retryResult.isFallback;
      didGenerateRetry = retryResult.didGenerateRetry;
      attemptedDirectRetry = retryResult.attemptedDirectRetry;
      didDirectRetry = retryResult.didDirectRetry;
    }

    const latencyMs = aiTimer.elapsed();
    if (isFallback) {
      return createFallbackResultResponse(
        responseData,
        latencyMs,
        didGenerateRetry,
        attemptedDirectRetry
      );
    }

    return createSuccessResponse(
      responseData,
      latencyMs,
      didGenerateRetry,
      didDirectRetry
    );
  } catch (error) {
    return createIncidentReportHandlerErrorResponse(error);
  }
}
