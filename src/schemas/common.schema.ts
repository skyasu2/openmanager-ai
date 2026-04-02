import * as z from 'zod';

/**
 * 🌐 공통 Zod 스키마 정의
 *
 * 프로젝트 전체에서 재사용되는 기본 스키마들
 */

// 🔧 Zod v4 ESM 호환 정수 검증 헬퍼 (공통)
// Zod v4의 .int() 메서드는 webpack 번들링 시 'int is not defined' 오류 발생
// .refine(Number.isInteger) 패턴으로 대체하여 런타임 안정성 확보
export const safeInt = () =>
  z.number().refine(Number.isInteger, { message: 'Must be an integer' });

// ===== 기본 타입 스키마 =====

// ID 관련
export const IdSchema = z.string().min(1);
export const UuidSchema = z.string().uuid();
const _SlugSchema = z.string().regex(/^[a-z0-9-]+$/);

// 타임스탬프
export const TimestampSchema = z.string().datetime();
const _DateSchema = z.string().date();
const _TimeSchema = z.string().time();

// 숫자 범위
export const PercentageSchema = z.number().min(0).max(100);
const _PositiveNumberSchema = z.number().positive();
const _NonNegativeNumberSchema = z.number().nonnegative();
// 🔧 Zod v4 ESM 호환: .int() 대신 safeInt() 사용
const _PortSchema = safeInt().min(1).max(65535);

// 문자열 패턴
const _EmailSchema = z.string().email();
const _UrlSchema = z.string().url();
// Note: z.string().ip() removed in Zod v4, use z.string() with custom validation if needed
const _IpAddressSchema = z.string();
const _JsonSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid JSON string',
    });
    return z.NEVER;
  }
});

// ===== 공통 구조 스키마 =====

// 페이지네이션
// 🔧 Zod v4 ESM 호환: .int() 대신 safeInt() 사용
export const PaginationRequestSchema = z.object({
  page: safeInt().min(1).default(1),
  limit: safeInt().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const PaginationResponseSchema = z.object({
  items: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

// API 응답
export const BaseResponseSchema = z.object({
  success: z.boolean(),
  timestamp: TimestampSchema,
  requestId: z.string().optional(),
});

const _SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  BaseResponseSchema.extend({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorResponseSchema = BaseResponseSchema.extend({
  success: z.literal(false),
  error: z.string(),
  errorCode: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// 메타데이터
export const MetadataSchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  // 🔧 Zod v4 ESM 호환: .int() 대신 safeInt() 사용
  version: safeInt()
    .refine((n) => n > 0, { message: 'Must be positive' })
    .default(1),
  tags: z.array(z.string()).default([]),
});

// 설정
export const ConfigurationSchema = z.object({
  enabled: z.boolean().default(true),
  name: z.string().min(1),
  description: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

// 상태
export const _StatusSchema = z.enum([
  'active',
  'inactive',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export const HealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
  'unknown',
]);

// 우선순위
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// 환경
export const EnvironmentSchema = z.enum([
  'development',
  'staging',
  'production',
  'test',
]);

// ===== 유틸리티 스키마 =====

// 선택적 필드를 null로 변환
const _NullableSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.null()]);

// 빈 문자열을 undefined로 변환
const _EmptyStringToUndefined = z
  .string()
  .transform((val) => (val === '' ? undefined : val));

// 문자열을 숫자로 변환
const _StringToNumber = z.string().transform((val, ctx) => {
  const parsed = parseFloat(val);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid number string',
    });
    return z.NEVER;
  }
  return parsed;
});

// 문자열을 불린으로 변환
const _StringToBoolean = z
  .string()
  .transform((val) => {
    const lower = val.toLowerCase();
    if (
      lower === 'true' ||
      lower === '1' ||
      lower === 'yes' ||
      lower === 'on'
    ) {
      return true;
    }
    if (
      lower === 'false' ||
      lower === '0' ||
      lower === 'no' ||
      lower === 'off'
    ) {
      return false;
    }
    return null;
  })
  .pipe(z.boolean());

// 안전한 JSON 파싱
const _SafeJsonSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .transform((val, ctx) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid JSON string',
          });
          return z.NEVER;
        }
      }
      return val;
    })
    .pipe(schema);
