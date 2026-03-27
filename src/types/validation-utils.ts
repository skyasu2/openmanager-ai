import { type NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { logger } from '@/lib/logging';
import { getErrorMessage } from './type-utils';
import { formatZodErrors, validateData } from './zod-utils';

/**
 * ✅ 런타임 검증 유틸리티
 *
 * API 요청/응답 및 데이터 검증을 위한 유틸리티 함수들
 */

// ===== API 검증 미들웨어 =====

/**
 * API 요청 바디 검증
 */
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<
  { success: true; data: z.infer<T> } | { success: false; error: NextResponse }
> {
  try {
    const body = await request.json();
    const result = validateData(schema, body);

    if (!result.success) {
      return {
        success: false,
        error: NextResponse.json(
          {
            success: false,
            error: result.error,
            details: result.details,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        ),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: '잘못된 요청 형식입니다',
          details: { body: [getErrorMessage(error)] },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * API 쿼리 파라미터 검증
 */
export function validateQueryParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: NextResponse } {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      params[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      params[key] = value;
    }
  });

  const result = validateData(schema, params);

  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * API 응답 검증 (개발 환경에서만)
 */
function _validateResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): NextResponse {
  if (process.env.NODE_ENV === 'development') {
    const result = validateData(schema, data);

    if (!result.success) {
      logger.error('Response validation failed:', result.error);
      logger.error('Details:', result.details);

      return NextResponse.json(
        {
          success: false,
          error: '내부 서버 오류: 응답 데이터 검증 실패',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(data);
}

// ===== 폼 데이터 검증 =====

/**
 * FormData 검증
 */
function _validateFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
):
  | { success: true; data: z.infer<T> }
  | { success: false; errors: Record<string, string[]> } {
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    const existing = data[key];
    if (existing) {
      data[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      data[key] = value;
    }
  });

  const result = schema.safeParse(data);

  if (!result.success) {
    const formatted = formatZodErrors(result.error);
    return { success: false, errors: formatted.details };
  }

  return { success: true, data: result.data };
}

// ===== 환경변수 검증 =====

/**
 * 환경변수 검증 및 타입 안전성 보장
 */
function _validateEnv<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.infer<typeof schema> {
  const env = process.env;
  const result = schema.safeParse(env);

  if (!result.success) {
    const formatted = formatZodErrors(result.error);
    logger.error('환경변수 검증 실패:');
    logger.error(formatted.message);

    if (process.env.NODE_ENV === 'development') {
      logger.error('상세 오류:', formatted.details);
    }

    throw new Error(`환경변수 검증 실패: ${formatted.message}`);
  }

  return result.data;
}

// ===== 데이터 변환 및 정제 =====

/**
 * 안전한 JSON 파싱
 */
function _safeJsonParse<T extends z.ZodTypeAny>(
  jsonString: string,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString);
    const result = validateData(schema, parsed);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: `JSON 파싱 실패: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * 데이터 정제 (unknown 타입 제거)
 */
function _sanitizeData<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): z.infer<T> | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// ===== 배치 검증 =====

/**
 * 여러 항목 배치 검증
 */
function _validateBatch<T extends z.ZodTypeAny>(
  items: unknown[],
  schema: T
): {
  valid: Array<{ index: number; data: z.infer<T> }>;
  invalid: Array<{
    index: number;
    error: string;
    details?: Record<string, string[]>;
  }>;
} {
  const valid: Array<{ index: number; data: z.infer<T> }> = [];
  const invalid: Array<{
    index: number;
    error: string;
    details?: Record<string, string[]>;
  }> = [];

  items.forEach((item, index) => {
    const result = validateData(schema, item);

    if (result.success) {
      valid.push({ index, data: result.data });
    } else {
      invalid.push({
        index,
        error: result.error,
        details: result.details,
      });
    }
  });

  return { valid, invalid };
}

// ===== 커스텀 검증 함수 =====

/**
 * 이메일 도메인 검증
 */
function _validateEmailDomain(
  email: string,
  allowedDomains: string[]
): boolean {
  const domain = email.split('@')[1];
  return domain ? allowedDomains.includes(domain) : false;
}

/**
 * 파일 확장자 검증
 */
function _validateFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? allowedExtensions.includes(extension) : false;
}

/**
 * IP 주소 범위 검증
 */
function _validateIpRange(
  ip: string,
  ranges: Array<{ start: string; end: string }>
): boolean {
  const ipToNumber = (ip: string) => {
    const parts = ip.split('.').map(Number);
    return (
      ((parts[0] ?? 0) << 24) +
      ((parts[1] ?? 0) << 16) +
      ((parts[2] ?? 0) << 8) +
      (parts[3] ?? 0)
    );
  };

  const ipNum = ipToNumber(ip);

  return ranges.some((range) => {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    return ipNum >= startNum && ipNum <= endNum;
  });
}

// ===== 보안 검증 =====

/**
 * SQL 인젝션 방지 검증
 */
function _validateSqlSafe(value: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
    /(\bOR\b\s*\d+\s*=\s*\d+)/i,
    /(\bAND\b\s*\d+\s*=\s*\d+)/i,
  ];

  return !sqlPatterns.some((pattern) => pattern.test(value));
}

/**
 * XSS 방지 검증
 */
function _validateXssSafe(value: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  return !xssPatterns.some((pattern) => pattern.test(value));
}

// ===== 헬퍼 함수 =====

/**
 * 검증 결과를 HTTP 응답으로 변환
 */
function _validationResultToResponse<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: string; details?: Record<string, string[]> }
): NextResponse {
  if (result.success) {
    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error,
      details: result.details,
      timestamp: new Date().toISOString(),
    },
    { status: 400 }
  );
}

/**
 * 조건부 필수 필드 검증
 */
function _requireIf<T>(
  value: T | undefined,
  condition: boolean,
  errorMessage = '이 필드는 필수입니다'
): T | undefined {
  if (condition && value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}
