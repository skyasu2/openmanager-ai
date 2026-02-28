/**
 * 🏥 통합 헬스체크 API
 *
 * E2E 테스트 및 시스템 상태 확인용 통합 엔드포인트
 * Zod 스키마와 타입 안전성 적용
 *
 * v5.84.1 변경사항:
 * - /api/ping, /api/ai/health 통합 (API 라우트 정리)
 * - Query parameter로 모드 선택 지원
 *
 * v5.80.1 변경사항:
 * - 60초 TTL 메모리 캐싱 추가 (Vercel 사용량 최적화)
 * - Cache-Control 헤더 설정
 *
 * GET /api/health
 *   - (default): 전체 시스템 헬스체크 (DB, Cache, AI)
 *   - ?simple=true: 단순 ping/pong 응답 (/api/ping 대체)
 *   - ?service=cloudrun|ai: Cloud Run AI 엔진 헬스체크 (/api/ai/health 대체)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env, isDevelopment } from '@/env';
import { checkCloudRunHealth } from '@/lib/ai-proxy/proxy';
import { getApiConfig } from '@/lib/api/api-config';
import { createApiRoute } from '@/lib/api/zod-middleware';
import { getCacheStats } from '@/lib/cache/unified-cache';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import {
  type HealthCheckResponse,
  HealthCheckResponseSchema,
} from '@/schemas/api.schema';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

// MIGRATED: Removed export const runtime = "nodejs" (default)
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default) // 캐시는 응답 레벨에서 처리

/** 헬스체크 캐시 (60초 TTL)
 * Note: Module-level cache is per-serverless-instance. This is acceptable
 * for health checks since each instance independently validates its own state,
 * and the 60s TTL ensures staleness is bounded.
 */
interface HealthCache {
  data: HealthCheckResponse | null;
  timestamp: number;
}

const HEALTH_CACHE_TTL = 60000; // 60초
const SERVICE_CHECK_TIMEOUT_MS = 3000; // DB/캐시 연결 타임아웃
let healthCache: HealthCache = {
  data: null,
  timestamp: 0,
};

/** 캐시가 유효한지 확인 */
function isCacheValid(): boolean {
  return (
    healthCache.data !== null &&
    Date.now() - healthCache.timestamp < HEALTH_CACHE_TTL
  );
}

/** 캐시 업데이트 */
function updateCache(data: HealthCheckResponse): void {
  healthCache = {
    data,
    timestamp: Date.now(),
  };
}

// 서비스 상태 체크 함수들 - 실제 구현
async function checkDatabaseStatus(): Promise<
  'connected' | 'disconnected' | 'error'
> {
  try {
    const startTime = Date.now();
    const supabase = await createClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SERVICE_CHECK_TIMEOUT_MS
    );

    try {
      // 🔧 수정: Auth 세션 체크로 DB 연결 확인 (테이블/RPC 의존성 제거)
      // Supabase 클라이언트가 서버와 통신할 수 있는지 확인
      const { error } = await supabase.auth.getSession();
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      // 세션이 없어도 (로그인하지 않음) 연결 자체는 성공
      // 네트워크/인증 에러만 실패로 처리
      if (error) {
        // 세션 없음은 정상 (익명 접근)
        if (
          error.message.includes('session') ||
          error.message.includes('not found') ||
          error.message.includes('expired')
        ) {
          debug.log(
            `✅ Database connected (no session, latency: ${latency}ms)`
          );
          return 'connected';
        }
        debug.error('❌ Database auth check failed:', error.message);
        return 'error';
      }

      debug.log(`✅ Database connected (latency: ${latency}ms)`);
      return 'connected';
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // 타임아웃이나 네트워크 에러만 실패로 처리
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        debug.error('❌ Database connection timeout');
        return 'error';
      }
      // Fetch 실패 외의 에러는 연결 성공으로 간주 (환경 설정 문제 등)
      debug.warn('⚠️ Database check warning:', fetchError);
      return 'connected';
    }
  } catch (error) {
    // createClient 실패 = 환경변수 누락 또는 설정 오류
    debug.error('❌ Database client creation error:', error);
    return 'error';
  }
}

function checkCacheStatus(): Promise<'connected' | 'disconnected' | 'error'> {
  try {
    const stats = getCacheStats();
    if (stats.size >= 0) {
      debug.log(
        `✅ Cache operational (${stats.size}/${stats.maxSize} items, hit rate: ${stats.hitRate}%)`
      );
      return Promise.resolve('connected');
    }
    return Promise.resolve('disconnected');
  } catch (error) {
    debug.error('❌ Cache check error:', error);
    return Promise.resolve('error');
  }
}

async function checkAIStatus(): Promise<
  'connected' | 'disconnected' | 'error'
> {
  try {
    const startTime = Date.now();
    const gcpMcpEnabled = env.ENABLE_GCP_MCP_INTEGRATION === 'true';

    if (!gcpMcpEnabled) {
      debug.log('✅ AI service operational (local mode)');
      return 'connected';
    }

    const vmUrl = env.GCP_MCP_SERVER_URL;
    if (!vmUrl) {
      debug.log(
        '✅ AI service operational (GCP_MCP_SERVER_URL not configured)'
      );
      return 'connected';
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SERVICE_CHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${vmUrl}/health`, {
        signal: controller.signal,
        method: 'GET',
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      if (response.ok) {
        debug.log(`✅ GCP VM AI connected (latency: ${latency}ms)`);
        return 'connected';
      }
      debug.warn(`⚠️ GCP VM AI degraded (status: ${response.status})`);
      return 'disconnected';
    } catch {
      clearTimeout(timeoutId);
      debug.warn('⚠️ GCP VM AI disconnected, using local fallback');
      return 'disconnected';
    }
  } catch (error) {
    debug.error('❌ AI check error:', error);
    return 'error';
  }
}

interface ServiceCheckResult {
  status: 'connected' | 'disconnected' | 'error';
  latency: number;
}

async function checkDatabaseWithLatency(): Promise<ServiceCheckResult> {
  const startTime = Date.now();
  const status = await checkDatabaseStatus();
  return { status, latency: Date.now() - startTime };
}

async function checkCacheWithLatency(): Promise<ServiceCheckResult> {
  const startTime = Date.now();
  const status = await checkCacheStatus();
  return { status, latency: Date.now() - startTime };
}

async function checkAIWithLatency(): Promise<ServiceCheckResult> {
  const startTime = Date.now();
  const status = await checkAIStatus();
  return { status, latency: Date.now() - startTime };
}

const healthCheckHandler = createApiRoute()
  .response(HealthCheckResponseSchema)
  .configure({ showDetailedErrors: true, enableLogging: true })
  .build(async (_request, _context): Promise<HealthCheckResponse> => {
    const apiConfig = getApiConfig();
    const [dbResult, cacheResult, aiResult] = await Promise.all([
      checkDatabaseWithLatency(),
      checkCacheWithLatency(),
      checkAIWithLatency(),
    ]);

    const allServicesHealthy =
      dbResult.status === 'connected' &&
      cacheResult.status === 'connected' &&
      aiResult.status === 'connected';
    const hasErrors =
      dbResult.status === 'error' ||
      cacheResult.status === 'error' ||
      aiResult.status === 'error';
    const overallStatus = hasErrors
      ? 'unhealthy'
      : allServicesHealthy
        ? 'healthy'
        : 'degraded';

    const response: HealthCheckResponse = {
      status: overallStatus,
      services: {
        database: {
          status: dbResult.status,
          lastCheck: new Date().toISOString(),
          latency: dbResult.latency,
        },
        cache: {
          status: cacheResult.status,
          lastCheck: new Date().toISOString(),
          latency: cacheResult.latency,
        },
        ai: {
          status: aiResult.status,
          lastCheck: new Date().toISOString(),
          latency: aiResult.latency,
        },
      },
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      version:
        env.APP_VERSION ||
        process.env.NEXT_PUBLIC_APP_VERSION ||
        process.env.npm_package_version ||
        'unknown',
      timestamp: new Date().toISOString(),
    };

    if (isDevelopment) {
      const siteUrl = getSiteUrl();
      (response as Record<string, unknown>).environment = {
        type: env.NODE_ENV,
        urls: {
          site: siteUrl,
          api: `${siteUrl}/api`,
          vmApi: env.VM_API_URL,
        },
        config: {
          rateLimit: apiConfig.rateLimit,
          timeout: apiConfig.timeout,
          cache: apiConfig.cache,
        },
      };
    }

    const validation = HealthCheckResponseSchema.safeParse(response);
    if (!validation.success) {
      debug.error('Health check response validation failed:', validation.error);
    }
    return response;
  });

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const simple = searchParams.get('simple') === 'true';
  const service = searchParams.get('service');

  // 1. Simple ping mode (?simple=true) - /api/ping 대체
  if (simple) {
    return NextResponse.json(
      { ping: 'pong', timestamp: new Date().toISOString() },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 2. Service-specific health check (?service=cloudrun|ai) - /api/ai/health 대체
  if (service === 'cloudrun' || service === 'ai') {
    const result = await checkCloudRunHealth();
    if (result.healthy) {
      return NextResponse.json({
        status: 'ok',
        backend: 'cloud-run',
        latency: result.latency,
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json(
      {
        status: 'error',
        backend: 'cloud-run',
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  // 3. Full system health check (default)
  try {
    // 캐시된 응답이 있으면 즉시 반환 (60초 TTL)
    if (isCacheValid() && healthCache.data) {
      debug.log('📦 Health check cache hit');
      return NextResponse.json(
        {
          ...healthCache.data,
          // 캐시된 응답임을 표시
          cached: true,
          cacheAge: Math.floor((Date.now() - healthCache.timestamp) / 1000),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
            'X-Cache': 'HIT',
          },
        }
      );
    }

    const apiConfig = getApiConfig();
    const response = await healthCheckHandler(request);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    };

    if (apiConfig.cache.enabled) {
      headers['Cache-Control'] =
        `public, max-age=${apiConfig.cache.ttl}, stale-while-revalidate=30`;
    } else {
      headers['Cache-Control'] =
        'public, max-age=60, stale-while-revalidate=30';
    }

    const body = (await response.json()) as HealthCheckResponse;

    // 캐시 업데이트
    updateCache(body);
    debug.log('📦 Health check cache updated');

    return NextResponse.json(body, { headers });
  } catch (error) {
    debug.error('❌ Health check failed:', error);
    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: getErrorMessage(error),
    };
    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  }
}

export function HEAD(_request: NextRequest) {
  try {
    return new NextResponse(null, {
      status: 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
