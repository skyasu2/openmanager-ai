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
import { checkCloudRunHealth } from '@/lib/ai-proxy/proxy';
import { createApiRoute } from '@/lib/api/zod-middleware';
import { getCacheStats } from '@/lib/cache/unified-cache';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import { probeSupabaseSession } from '@/lib/supabase/session-probe';
import {
  type HealthCheckResponse,
  HealthCheckResponseSchema,
} from '@/schemas/api.schema';
import { getKSTDateTime } from '@/services/metrics/kst-time';
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
  data: HealthRouteEnvelope | null;
  timestamp: number;
}

interface HealthRouteEnvelope {
  success: true;
  data: HealthCheckResponse;
  timestamp: string;
  cached?: boolean;
  cacheAge?: number;
}

interface HealthApiRuntimeConfig {
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  timeout: {
    default: number;
    long: number;
    stream: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}

const HEALTH_CACHE_TTL = 60000; // 60초
const SERVICE_CHECK_TIMEOUT_MS = 3000; // DB/캐시 연결 타임아웃
let healthCache: HealthCache = {
  data: null,
  timestamp: 0,
};

function getTrimmedProcessEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getHealthApiRuntimeConfig(): HealthApiRuntimeConfig {
  const nodeEnv = getTrimmedProcessEnv('NODE_ENV') || 'development';

  if (nodeEnv === 'development') {
    return {
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      timeout: { default: 30000, long: 120000, stream: 300000 },
      cache: { enabled: false, ttl: 0 },
    };
  }

  if (nodeEnv === 'production') {
    return {
      rateLimit: { maxRequests: 60, windowMs: 60000 },
      timeout: { default: 10000, long: 30000, stream: 120000 },
      cache: { enabled: true, ttl: 600 },
    };
  }

  return {
    rateLimit: { maxRequests: 60, windowMs: 60000 },
    timeout: { default: 15000, long: 60000, stream: 180000 },
    cache: { enabled: true, ttl: 300 },
  };
}

function isDevelopmentRuntime(): boolean {
  return getTrimmedProcessEnv('NODE_ENV') === 'development';
}

/** 캐시가 유효한지 확인 */
function isCacheValid(): boolean {
  return (
    healthCache.data !== null &&
    Date.now() - healthCache.timestamp < HEALTH_CACHE_TTL
  );
}

/** 캐시 업데이트 */
function updateCache(data: HealthRouteEnvelope): void {
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
    const probeResult = await probeSupabaseSession(supabase, {
      timeoutMs: SERVICE_CHECK_TIMEOUT_MS,
      timeoutMessage: 'Database check timeout',
    });
    const latency = Date.now() - startTime;

    if (!probeResult.reachable) {
      debug.error(
        '❌ Database auth check failed:',
        probeResult.errorMessage ?? 'Unknown error'
      );
      return 'error';
    }

    debug.log(`✅ Database connected (latency: ${latency}ms)`);
    return 'connected';
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
    const gcpMcpEnabled =
      getTrimmedProcessEnv('ENABLE_GCP_MCP_INTEGRATION') === 'true';

    if (!gcpMcpEnabled) {
      debug.log('✅ AI service operational (local mode)');
      return 'connected';
    }

    const vmUrl = getTrimmedProcessEnv('GCP_MCP_SERVER_URL');
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
        getTrimmedProcessEnv('APP_VERSION') ||
        process.env.NEXT_PUBLIC_APP_VERSION ||
        process.env.npm_package_version ||
        'unknown',
      timestamp: new Date().toISOString(),
    };

    if (isDevelopmentRuntime()) {
      const siteUrl = getSiteUrl();
      const apiRuntimeConfig = getHealthApiRuntimeConfig();
      (response as Record<string, unknown>).environment = {
        type: getTrimmedProcessEnv('NODE_ENV') || 'development',
        urls: {
          site: siteUrl,
          api: `${siteUrl}/api`,
          vmApi: getTrimmedProcessEnv('VM_API_URL'),
        },
        config: {
          rateLimit: apiRuntimeConfig.rateLimit,
          timeout: apiRuntimeConfig.timeout,
          cache: apiRuntimeConfig.cache,
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

  // 2a. Data parity check (?service=parity) — dashboard/AI 동일 슬롯 참조 검증용
  if (service === 'parity') {
    const { slotIndex: globalSlotIndex, minuteOfDay } = getKSTDateTime();
    const hour = Math.floor(minuteOfDay / 60);
    const slotInHour = globalSlotIndex % 6;
    return NextResponse.json(
      {
        contract: 'frontend-ai-data-parity',
        description:
          'Dashboard와 AI 엔진은 동일한 KST 10분 슬롯 계산식을 공유합니다. ' +
          '이 응답의 globalSlotIndex가 AI 응답 dataSlot.slotIndex와 ±1 이내여야 합니다.',
        slot: {
          globalSlotIndex, // 0-143: AI 엔진 dataSlot.slotIndex와 직접 비교 가능
          slotInHour, // 0-5: hour-XX.json slots[] 배열 인덱스
          hour, // 0-23: 로드 중인 hourly JSON 파일 번호
          minuteOfDay, // 0-1430 (10분 단위): 두 사이드 모두 동일 기준
        },
        toleranceSlots: 1,
        formula: 'Math.floor(KST_minutes_of_day / 10)',
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2b. Service-specific health check (?service=cloudrun|ai) - /api/ai/health 대체
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

    const cacheConfig = getHealthApiRuntimeConfig().cache;
    const response = await healthCheckHandler(request);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    };

    if (cacheConfig.enabled) {
      headers['Cache-Control'] =
        `public, max-age=${cacheConfig.ttl}, stale-while-revalidate=30`;
    } else {
      headers['Cache-Control'] =
        'public, max-age=60, stale-while-revalidate=30';
    }

    const body = (await response.json()) as HealthRouteEnvelope;

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
