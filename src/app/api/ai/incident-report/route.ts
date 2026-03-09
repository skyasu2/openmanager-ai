/**
 * 🚨 자동 장애 보고서 API
 *
 * Phase 2: Auto Incident Report Backend (Cloud Run Proxy)
 * - Vercel: Thin Proxy Layer
 * - Cloud Run: AI Analysis & Report Generation
 *
 * 🔄 v5.84.0: Local Fallback Removed (Cloud Run dependency enforced)
 * 🔄 v5.84.1: withAICache 추가 (중복 호출 방지, 1시간 TTL)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { clampTimeout, getDefaultTimeout } from '@/config/ai-proxy.config';
import {
  type CacheableAIResponse,
  withAICache,
} from '@/lib/ai/cache/ai-response-cache';
import { executeWithCircuitBreakerAndFallback } from '@/lib/ai/circuit-breaker';
import { createFallbackResponse } from '@/lib/ai/fallback/ai-fallback-handler';
import {
  buildAITimingHeaders,
  logAIRequest,
  logAIResponse,
  startAITimer,
} from '@/lib/ai/observability';
import { isCloudRunEnabled, proxyToCloudRun } from '@/lib/ai-proxy/proxy';
import { withAuth } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';
import { getHandler } from './get-handler';
import { executeGenerateRetry } from './retry-handler';
import {
  getFallbackMessage,
  getFallbackReason,
  getIncidentReportRouteBudgetMs,
  getIncidentRetryTimeout,
  getMaxRequestTimeoutMs,
  getRetryAfterMs,
  INCIDENT_REPORT_ENDPOINT,
  type IncidentReport,
  IncidentReportRequestSchema,
  isFallbackPayload,
  toFallbackReasonCode,
  withNoStoreHeaders,
} from './route-helpers';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// 복잡한 보고서 생성은 Job Queue 권장
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;
async function postHandler(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = IncidentReportRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: withNoStoreHeaders() }
      );
    }

    const body = parsed.data;
    const { action, serverId } = body;
    const sessionId = body.sessionId ?? `incident_${serverId ?? 'system'}`;
    const cacheQuery = `${action}:${serverId ?? 'all'}:${body.severity ?? 'any'}`;
    const shouldUseCache = action !== 'generate';

    // 1. Cloud Run 활성화 확인
    if (!isCloudRunEnabled()) {
      const fallback = createFallbackResponse('incident-report');
      return NextResponse.json(fallback, {
        headers: withNoStoreHeaders({ 'X-Fallback-Response': 'true' }),
      });
    }

    // 2. 캐시를 통한 Cloud Run 프록시 호출 (Circuit Breaker + Fallback + Cache)
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

      const reportData = cloudRunResult.data as IncidentReport;

      // generate 액션인 경우 DB 저장 시도
      if (action === 'generate' && reportData.id) {
        try {
          const { error } = await supabaseAdmin
            .from('incident_reports')
            .insert({
              id: reportData.id,
              title: reportData.title,
              severity: reportData.severity,
              affected_servers: reportData.affected_servers || [],
              anomalies: reportData.anomalies || [],
              root_cause_analysis: reportData.root_cause_analysis || {},
              recommendations: reportData.recommendations || [],
              timeline: reportData.timeline || [],
              pattern: reportData.pattern || 'unknown',
              system_summary: reportData.system_summary || null,
              created_at: reportData.created_at || new Date().toISOString(),
            });

          if (error) {
            debug.error('DB save error (Cloud Run data):', error);
          }
        } catch (dbError) {
          debug.error('DB connection error:', dbError);
        }
      }

      return {
        success: true,
        report: {
          ...cloudRunResult.data,
          _source: 'Cloud Run AI Engine',
        },
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

    const cacheResult = shouldUseCache
      ? await withAICache<CacheableAIResponse>(
          sessionId,
          cacheQuery,
          fetchIncidentReport,
          'incident-report'
        )
      : { data: await fetchIncidentReport(), cached: false };

    // 3. Retry 전략 실행
    let responseData = cacheResult.data as Record<string, unknown>;
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

    // 4. 응답 반환
    if (isFallback) {
      const latencyMs = aiTimer.elapsed();
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

    if (cacheResult.cached) {
      debug.info('[incident-report] Cache HIT');
      return NextResponse.json(responseData, {
        headers: withNoStoreHeaders({
          'X-Cache': 'HIT',
          ...buildAITimingHeaders({
            latencyMs: aiTimer.elapsed(),
            cacheStatus: 'HIT',
            mode: 'proxy',
            source: 'cache',
          }),
        }),
      });
    }

    const latencyMs = aiTimer.elapsed();
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
  } catch (error) {
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
}

// Export with authentication
export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
