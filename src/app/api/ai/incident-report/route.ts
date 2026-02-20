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
import { isCloudRunEnabled, proxyToCloudRun } from '@/lib/ai-proxy/proxy';
import { withAuth } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';
import {
  DIRECT_RETRY_MIN_BUFFER_MS,
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

    // 3. 응답 반환
    let responseData = cacheResult.data as Record<string, unknown>;
    let isFallback = isFallbackPayload(responseData);
    let didGenerateRetry = false;
    let attemptedDirectRetry = false;
    let didDirectRetry = false;

    if (action === 'generate' && isFallback) {
      didGenerateRetry = true;
      debug.info(
        '[incident-report] Generate fallback on first attempt. Retrying once...'
      );

      await new Promise((resolve) => setTimeout(resolve, 250));
      const secondAttemptPlan = getSecondAttemptPlan();

      if (!secondAttemptPlan.retryAllowed) {
        debug.info(
          '[incident-report] Direct Cloud Run retry skipped due insufficient route budget'
        );
        responseData = {
          ...responseData,
          _fallbackReason: 'Route budget limit reached',
        };
        isFallback = true;
      } else {
        debug.info(
          '[incident-report] Generate fallback persisted. Trying second Cloud Run retry...'
        );

        try {
          responseData = (await fetchIncidentReport(
            secondAttemptPlan.timeoutMs
          )) as Record<string, unknown>;
          isFallback = isFallbackPayload(responseData);
        } catch (directRetryError) {
          debug.error(
            '[incident-report] Second Cloud Run retry failed:',
            directRetryError
          );
          responseData = {
            ...responseData,
            _fallbackReason: getErrorMessage(directRetryError),
          };
          isFallback = true;
        }

        if (isFallback) {
          const directRetryPlan = getIncidentRetryTimeout(
            secondAttemptPlan.timeoutMs,
            effectiveDefaultTimeout + secondAttemptPlan.timeoutMs,
            routeBudgetMs,
            DIRECT_RETRY_MIN_BUFFER_MS
          );

          if (directRetryPlan.retryAllowed) {
            debug.info(
              '[incident-report] Generate fallback persisted. Trying direct Cloud Run retry...'
            );
            attemptedDirectRetry = true;
            try {
              responseData = (await fetchCloudRunIncidentReport(
                directRetryPlan.timeoutMs
              )) as Record<string, unknown>;
              isFallback = isFallbackPayload(responseData);
              didDirectRetry = !isFallback;
            } catch (directRetryError) {
              debug.error(
                '[incident-report] Direct Cloud Run retry failed:',
                directRetryError
              );
              responseData = {
                ...responseData,
                _fallbackReason: getErrorMessage(directRetryError),
              };
              isFallback = true;
            }
          } else {
            responseData = {
              ...responseData,
              _fallbackReason: 'Route budget limit reached',
            };
            isFallback = true;
          }
        }
      }
    }

    if (isFallback) {
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
          }),
        }
      );
    }

    if (cacheResult.cached) {
      debug.info('[incident-report] Cache HIT');
      return NextResponse.json(responseData, {
        headers: withNoStoreHeaders({ 'X-Cache': 'HIT' }),
      });
    }

    debug.info('[incident-report] Cloud Run success');
    const successHeaders: Record<string, string> = { 'X-Cache': 'MISS' };
    if (didGenerateRetry) {
      successHeaders['X-Retry-Attempt'] = '1';
    }
    if (didDirectRetry) {
      successHeaders['X-Direct-Retry'] = '1';
    }

    return NextResponse.json(responseData, {
      headers: withNoStoreHeaders(successHeaders),
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
        }),
      }
    );
  }
}

/**
 * GET handler - Read Only (DB or Proxy)
 * 지원 파라미터:
 * - id: 특정 보고서 ID
 * - page: 페이지 번호 (기본 1)
 * - limit: 페이지당 개수 (기본 10)
 * - severity: 심각도 필터 (critical, high, medium, low)
 * - status: 상태 필터 (open, investigating, resolved, closed)
 * - dateRange: 기간 필터 (7d, 30d, 90d, all)
 * - search: 검색어
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // 특정 보고서 조회
      const { data, error } = await supabaseAdmin
        .from('incident_reports')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        report: data,
        timestamp: new Date().toISOString(),
      });
    }

    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
    );
    const offset = (page - 1) * limit;

    // 필터 파라미터
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const dateRange = searchParams.get('dateRange');
    const search = searchParams.get('search');

    // 쿼리 빌더
    let query = supabaseAdmin
      .from('incident_reports')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let fromDate: Date;
      switch (dateRange) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0);
      }
      query = query.gte('created_at', fromDate.toISOString());
    }

    if (search) {
      // 🔧 사이드이펙트 수정: SQL LIKE 와일드카드 이스케이프 (%, _ → \%, \_)
      const escapedSearch = search
        .replace(/\\/g, '\\\\') // 백슬래시 먼저 이스케이프
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.or(
        `title.ilike.%${escapedSearch}%,pattern.ilike.%${escapedSearch}%`
      );
    }

    // 정렬 및 페이지네이션
    const {
      data: reports,
      error,
      count,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      reports: reports || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      total,
      totalPages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    debug.error('Get incident reports error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve reports',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// Export with authentication
export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
