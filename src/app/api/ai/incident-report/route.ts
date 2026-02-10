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
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { action, serverId } = body;
    const sessionId = body.sessionId ?? `incident_${serverId ?? 'system'}`;
    const cacheQuery = `${action}:${serverId ?? 'all'}:${body.severity ?? 'any'}`;

    // 1. Cloud Run 활성화 확인
    if (!isCloudRunEnabled()) {
      const fallback = createFallbackResponse('incident-report');
      return NextResponse.json(fallback);
    }

    // 2. 캐시를 통한 Cloud Run 프록시 호출 (Circuit Breaker + Fallback + Cache)
    debug.info(`[incident-report] Proxying action '${action}' to Cloud Run...`);

    const cacheResult = await withAICache<CacheableAIResponse>(
      sessionId,
      cacheQuery,
      // Fetcher: Circuit Breaker + Fallback 적용
      async () => {
        const result = await executeWithCircuitBreakerAndFallback<
          Record<string, unknown>
        >(
          'incident-report',
          async () => {
            const cloudRunResult = await proxyToCloudRun({
              path: '/api/ai/incident-report',
              method: 'POST',
              body,
              timeout: getDefaultTimeout('incident-report'),
            });

            if (!cloudRunResult.success || !cloudRunResult.data) {
              throw new Error(
                cloudRunResult.error ?? 'Cloud Run request failed'
              );
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
                    created_at:
                      reportData.created_at || new Date().toISOString(),
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
          },
          () =>
            createFallbackResponse('incident-report') as Record<string, unknown>
        );

        return {
          success: true,
          ...result.data,
          _fallback: result.source === 'fallback',
        } as CacheableAIResponse;
      },
      'incident-report'
    );

    // 3. 응답 반환
    const responseData = cacheResult.data;
    const isFallback = (responseData as Record<string, unknown>)._fallback;

    if (cacheResult.cached) {
      debug.info('[incident-report] Cache HIT');
      return NextResponse.json(responseData, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    if (isFallback) {
      debug.info('[incident-report] Using fallback response');
      return NextResponse.json(
        {
          success: false,
          report: null,
          message:
            (responseData as Record<string, unknown>).message ||
            '보고서 생성 서비스가 일시적으로 불안정합니다.',
          source: 'fallback',
          retryAfter: 30000,
        },
        {
          headers: {
            'X-Fallback-Response': 'true',
            'X-Retry-After': '30000',
          },
        }
      );
    }

    debug.info('[incident-report] Cloud Run success');
    return NextResponse.json(responseData, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    debug.error('Incident report proxy error:', error);

    const fallback = createFallbackResponse('incident-report');
    return NextResponse.json(fallback, {
      headers: {
        'X-Fallback-Response': 'true',
        'X-Error': getErrorMessage(error),
      },
    });
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
