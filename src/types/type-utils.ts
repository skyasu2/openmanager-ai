/**
 * 타입 안전성을 위한 유틸리티 함수들
 *
 * @updated 2026-01-11 - 미사용 함수 16개 제거 (319줄 → 170줄)
 */

// ===== 기본 타입 가드 =====

// Error 타입 가드
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Error 메시지 안전 추출
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '알 수 없는 오류가 발생했습니다.';
}

// ===== 안전한 접근 함수 =====

// 배열 안전 접근
export function safeArrayAccess<T>(array: T[], index: number): T | undefined {
  return array && array.length > index && index >= 0 ? array[index] : undefined;
}

// 객체 속성 안전 접근
function _safeObjectAccess<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  return obj?.[key];
}

// undefined가 아닌지 확인하는 타입 가드
function _isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// null과 undefined가 아닌지 확인하는 타입 가드
export function isNotNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return value !== null && value !== undefined;
}

// 안전한 JSON 파싱
function _safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// 안전한 객체 키 접근
function _safeObjectKeyAccess<T>(
  obj: Record<string, T> | undefined,
  key: string
): T | undefined {
  return obj?.[key];
}

// 기본값과 함께 안전한 접근
function _withDefault<T>(value: T | undefined | null, defaultValue: T): T {
  return isNotNullOrUndefined(value) ? value : defaultValue;
}

// 배열에서 안전한 find
function _safeFindInArray<T>(
  array: T[],
  predicate: (item: T) => boolean
): T | undefined {
  return array.find(predicate);
}

// 타입 안전한 Object.keys
function _getObjectKeys<T extends Record<string, unknown>>(
  obj: T
): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

// 타입 안전한 Object.entries
function _getObjectEntries<T extends Record<string, unknown>>(
  obj: T
): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

// useEffect 안전 반환 (cleanup 함수 또는 undefined)
function _safeUseEffectReturn(cleanup?: () => void): (() => void) | undefined {
  return cleanup;
}

// 배열 인덱스 안전 접근 (기본값 포함)
function _getArrayElement<T>(
  array: T[],
  index: number,
  defaultValue?: T
): T | undefined {
  const element = safeArrayAccess(array, index);
  return element !== undefined ? element : defaultValue;
}

// 객체 속성 존재 확인
function _hasProperty<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  key: string
): boolean {
  return obj != null && key in obj;
}

// ===== unknown 타입 처리를 위한 타입 가드 =====

// 객체인지 확인하는 기본 타입 가드
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 배열인지 확인하는 타입 가드
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// 문자열인지 확인하는 타입 가드
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// 숫자인지 확인하는 타입 가드
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

// 불린인지 확인하는 타입 가드
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// 강화된 속성 존재 확인 (unknown 객체용)
export function hasPropertyOfType<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

// 특정 타입의 속성을 가진 객체인지 확인
function _hasStringProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, string> & Record<string, unknown> {
  return hasPropertyOfType(obj, key) && isString(obj[key]);
}

export function hasNumberProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, number> & Record<string, unknown> {
  return hasPropertyOfType(obj, key) && isNumber(obj[key]);
}

function _hasBooleanProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, boolean> & Record<string, unknown> {
  return hasPropertyOfType(obj, key) && isBoolean(obj[key]);
}

// API 응답 구조 검증을 위한 복합 타입 가드
function _isApiResponse(value: unknown): value is {
  data: unknown;
  status?: string;
  error?: string;
} {
  return isObject(value) && hasPropertyOfType(value, 'data');
}

// 서버 메트릭 구조 검증
function _isServerMetricsLike(value: unknown): value is {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
} {
  return (
    isObject(value) &&
    hasNumberProperty(value, 'cpu_usage') &&
    hasNumberProperty(value, 'memory_usage') &&
    hasNumberProperty(value, 'disk_usage')
  );
}

// 배열의 모든 요소가 특정 타입인지 확인
function _isArrayOf<T>(
  value: unknown,
  itemCheck: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(itemCheck);
}

// 안전한 JSON 파싱 (강화 버전)
function _safeJsonParseWithValidation<T>(
  json: string,
  validator: (parsed: unknown) => parsed is T,
  fallback: T
): T {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
