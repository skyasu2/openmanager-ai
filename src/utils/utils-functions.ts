import { safeErrorMessage as coreErrorMessage } from '../lib/error-handler';

export function safeErrorMessage(
  error: unknown,
  fallback = 'Unknown error'
): string {
  return coreErrorMessage(error, fallback);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj))
    return obj.map((item) => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

export function formatPercentage(
  value: number | null | undefined,
  decimals = 1
): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return `${(0).toFixed(decimals)}%`;
  }
  return `${num.toFixed(decimals)}%`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(
  str: string,
  length: number,
  suffix: string = '...'
): string {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 특수문자 제거
    .replace(/[\s_-]+/g, '-') // 공백과 언더스코어를 하이픈으로
    .replace(/^-+|-+$/g, ''); // 시작과 끝의 하이픈 제거
}

export function dateDiff(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime());
}
