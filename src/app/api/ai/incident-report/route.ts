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
import { z } from 'zod';
import { getDefaultTimeout } from '@/config/ai-proxy.config';
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js가 정적 분석하므로 리터럴 값 필수. 티어 변경 시 아래 값 수동 변경:
// - Free tier:  export const maxDuration = 10;
// - Pro tier:   export const maxDuration = 60;  ← 현재
// 복잡한 보고서 생성은 Job Queue 권장
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60; // 🔧 현재: Pro tier

const IncidentReportRequestSchema = z
  .object({
    action: z.string().min(1),
    serverId: z.string().optional(),
    sessionId: z.string().optional(),
    severity: z.string().optional(),
  })
  .passthrough(); // Cloud Run으로 전달하는 추가 필드 허용

// Types: AI Engine이 생성하는 장애 보고서 구조
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

interface IncidentReport {
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

function withNoStoreHeaders(
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

function isFallbackPayload(payload: Record<string, unknown>): boolean {
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

function getFallbackMessage(payload: Record<string, unknown>): string | null {
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

function getRetryAfterMs(payload: Record<string, unknown>): number {
  const retryAfter = payload.retryAfter;
  if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
    return Math.max(1000, retryAfter);
  }
  return 30000;
}

function getFallbackReason(payload: Record<string, unknown>): string | null {
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

function toFallbackReasonCode(reason: string | null): string {
  if (!reason) return 'unknown';

  const normalized = reason.toLowerCase();
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

/**
 * POST handler - Proxy to Cloud Run with Circuit Breaker + Fallback + Cache
 *
 * @updated 2025-12-30 - Circuit Breaker 및 Fallback 적용
 * @updated 2026-01-04 - withAICache 추가 (1시간 TTL)
 */
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

    const defaultTimeout = getDefaultTimeout('incident-report');
    const directRetryTimeout = Math.min(55000, Math.max(defaultTimeout, 45000));

    const fetchCloudRunIncidentReport = async (
      timeout = defaultTimeout
    ): Promise<CacheableAIResponse> => {
      const cloudRunResult = await proxyToCloudRun({
        path: '/api/ai/incident-report',
        method: 'POST',
        body,
        timeout,
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

    const fetchIncidentReport = async (): Promise<CacheableAIResponse> => {
      const result = await executeWithCircuitBreakerAndFallback<
        Record<string, unknown>
      >(
        'incident-report',
        () => fetchCloudRunIncidentReport(defaultTimeout),
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
      responseData = (await fetchIncidentReport()) as Record<string, unknown>;
      isFallback = isFallbackPayload(responseData);

      if (isFallback) {
        attemptedDirectRetry = true;
        debug.info(
          '[incident-report] Generate fallback persisted. Trying direct Cloud Run retry...'
        );

        try {
          responseData = (await fetchCloudRunIncidentReport(
            directRetryTimeout
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
