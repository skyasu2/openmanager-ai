import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { getCorsHeaders } from '@/lib/api/cors';
import { logger } from '@/lib/logging';
import {
  validateQueryParams,
  validateRequestBody,
} from '@/types/validation-utils';

/**
 * 🔧 Zod 스키마 기반 API 미들웨어
 *
 * Zod 스키마를 사용한 고급 API 검증 기능
 */

// ===== 미들웨어 설정 =====

export interface MiddlewareConfig {
  // 검증 실패 시 상세 에러 표시 여부
  showDetailedErrors?: boolean;
  // 응답 검증 활성화 여부
  validateResponse?: boolean;
  // 타임아웃 설정 (ms)
  timeout?: number;
  // 로깅 활성화
  enableLogging?: boolean;
  // 커스텀 에러 핸들러
  onError?: (
    error: unknown,
    request: NextRequest
  ) => NextResponse | Promise<NextResponse>;
}

const defaultConfig: MiddlewareConfig = {
  showDetailedErrors: process.env.NODE_ENV === 'development',
  validateResponse: process.env.NODE_ENV === 'development',
  timeout: 30000, // 30초
  enableLogging: true,
};

// ===== API 라우트 빌더 =====

export class ApiRouteBuilder<
  TBody = unknown,
  TQuery = unknown,
  TResponse = unknown,
> {
  private bodySchema?: z.ZodSchema<TBody>;
  private querySchema?: z.ZodSchema<TQuery>;
  private responseSchema?: z.ZodSchema<TResponse>;
  private middlewares: Array<
    (req: NextRequest) => Promise<NextRequest | NextResponse>
  > = [];
  private config: MiddlewareConfig = defaultConfig;

  /**
   * 요청 바디 스키마 설정
   */
  body<T>(schema: z.ZodSchema<T>): ApiRouteBuilder<T, TQuery, TResponse> {
    this.bodySchema = schema as unknown as z.ZodSchema<TBody>;
    return this as unknown as ApiRouteBuilder<T, TQuery, TResponse>;
  }

  /**
   * 쿼리 파라미터 스키마 설정
   */
  query<T>(schema: z.ZodSchema<T>): ApiRouteBuilder<TBody, T, TResponse> {
    this.querySchema = schema as unknown as z.ZodSchema<TQuery>;
    return this as unknown as ApiRouteBuilder<TBody, T, TResponse>;
  }

  /**
   * 응답 스키마 설정
   */
  response<T>(schema: z.ZodSchema<T>): ApiRouteBuilder<TBody, TQuery, T> {
    this.responseSchema = schema as unknown as z.ZodSchema<TResponse>;
    return this as unknown as ApiRouteBuilder<TBody, TQuery, T>;
  }

  /**
   * 커스텀 미들웨어 추가
   */
  use(
    middleware: (req: NextRequest) => Promise<NextRequest | NextResponse>
  ): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 설정 변경
   */
  configure(config: Partial<MiddlewareConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * 핸들러 빌드
   */
  build(
    handler: (
      request: NextRequest,
      context: {
        body: TBody;
        query: TQuery;
        params: Record<string, string>;
      }
    ) => Promise<TResponse> | TResponse
  ) {
    return async (
      request: NextRequest,
      { params = {} }: { params?: Record<string, string> } = {}
    ) => {
      const startTime = Date.now();

      try {
        // 로깅
        if (this.config.enableLogging) {
          logger.info(`[API] ${request.method} ${request.url}`);
        }

        // 타임아웃 처리
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Request timeout')),
            this.config.timeout
          );
        });

        // 커스텀 미들웨어 실행
        for (const middleware of this.middlewares) {
          const result = await middleware(request);
          if (result instanceof NextResponse) {
            return result;
          }
          request = result;
        }

        // 컨텍스트 초기화
        const context: {
          body: TBody;
          query: TQuery;
          params: Record<string, string>;
        } = {
          body: {} as TBody,
          query: {} as TQuery,
          params,
        };

        // Body 검증
        if (
          this.bodySchema &&
          ['POST', 'PUT', 'PATCH'].includes(request.method)
        ) {
          const bodyResult = await validateRequestBody(
            request,
            this.bodySchema
          );
          if (!bodyResult.success) {
            return bodyResult.error;
          }
          context.body = bodyResult.data;
        }

        // Query 검증
        if (this.querySchema) {
          const { searchParams } = new URL(request.url);
          const queryResult = validateQueryParams(
            searchParams,
            this.querySchema
          );
          if (!queryResult.success) {
            return queryResult.error;
          }
          context.query = queryResult.data;
        }

        // 핸들러 실행 (타임아웃 포함)
        const responseData = (await Promise.race([
          handler(request, context),
          timeoutPromise,
        ])) as TResponse;

        // 응답 검증
        if (this.responseSchema && this.config.validateResponse) {
          const validationResult = this.responseSchema.safeParse(responseData);
          if (!validationResult.success) {
            logger.error('Response validation failed:', validationResult.error);

            if (this.config.showDetailedErrors) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'Response validation failed',
                  details: validationResult.error.format(),
                  timestamp: new Date().toISOString(),
                },
                { status: 500 }
              );
            }
          }
        }

        // 성공 응답 (CORS 헤더 포함)
        const origin = request.headers.get('origin');
        const response = NextResponse.json(
          {
            success: true,
            data: responseData,
            timestamp: new Date().toISOString(),
          },
          {
            headers: getCorsHeaders(origin),
          }
        );

        // 로깅
        if (this.config.enableLogging) {
          const duration = Date.now() - startTime;
          logger.info(`[API] ${request.method} ${request.url} - ${duration}ms`);
        }

        return response;
      } catch (error) {
        // 커스텀 에러 핸들러
        if (this.config.onError) {
          return await this.config.onError(error, request);
        }

        // 기본 에러 처리
        return this.handleError(error, request);
      }
    };
  }

  /**
   * 에러 처리
   */
  private handleError(error: unknown, request: NextRequest): NextResponse {
    logger.error(`[API Error] ${request.method} ${request.url}:`, error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '요청 데이터 검증 실패',
          details: this.config.showDetailedErrors ? error.format() : undefined,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 타임아웃 에러
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        {
          success: false,
          error: '요청 시간 초과',
          timestamp: new Date().toISOString(),
        },
        { status: 408 }
      );
    }

    // 일반 에러
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: this.config.showDetailedErrors
            ? error.message
            : '서버 오류가 발생했습니다',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // 알 수 없는 에러
    return NextResponse.json(
      {
        success: false,
        error: '알 수 없는 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ===== 팩토리 함수 =====

/**
 * API 라우트 빌더 생성
 */
export function createApiRoute() {
  return new ApiRouteBuilder();
}
