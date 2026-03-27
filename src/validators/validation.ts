import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { logger } from '@/lib/logging';
import {
  validateQueryParams,
  validateRequestBody,
} from '@/types/validation-utils';

/**
 * 🛡️ API 검증 미들웨어
 *
 * API 요청/응답을 자동으로 검증하는 미들웨어
 */

// ===== 미들웨어 타입 정의 =====

export type ApiHandler<
  TBody = unknown,
  TQuery = unknown,
  _TResponse = unknown,
> = (
  request: NextRequest,
  context: {
    body?: TBody;
    query?: TQuery;
    params?: Record<string, string>;
  }
) => Promise<NextResponse> | NextResponse;

export interface ValidationSchemas<
  TBody = unknown,
  TQuery = unknown,
  TResponse = unknown,
> {
  body?: z.ZodSchema<TBody>;
  query?: z.ZodSchema<TQuery>;
  response?: z.ZodSchema<TResponse>;
}

// ===== 검증 미들웨어 팩토리 =====

/**
 * API 핸들러에 검증 기능을 추가하는 미들웨어
 */
function _withValidation<
  TBody = unknown,
  TQuery = unknown,
  TResponse = unknown,
>(
  schemas: ValidationSchemas<TBody, TQuery, TResponse>,
  handler: ApiHandler<TBody, TQuery, TResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const context: {
        body?: TBody;
        query?: TQuery;
        params?: Record<string, string>;
      } = {};

      // Body 검증
      if (schemas.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const bodyResult = await validateRequestBody(request, schemas.body);
        if (!bodyResult.success) {
          return bodyResult.error;
        }
        context.body = bodyResult.data;
      }

      // Query 파라미터 검증
      if (schemas.query) {
        const { searchParams } = new URL(request.url);
        const queryResult = validateQueryParams(searchParams, schemas.query);
        if (!queryResult.success) {
          return queryResult.error;
        }
        context.query = queryResult.data;
      }

      // 핸들러 실행
      const response = await handler(request, context);

      // Response 검증 (개발 환경에서만)
      if (schemas.response && process.env.NODE_ENV === 'development') {
        try {
          const responseData = await response.clone().json();
          const validationResult = schemas.response.safeParse(responseData);

          if (!validationResult.success) {
            logger.error('Response validation failed:', validationResult.error);
          }
        } catch (error) {
          logger.error('Failed to validate response:', error);
        }
      }

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// ===== 에러 처리 =====

/**
 * API 에러를 처리하고 적절한 응답 반환
 */
export function handleApiError(error: unknown): NextResponse {
  logger.error('API Error:', error);

  // Zod 검증 에러
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: '요청 데이터 검증 실패',
        details: error.format(),
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  // 커스텀 API 에러
  if (isApiError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      },
      { status: error.statusCode || 500 }
    );
  }

  // 일반 에러
  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  // 알 수 없는 에러
  return NextResponse.json(
    {
      success: false,
      error: '서버 오류가 발생했습니다',
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  );
}

// ===== 타입 가드 =====

type ApiError = {
  message: string;
  code?: string | number;
  statusCode?: number;
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    ('code' in error || 'statusCode' in error)
  );
}

// ===== 미들웨어 체인 =====

/**
 * 여러 미들웨어를 체인으로 연결
 */
function _composeMiddleware(
  ...middlewares: Array<(req: NextRequest) => Promise<NextResponse | null>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    for (const middleware of middlewares) {
      const response = await middleware(request);
      if (response) {
        return response;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'No handler found for this request',
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  };
}

// ===== 공통 검증 스키마 =====

/**
 * 페이지네이션 쿼리 스키마
 * Zod v4 coerce API 사용 - 문자열을 자동으로 숫자로 변환
 * 🔧 Zod v4 ESM 호환: .int() 대신 .refine(Number.isInteger) 사용
 */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .refine(Number.isInteger, { message: 'Must be an integer' })
    .refine((n) => n > 0, { message: 'Must be positive' })
    .default(1),
  limit: z.coerce
    .number()
    .refine(Number.isInteger, { message: 'Must be an integer' })
    .refine((n) => n > 0, { message: 'Must be positive' })
    .refine((n) => n <= 100, { message: 'Must be at most 100' })
    .default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * ID 파라미터 스키마
 */
const _idParamSchema = z.object({
  id: z.string().min(1),
});

/**
 * 검색 쿼리 스키마
 */
const _searchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ===== 헬퍼 함수 =====

/**
 * 성공 응답 생성
 */
function _successResponse<T>(
  data: T,
  metadata?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 에러 응답 생성
 */
function _errorResponse(
  message: string,
  statusCode = 500,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...details,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * 캐시 헤더 설정
 */
function _withCacheHeaders(
  response: NextResponse,
  maxAge = 60,
  sMaxAge = 300
): NextResponse {
  response.headers.set(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`
  );
  return response;
}

/**
 * CORS 헤더 설정
 */
function _withCorsHeaders(
  response: NextResponse,
  origin = '*',
  methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  return response;
}
