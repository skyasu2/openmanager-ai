import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/cors';
import { createApiRoute } from '@/lib/api/zod-middleware';
import { withAuth } from '@/lib/auth/api-auth';
import {
  type PaginatedServer,
  ServerBatchRequestSchema,
  type ServerBatchResponse,
  ServerBatchResponseSchema,
  type ServerPaginatedResponse,
  ServerPaginatedResponseSchema,
  ServerPaginationQuerySchema,
} from '@/schemas/api.schema';
import { getServerMonitoringService } from '@/services/monitoring';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

/**
 * 🚀 서버 페이지네이션 API v2.1
 *
 * 목적: 서버 목록을 페이지 단위로 가져오는 최적화된 API
 * 데이터 소스: MetricsProvider (hourly-data + fixed-24h-metrics fallback)
 *
 * 주요 기능:
 * - 페이지 기반 서버 목록 조회
 * - 캐시 최적화로 빠른 응답 제공
 * - 실시간 서버 상태 업데이트 지원
 * - 정렬 및 필터링 옵션
 */

// Next.js App Router 런타임 설정
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET 핸들러
const getHandler = createApiRoute()
  .query(ServerPaginationQuerySchema)
  .response(ServerPaginatedResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build((_request, context): Promise<ServerPaginatedResponse> => {
    const {
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
      status,
    } = context.query;

    // ServerMonitoringService에서 서버 데이터 가져오기
    const service = getServerMonitoringService();
    const processed = service.getAllProcessedServers();

    debug.log(
      `📊 ServerMonitoringService에서 ${processed.length}개 서버 로드됨`
    );

    // ProcessedServerData를 PaginatedServer 형식으로 변환
    const allServers: PaginatedServer[] = processed.map((p) =>
      service.toPaginatedServer(p)
    );

    // 상태 필터링
    let filteredServers = allServers;
    if (status) {
      filteredServers = allServers.filter((server) => server.status === status);
    }

    // 정렬
    filteredServers.sort((a, b) => {
      const aValue = a[sortBy as keyof PaginatedServer];
      const bValue = b[sortBy as keyof PaginatedServer];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedServers = filteredServers.slice(startIndex, endIndex);

    const totalPages = Math.ceil(filteredServers.length / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return Promise.resolve({
      success: true,
      data: paginatedServers,
      pagination: {
        page,
        limit,
        total: filteredServers.length,
        totalPages,
        hasNext,
        hasPrev,
      },
      timestamp: new Date().toISOString(),
    });
  });

/**
 * 🖥️ 서버 Next API
 * 다음 서버 정보 또는 서버 페이지네이션을 처리하는 엔드포인트
 */
async function handleGET(request: NextRequest) {
  try {
    const response = await getHandler(request);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    );
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=30');
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=30');
    return response;
  } catch (error) {
    debug.error('❌ 서버 Next API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 정보 조회 중 오류가 발생했습니다',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGET);

// POST 핸들러
const postHandler = createApiRoute()
  .body(ServerBatchRequestSchema)
  .response(ServerBatchResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build(async (_request, context): Promise<ServerBatchResponse> => {
    const { action, serverIds, settings: _settings } = context.body;

    switch (action) {
      case 'batch-restart':
        return {
          success: true,
          results: serverIds.map((id) => ({
            serverId: id,
            success: true,
            message: '서버 재시작이 시작되었습니다',
          })),
          summary: {
            total: serverIds.length,
            succeeded: serverIds.length,
            failed: 0,
          },
          timestamp: new Date().toISOString(),
        };

      case 'batch-update':
        return {
          success: true,
          results: serverIds.map((id) => ({
            serverId: id,
            success: true,
            message: '서버 업데이트가 시작되었습니다',
          })),
          summary: {
            total: serverIds.length,
            succeeded: serverIds.length,
            failed: 0,
          },
          timestamp: new Date().toISOString(),
        };

      case 'batch-configure':
        return {
          success: true,
          results: serverIds.map((id) => ({
            serverId: id,
            success: true,
            message: '서버 설정이 업데이트되었습니다',
          })),
          summary: {
            total: serverIds.length,
            succeeded: serverIds.length,
            failed: 0,
          },
          timestamp: new Date().toISOString(),
        };

      case 'health-check':
        return {
          success: true,
          results: serverIds.map((id) => ({
            serverId: id,
            success: Math.random() > 0.1, // 90% success rate
            message: Math.random() > 0.1 ? '헬스체크 통과' : '헬스체크 실패',
          })),
          summary: {
            total: serverIds.length,
            succeeded: Math.floor(serverIds.length * 0.9),
            failed: Math.ceil(serverIds.length * 0.1),
          },
          timestamp: new Date().toISOString(),
        };

      default:
        return Promise.reject(new Error(`지원되지 않는 액션: ${action}`));
    }
  });

/**
 * POST 요청으로 서버 배치 작업 수행
 */
async function handlePOST(request: NextRequest) {
  try {
    return await postHandler(request);
  } catch (error) {
    debug.error('❌ 서버 배치 작업 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 배치 작업 중 오류가 발생했습니다',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePOST);

/**
 * OPTIONS - CORS 지원
 */
export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}
