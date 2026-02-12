/**
 * 🧪 SafeFormat Utilities 단위 테스트
 *
 * Vercel 무료 티어 안전:
 * - 순수 함수 테스트 (외부 API 호출 없음)
 * - Mock된 logger 사용
 * - 동기 연산만 수행
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractDaysFromUptime,
  isValidString,
  safeArrayAccess,
  safeFormatUptime,
  safeIncludes,
  safeJsonParse,
  safeNumber,
  safePercentage,
  safePropertyAccess,
} from './safeFormat';

describe('SafeFormat Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // safeFormatUptime 테스트
  // ============================================================================
  describe('safeFormatUptime', () => {
    it('should return "N/A" for null', () => {
      expect(safeFormatUptime(null)).toBe('N/A');
    });

    it('should return "N/A" for undefined', () => {
      expect(safeFormatUptime(undefined)).toBe('N/A');
    });

    it('should return trimmed string for string input', () => {
      expect(safeFormatUptime('  5 days  ')).toBe('5 days');
    });

    it('should return "N/A" for empty string', () => {
      expect(safeFormatUptime('')).toBe('N/A');
      expect(safeFormatUptime('   ')).toBe('N/A');
    });

    it('should format days and hours for large numbers', () => {
      // 3일 5시간 = 3 * 86400 + 5 * 3600 = 259200 + 18000 = 277200초
      const result = safeFormatUptime(277200);
      expect(result).toBe('3일 5시간');
    });

    it('should format hours and minutes for medium numbers', () => {
      // 5시간 30분 = 5 * 3600 + 30 * 60 = 18000 + 1800 = 19800초
      const result = safeFormatUptime(19800);
      expect(result).toBe('5시간 30분');
    });

    it('should format only minutes for small numbers', () => {
      // 45분 = 45 * 60 = 2700초
      const result = safeFormatUptime(2700);
      expect(result).toBe('45분');
    });

    it('should return "0일" for 0 or negative numbers', () => {
      expect(safeFormatUptime(0)).toBe('0일');
      expect(safeFormatUptime(-100)).toBe('0일');
    });

    it('should handle string numbers', () => {
      // 문자열이면 그대로 반환 (trim만 적용)
      expect(safeFormatUptime('123')).toBe('123');
    });

    it('should handle boolean values', () => {
      const result = safeFormatUptime(true);
      expect(result).toBe('true');
    });

    it('should handle object values', () => {
      const result = safeFormatUptime({ test: 'value' });
      expect(result).toContain('test');
    });
  });

  // ============================================================================
  // extractDaysFromUptime 테스트
  // ============================================================================
  describe('extractDaysFromUptime', () => {
    it('should extract days from "5 days" pattern', () => {
      expect(extractDaysFromUptime('5 days')).toBe(5);
      expect(extractDaysFromUptime('10 DAYS')).toBe(10);
      expect(extractDaysFromUptime('1 day')).toBe(1);
    });

    it('should extract days from "3일" pattern', () => {
      expect(extractDaysFromUptime('3일')).toBe(3);
      expect(extractDaysFromUptime('15일 전')).toBe(15);
    });

    it('should convert seconds to days for numeric strings', () => {
      // 86400초 = 1일
      expect(extractDaysFromUptime('86400')).toBe(1);
      // 172800초 = 2일
      expect(extractDaysFromUptime('172800')).toBe(2);
    });

    it('should convert seconds to days for number input', () => {
      expect(extractDaysFromUptime(86400)).toBe(1);
      expect(extractDaysFromUptime(259200)).toBe(3); // 3일
    });

    it('should return 0 for invalid input', () => {
      expect(extractDaysFromUptime(null)).toBe(0);
      expect(extractDaysFromUptime(undefined)).toBe(0);
      expect(extractDaysFromUptime('')).toBe(0);
      expect(extractDaysFromUptime('invalid')).toBe(0);
      expect(extractDaysFromUptime({})).toBe(0);
    });

    it('should return 0 for values less than 1 day in seconds', () => {
      expect(extractDaysFromUptime(3600)).toBe(0); // 1시간
      expect(extractDaysFromUptime(43200)).toBe(0); // 12시간
    });
  });

  // ============================================================================
  // isValidString 테스트
  // ============================================================================
  describe('isValidString', () => {
    it('should return true for non-empty strings', () => {
      expect(isValidString('hello')).toBe(true);
      expect(isValidString('a')).toBe(true);
      expect(isValidString('123')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isValidString('')).toBe(false);
      expect(isValidString('   ')).toBe(false);
      expect(isValidString('\t\n')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString(123)).toBe(false);
      expect(isValidString({})).toBe(false);
      expect(isValidString([])).toBe(false);
      expect(isValidString(true)).toBe(false);
    });
  });

  // ============================================================================
  // safeIncludes 테스트
  // ============================================================================
  describe('safeIncludes', () => {
    it('should return true when text includes searchString', () => {
      expect(safeIncludes('hello world', 'world')).toBe(true);
      expect(safeIncludes('testing', 'test')).toBe(true);
    });

    it('should return false when text does not include searchString', () => {
      expect(safeIncludes('hello world', 'foo')).toBe(false);
    });

    it('should return false for invalid text', () => {
      expect(safeIncludes(null, 'test')).toBe(false);
      expect(safeIncludes(undefined, 'test')).toBe(false);
      expect(safeIncludes(123, 'test')).toBe(false);
      expect(safeIncludes('', 'test')).toBe(false);
      expect(safeIncludes({}, 'test')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(safeIncludes('Hello', 'hello')).toBe(false);
      expect(safeIncludes('Hello', 'Hello')).toBe(true);
    });
  });

  // ============================================================================
  // safeArrayAccess 테스트
  // ============================================================================
  describe('safeArrayAccess', () => {
    it('should return element at valid index', () => {
      const arr = ['a', 'b', 'c'];
      expect(safeArrayAccess(arr, 0, 'default')).toBe('a');
      expect(safeArrayAccess(arr, 1, 'default')).toBe('b');
      expect(safeArrayAccess(arr, 2, 'default')).toBe('c');
    });

    it('should return fallback for out-of-range index', () => {
      const arr = ['a', 'b', 'c'];
      expect(safeArrayAccess(arr, 5, 'default')).toBe('default');
      expect(safeArrayAccess(arr, -1, 'default')).toBe('default');
      expect(safeArrayAccess(arr, 100, 'default')).toBe('default');
    });

    it('should return fallback for non-array', () => {
      expect(safeArrayAccess(null, 0, 'default')).toBe('default');
      expect(safeArrayAccess(undefined, 0, 'default')).toBe('default');
      expect(safeArrayAccess('string', 0, 'default')).toBe('default');
      expect(safeArrayAccess({}, 0, 'default')).toBe('default');
    });

    it('should work with different fallback types', () => {
      const arr = [1, 2, 3];
      expect(safeArrayAccess(arr, 10, 0)).toBe(0);
      expect(safeArrayAccess(arr, 10, null)).toBe(null);
      expect(safeArrayAccess(arr, 10, { key: 'value' })).toEqual({
        key: 'value',
      });
    });
  });

  // ============================================================================
  // safePropertyAccess 테스트
  // ============================================================================
  describe('safePropertyAccess', () => {
    it('should access simple property', () => {
      const obj = { name: 'test', value: 123 };
      expect(safePropertyAccess(obj, 'name', 'default')).toBe('test');
      expect(safePropertyAccess(obj, 'value', 0)).toBe(123);
    });

    it('should access nested property with dot notation', () => {
      const obj = { a: { b: { c: 'deep' } } };
      expect(safePropertyAccess(obj, 'a.b.c', 'default')).toBe('deep');
      expect(safePropertyAccess(obj, 'a.b', {})).toEqual({ c: 'deep' });
    });

    it('should return fallback for missing property', () => {
      const obj = { name: 'test' };
      expect(safePropertyAccess(obj, 'missing', 'default')).toBe('default');
      expect(safePropertyAccess(obj, 'a.b.c', 'default')).toBe('default');
    });

    it('should return fallback for non-object', () => {
      expect(safePropertyAccess(null, 'key', 'default')).toBe('default');
      expect(safePropertyAccess(undefined, 'key', 'default')).toBe('default');
      expect(safePropertyAccess('string', 'key', 'default')).toBe('default');
      expect(safePropertyAccess(123, 'key', 'default')).toBe('default');
    });

    it('should handle null in path chain', () => {
      const obj = { a: null };
      expect(safePropertyAccess(obj, 'a.b', 'default')).toBe('default');
    });
  });

  // ============================================================================
  // safeJsonParse 테스트
  // ============================================================================
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(safeJsonParse('{"key":"value"}', {})).toEqual({ key: 'value' });
      expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
      expect(safeJsonParse('"string"', '')).toBe('string');
      expect(safeJsonParse('123', 0)).toBe(123);
      expect(safeJsonParse('true', false)).toBe(true);
    });

    it('should return fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid json', {})).toEqual({});
      expect(safeJsonParse('{broken', { error: true })).toEqual({
        error: true,
      });
      expect(safeJsonParse('[1,2,', [])).toEqual([]);
    });

    it('should return fallback for non-string input', () => {
      expect(safeJsonParse(null, 'default')).toBe('default');
      expect(safeJsonParse(undefined, 'default')).toBe('default');
      expect(safeJsonParse(123, 'default')).toBe('default');
      expect(safeJsonParse({}, 'default')).toBe('default');
    });
  });

  // ============================================================================
  // safeNumber 테스트
  // ============================================================================
  describe('safeNumber', () => {
    it('should return number for valid number input', () => {
      expect(safeNumber(123)).toBe(123);
      expect(safeNumber(0)).toBe(0);
      expect(safeNumber(-50)).toBe(-50);
      expect(safeNumber(3.14)).toBe(3.14);
    });

    it('should parse string numbers', () => {
      expect(safeNumber('123')).toBe(123);
      expect(safeNumber('3.14')).toBe(3.14);
      expect(safeNumber('-50')).toBe(-50);
      expect(safeNumber('0')).toBe(0);
    });

    it('should return fallback for NaN', () => {
      expect(safeNumber(Number.NaN)).toBe(0);
      expect(safeNumber(Number.NaN, 100)).toBe(100);
    });

    it('should return fallback for non-numeric values', () => {
      expect(safeNumber(null, 0)).toBe(0);
      expect(safeNumber(undefined, 0)).toBe(0);
      expect(safeNumber('not a number', 0)).toBe(0);
      expect(safeNumber({}, 0)).toBe(0);
      expect(safeNumber([], 0)).toBe(0);
    });

    it('should use custom fallback value', () => {
      expect(safeNumber(null, 999)).toBe(999);
      expect(safeNumber('invalid', -1)).toBe(-1);
    });
  });

  // ============================================================================
  // safePercentage 테스트
  // ============================================================================
  describe('safePercentage', () => {
    it('should format percentage from 0-100 scale', () => {
      expect(safePercentage(50)).toBe('50%');
      expect(safePercentage(100)).toBe('100%');
      expect(safePercentage(0)).toBe('0%');
      expect(safePercentage(75.6)).toBe('76%'); // rounded
    });

    it('should format percentage from 0-1 scale (decimal)', () => {
      expect(safePercentage(0.5, true)).toBe('50%');
      expect(safePercentage(1, true)).toBe('100%');
      expect(safePercentage(0, true)).toBe('0%');
      expect(safePercentage(0.756, true)).toBe('76%'); // rounded
    });

    it('should handle invalid input', () => {
      expect(safePercentage(null)).toBe('0%');
      expect(safePercentage(undefined)).toBe('0%');
      expect(safePercentage('invalid')).toBe('0%');
    });

    it('should parse string numbers', () => {
      expect(safePercentage('85')).toBe('85%');
      expect(safePercentage('0.5', true)).toBe('50%');
    });
  });
});
