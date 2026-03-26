import * as z from 'zod';
import { getErrorMessage } from './type-utils';

/**
 * 🛡️ Zod 관련 유틸리티 함수들
 *
 * Zod 스키마 검증과 관련된 헬퍼 함수들
 */

// ===== 검증 결과 타입 =====

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[]> };

// ===== 기본 검증 함수 =====

/**
 * 안전한 파싱 with 에러 메시지
 */
export function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const formatted = formatZodErrors(result.error);
    return {
      success: false,
      error: formatted.message,
      details: formatted.details,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * 동기 검증 (성공 시 데이터 반환, 실패 시 throw)
 */
function _validateOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = validateData(schema, data);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}

/**
 * 비동기 검증
 */
async function _validateAsync<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const result = await schema.safeParseAsync(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const formatted = formatZodErrors(result.error);
    return {
      success: false,
      error: formatted.message,
      details: formatted.details,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// ===== 에러 포맷팅 =====

interface FormattedZodError {
  message: string;
  details: Record<string, string[]>;
}

/**
 * Zod 에러를 사용자 친화적으로 포맷팅
 */
export function formatZodErrors(error: z.ZodError): FormattedZodError {
  const details: Record<string, string[]> = {};
  const messages: string[] = [];

  error.issues.forEach((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';

    if (!details[path]) {
      details[path] = [];
    }

    details[path].push(issue.message);

    // 전체 메시지 구성
    if (path === 'root') {
      messages.push(issue.message);
    } else {
      messages.push(`${path}: ${issue.message}`);
    }
  });

  return {
    message: messages.join(', '),
    details,
  };
}

/**
 * 첫 번째 에러 메시지만 반환
 */
function _getFirstZodError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) return '검증 오류가 발생했습니다';

  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '';
  return path ? `${path}: ${firstIssue.message}` : firstIssue.message;
}

// ===== 스키마 변환 유틸리티 =====

/**
 * 스키마를 부분적으로 만들기 (모든 필드 optional)
 */
function _makePartial<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.partial();
}

/**
 * 스키마를 필수로 만들기 (모든 필드 required)
 */
function _makeRequired<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.required();
}

/**
 * 특정 필드만 선택
 */
function _pickFields<
  T extends z.ZodObject<z.ZodRawShape>,
  K extends keyof z.infer<T>,
>(schema: T, fields: K[]): z.ZodObject<z.ZodRawShape> {
  const picked: Record<string, z.ZodTypeAny> = {};
  fields.forEach((field) => {
    const fieldKey = field as string;
    const schemaShape = schema.shape as Record<string, z.ZodTypeAny>;
    if (schemaShape[fieldKey]) {
      picked[fieldKey] = schemaShape[fieldKey];
    }
  });
  return z.object(picked);
}

/**
 * 특정 필드 제외
 */
function _omitFields<
  T extends z.ZodObject<z.ZodRawShape>,
  K extends keyof z.infer<T>,
>(schema: T, fields: K[]): z.ZodObject<z.ZodRawShape> {
  const schemaShape = schema.shape as Record<string, z.ZodTypeAny>;
  const shape = { ...schemaShape };
  fields.forEach((field) => {
    delete shape[field as string];
  });
  return z.object(shape);
}

// ===== 조건부 검증 =====

/**
 * 조건부 검증 (다른 필드 값에 따라)
 */
function _conditionalValidation<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  conditions: Array<{
    when: (data: z.infer<T>) => boolean;
    then: (currentSchema: T) => T;
  }>
): T {
  return schema.superRefine((data, ctx) => {
    conditions.forEach((condition) => {
      if (condition.when(data)) {
        const updatedSchema = condition.then(schema);
        const result = updatedSchema.safeParse(data);

        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: issue.message,
              path: issue.path,
            });
          });
        }
      }
    });
  }) as unknown as T;
}

// ===== 배열 검증 유틸리티 =====

/**
 * 배열 중복 검사
 */
function _uniqueArray<T extends z.ZodTypeAny>(
  itemSchema: T,
  uniqueBy?: (item: z.infer<T>) => unknown
) {
  return z.array(itemSchema).refine(
    (items) => {
      const seen = new Set();
      for (const item of items) {
        const key = uniqueBy ? uniqueBy(item) : JSON.stringify(item);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
      }
      return true;
    },
    { message: '배열에 중복된 항목이 있습니다' }
  );
}

// ===== 문자열 변환 유틸리티 =====

/**
 * 트림된 문자열 (앞뒤 공백 제거)
 */
function _trimmedString(minLength = 0, maxLength?: number) {
  let schema = z.string().trim();

  if (minLength > 0) {
    schema = schema.min(minLength, `최소 ${minLength}자 이상이어야 합니다`);
  }

  if (maxLength !== undefined) {
    schema = schema.max(maxLength, `최대 ${maxLength}자까지 입력 가능합니다`);
  }

  return schema;
}

/**
 * 정규화된 이메일 (소문자 변환)
 */
function _normalizedEmail() {
  return z
    .string()
    .email('올바른 이메일 형식이 아닙니다')
    .transform((email) => email.toLowerCase().trim());
}

// ===== 날짜 검증 유틸리티 =====

/**
 * 날짜 범위 검증
 */
function _dateInRange(min?: Date, max?: Date) {
  return z
    .string()
    .datetime()
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        if (min && date < min) return false;
        if (max && date > max) return false;
        return true;
      },
      {
        message:
          min && max
            ? `날짜는 ${min.toISOString()}와 ${max.toISOString()} 사이여야 합니다`
            : min
              ? `날짜는 ${min.toISOString()} 이후여야 합니다`
              : `날짜는 ${max?.toISOString() || 'Unknown'} 이전이어야 합니다`,
      }
    );
}

// ===== 환경변수 검증 =====

/**
 * 환경변수 스키마 생성
 */
function _envSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).transform((env) => {
    // 환경변수 기본값 처리
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(env)) {
      // 'true'/'false' 문자열을 boolean으로 변환
      if (value === 'true') processed[key] = true;
      else if (value === 'false') processed[key] = false;
      // 숫자로 변환 가능한 경우 변환
      else if (typeof value === 'string' && /^\d+$/.test(value)) {
        processed[key] = parseInt(value, 10);
      } else {
        processed[key] = value;
      }
    }

    return processed as z.infer<z.ZodObject<T>>;
  });
}

// ===== API 응답 검증 =====

/**
 * API 응답 래퍼 생성
 */
function _apiResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      timestamp: z.string().datetime(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
      errorCode: z.string().optional(),
      timestamp: z.string().datetime(),
    }),
  ]);
}

// ===== 타입 가드 생성 =====

/**
 * Zod 스키마로부터 타입 가드 생성
 */
function _createTypeGuard<T extends z.ZodTypeAny>(schema: T) {
  return (value: unknown): value is z.infer<T> => {
    return schema.safeParse(value).success;
  };
}

/**
 * 여러 스키마 중 하나와 매칭되는지 확인
 */
function _matchesAnySchema(value: unknown, ...schemas: z.ZodTypeAny[]) {
  return schemas.some((schema) => schema.safeParse(value).success);
}
