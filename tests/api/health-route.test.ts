import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted()로 모든 mock 함수 선언
const {
  mockCreateClient,
  mockGetCacheStats,
  mockCheckCloudRunHealth,
  mockGetApiConfig,
  mockGetSiteUrl,
  mockBuildCallback,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetCacheStats: vi.fn(),
  mockCheckCloudRunHealth: vi.fn(),
  mockGetApiConfig: vi.fn(),
  mockGetSiteUrl: vi.fn(),
  mockBuildCallback: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/cache/unified-cache', () => ({
  getCacheStats: mockGetCacheStats,
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  checkCloudRunHealth: mockCheckCloudRunHealth,
}));

vi.mock('@/env', () => ({
  env: {
    APP_VERSION: 'test',
    NODE_ENV: 'test',
    ENABLE_GCP_MCP_INTEGRATION: 'false',
    GCP_MCP_SERVER_URL: '',
  },
  isDevelopment: false,
}));

vi.mock('@/lib/api/api-config', () => ({
  getApiConfig: mockGetApiConfig,
}));

// createApiRoute mock: 빌더 패턴을 시뮬레이션하여 build 콜백을 캡처
vi.mock('@/lib/api/zod-middleware', () => ({
  createApiRoute: () => {
    const builder = {
      response: () => builder,
      configure: () => builder,
      build: (callback: (...args: never) => unknown) => {
        mockBuildCallback.mockImplementation(callback);
        return async (request: Request) => {
          const result = await callback(request, {});
          return new Response(
            JSON.stringify({
              success: true,
              data: result,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        };
      },
    };
    return builder;
  },
}));

vi.mock('@/lib/site-url', () => ({
  getSiteUrl: mockGetSiteUrl,
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/schemas/api.schema', () => ({
  HealthCheckResponseSchema: {
    safeParse: vi.fn(() => ({ success: true })),
  },
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (e: unknown) =>
    e instanceof Error ? e.message : 'Unknown error',
}));

// 각 테스트마다 모듈을 새로 임포트하여 모듈 레벨 캐시를 초기화
async function importRoute() {
  const mod = await import('@/app/api/health/route');
  return { GET: mod.GET, HEAD: mod.HEAD };
}

describe('Health Route Contract (/api/health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 모듈 캐시 리셋 → 매 테스트마다 healthCache가 초기화됨
    vi.resetModules();

    // 기본 mock 설정
    mockCreateClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    });

    mockGetCacheStats.mockReturnValue({
      size: 10,
      maxSize: 1000,
      hitRate: 85,
    });

    mockCheckCloudRunHealth.mockResolvedValue({
      healthy: true,
      latency: 150,
    });

    mockGetApiConfig.mockReturnValue({
      rateLimit: {},
      timeout: 30,
      cache: { enabled: true, ttl: 60 },
    });

    mockGetSiteUrl.mockReturnValue('http://localhost:3000');
  });

  it('?simple=true 요청 시 ping/pong 응답을 반환한다', async () => {
    const { GET } = await importRoute();
    const request = new NextRequest('http://localhost/api/health?simple=true');

    const response = await GET(request);

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      ping: string;
      timestamp: string;
    };

    expect(payload.ping).toBe('pong');
    expect(payload.timestamp).toBeDefined();
  });

  it('?service=cloudrun 요청 시 Cloud Run이 정상이면 ok 상태를 반환한다', async () => {
    const { GET } = await importRoute();
    mockCheckCloudRunHealth.mockResolvedValue({
      healthy: true,
      latency: 120,
    });

    const request = new NextRequest(
      'http://localhost/api/health?service=cloudrun'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      status: string;
      backend: string;
      latency: number;
    };

    expect(payload.status).toBe('ok');
    expect(payload.backend).toBe('cloud-run');
    expect(payload.latency).toBe(120);
  });

  it('?service=ai 요청 시 Cloud Run이 비정상이면 503을 반환한다', async () => {
    const { GET } = await importRoute();
    mockCheckCloudRunHealth.mockResolvedValue({
      healthy: false,
      latency: 0,
      error: 'Connection refused',
    });

    const request = new NextRequest('http://localhost/api/health?service=ai');

    const response = await GET(request);

    expect(response.status).toBe(503);

    const payload = (await response.json()) as {
      status: string;
      backend: string;
      error: string;
    };

    expect(payload.status).toBe('error');
    expect(payload.backend).toBe('cloud-run');
    expect(payload.error).toBe('Connection refused');
  });

  it('기본 GET 요청 시 전체 헬스체크 결과를 반환한다', async () => {
    const { GET } = await importRoute();
    const request = new NextRequest('http://localhost/api/health');

    const response = await GET(request);

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        status: string;
        services: {
          database: { status: string };
          cache: { status: string };
          ai: { status: string };
        };
        version: string;
        timestamp: string;
      };
      timestamp: string;
    };

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('healthy');
    expect(payload.data.services.database.status).toBe('connected');
    expect(payload.data.services.cache.status).toBe('connected');
    expect(payload.data.services.ai.status).toBe('connected');
    expect(payload.data.version).toBe('test');
    expect(payload.timestamp).toBeDefined();
  });

  it('DB 체크 실패 시 unhealthy 상태를 반환한다', async () => {
    // createClient가 에러를 던지면 catch에서 'error' 반환
    mockCreateClient.mockRejectedValue(new Error('Client creation failed'));

    const { GET } = await importRoute();
    const request = new NextRequest('http://localhost/api/health');

    const response = await GET(request);

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        status: string;
        services: {
          database: { status: string };
        };
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('unhealthy');
    expect(payload.data.services.database.status).toBe('error');
  });

  it('DB 세션 프로브가 타임아웃되면 unhealthy 상태를 반환한다', async () => {
    vi.useFakeTimers();

    try {
      mockCreateClient.mockResolvedValue({
        auth: {
          getSession: vi.fn(() => new Promise(() => {})),
        },
      });

      const { GET } = await importRoute();
      const request = new NextRequest('http://localhost/api/health');
      const responsePromise = GET(request);

      await vi.advanceTimersByTimeAsync(3000);

      const response = await responsePromise;
      expect(response.status).toBe(200);

      const payload = (await response.json()) as {
        success: boolean;
        data: {
          status: string;
          services: {
            database: { status: string };
          };
        };
      };

      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe('unhealthy');
      expect(payload.data.services.database.status).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('HEAD 요청 시 200과 빈 body를 반환한다', async () => {
    const { HEAD } = await importRoute();
    const request = new NextRequest('http://localhost/api/health', {
      method: 'HEAD',
    });

    const response = HEAD(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'no-cache, no-store, must-revalidate'
    );

    const body = await response.text();
    expect(body).toBe('');
  });

  it('캐시가 유효하면 X-Cache: HIT 헤더와 함께 캐시된 응답을 반환한다', async () => {
    const { GET } = await importRoute();
    const request = new NextRequest('http://localhost/api/health');

    // 첫 번째 호출: 캐시 적재 (MISS)
    const firstResponse = await GET(request);
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get('X-Cache')).toBe('MISS');

    // 두 번째 호출: 캐시 히트 (HIT)
    const secondRequest = new NextRequest('http://localhost/api/health');
    const secondResponse = await GET(secondRequest);

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get('X-Cache')).toBe('HIT');

    const payload = (await secondResponse.json()) as {
      success: boolean;
      data: {
        status: string;
      };
      cached: boolean;
      cacheAge: number;
    };

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('healthy');
    expect(payload.cached).toBe(true);
    expect(payload.cacheAge).toBeTypeOf('number');
  });
});
