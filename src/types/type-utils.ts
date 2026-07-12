export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '알 수 없는 오류가 발생했습니다.';
}

export function safeArrayAccess<T>(array: T[], index: number): T | undefined {
  return array && array.length > index && index >= 0 ? array[index] : undefined;
}

export function isNotNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return value !== null && value !== undefined;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function hasPropertyOfType<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasNumberProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, number> & Record<string, unknown> {
  return hasPropertyOfType(obj, key) && isNumber(obj[key]);
}
