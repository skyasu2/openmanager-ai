import * as z from 'zod';

/**
 * 🔧 유틸리티 Zod 스키마
 *
 * 스키마 생성 및 검증을 위한 헬퍼 함수들
 */

// ===== 스키마 헬퍼 =====

/**
 * 선택적 필드를 nullable로 만드는 헬퍼
 */
export function nullable<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable();
}

/**
 * 선택적 필드를 optional로 만드는 헬퍼
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional();
}

/**
 * 배열을 최소 1개 이상으로 제한하는 헬퍼
 */
export function nonEmptyArray<T extends z.ZodTypeAny>(schema: T) {
  return z.array(schema).min(1);
}

/**
 * 문자열을 트림하는 헬퍼
 */
export function trimmedString(minLength = 1) {
  return z.string().trim().min(minLength);
}

/**
 * 이메일을 소문자로 변환하는 헬퍼
 */
export function emailString() {
  return z.string().email().toLowerCase();
}

/**
 * URL을 검증하고 정규화하는 헬퍼
 */
export function urlString(options?: { protocols?: string[] }) {
  return z
    .string()
    .url()
    .transform((url) => {
      const parsed = new URL(url);
      if (
        options?.protocols &&
        !options.protocols.includes(parsed.protocol.slice(0, -1))
      ) {
        throw new Error(`Invalid protocol: ${parsed.protocol}`);
      }
      return parsed.toString();
    });
}

/**
 * 날짜 문자열을 Date 객체로 변환하는 헬퍼
 */
export function dateString() {
  return z
    .string()
    .datetime()
    .transform((str) => new Date(str));
}

/**
 * 숫자 문자열을 숫자로 변환하는 헬퍼
 */
export function numericString() {
  return z.string().regex(/^\d+$/).transform(Number);
}

/**
 * JSON 문자열을 파싱하는 헬퍼
 */
export function jsonString<T extends z.ZodTypeAny>(schema: T) {
  return z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      return schema.parse(parsed);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Invalid JSON',
      });
      return z.NEVER;
    }
  });
}

// ===== 조건부 스키마 =====

/**
 * 조건부 필수 필드를 만드는 헬퍼
 */
export function requiredIf<T extends z.ZodTypeAny>(
  schema: T,
  condition: (data: unknown) => boolean
) {
  return schema.superRefine((val, ctx) => {
    if (condition(ctx) && (val === undefined || val === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'This field is required',
      });
    }
  });
}

/**
 * 상호 배타적인 필드를 검증하는 헬퍼
 */
export function exclusiveFields<T extends z.ZodRawShape>(
  shape: T,
  fields: Array<keyof T>,
  errorMessage = 'Only one of these fields can be provided'
) {
  return z.object(shape).superRefine((data, ctx) => {
    const dataRecord = data as Record<string, unknown>;
    const providedFields = fields.filter(
      (field) => dataRecord[field as string] !== undefined
    );
    if (providedFields.length > 1) {
      providedFields.forEach((field) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: errorMessage,
          path: [String(field)],
        });
      });
    }
  });
}

// ===== 변환 헬퍼 =====

/**
 * 빈 문자열을 undefined로 변환하는 헬퍼
 */
export function emptyStringToUndefined() {
  return z.string().transform((val) => (val === '' ? undefined : val));
}

/**
 * 불린 문자열을 불린으로 변환하는 헬퍼
 */
export function booleanString() {
  return z
    .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
    .transform((val) => ['true', '1', 'yes', 'on'].includes(val.toLowerCase()));
}

/**
 * 쉼표 구분 문자열을 배열로 변환하는 헬퍼
 */
export function csvString<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.string().transform((val) => {
    const items = val
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return z.array(itemSchema).parse(items);
  });
}

// ===== 검증 헬퍼 =====

/**
 * 스키마 검증 결과를 반환하는 헬퍼
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * 스키마 검증 에러를 포맷팅하는 헬퍼
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  });

  return formatted;
}

/**
 * 스키마 검증 에러를 단일 메시지로 포맷팅하는 헬퍼
 */
export function formatZodErrorMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(', ');
}

// ===== 타입 추론 헬퍼 =====

/**
 * 스키마에서 타입을 추론하는 헬퍼
 */
export type InferSchema<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * 부분적인 스키마를 만드는 헬퍼
 */
export function partial<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.partial();
}

/**
 * Pick 유틸리티 타입과 같은 기능의 헬퍼
 */
export function pick<
  T extends z.ZodObject<z.ZodRawShape>,
  K extends keyof z.infer<T>,
>(schema: T, keys: K[]) {
  const pickObj = keys.reduce(
    (acc, key) => {
      acc[key as string] = true;
      return acc;
    },
    {} as Record<string, true>
  );
  return schema.pick(pickObj);
}

/**
 * Omit 유틸리티 타입과 같은 기능의 헬퍼
 */
export function omit<
  T extends z.ZodObject<z.ZodRawShape>,
  K extends keyof z.infer<T>,
>(schema: T, keys: K[]) {
  const omitObj = keys.reduce(
    (acc, key) => {
      acc[key as string] = true;
      return acc;
    },
    {} as Record<string, true>
  );
  return schema.omit(omitObj);
}

// ===== 커스텀 검증 =====

/**
 * 한국어 전화번호 검증
 */
export const koreanPhoneNumber = z
  .string()
  .regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/, '올바른 전화번호 형식이 아닙니다');

/**
 * 한국어 사업자등록번호 검증
 */
export const businessRegistrationNumber = z
  .string()
  .regex(/^\d{3}-\d{2}-\d{5}$/, '올바른 사업자등록번호 형식이 아닙니다');

/**
 * 파일 크기 제한 검증
 */
export function fileSize(maxBytes: number) {
  return z
    .instanceof(File)
    .refine(
      (file) => file.size <= maxBytes,
      `파일 크기는 ${maxBytes / 1024 / 1024}MB를 초과할 수 없습니다`
    );
}

/**
 * 파일 타입 제한 검증
 */
export function fileType(allowedTypes: string[]) {
  return z
    .instanceof(File)
    .refine(
      (file) => allowedTypes.includes(file.type),
      `허용된 파일 타입: ${allowedTypes.join(', ')}`
    );
}
