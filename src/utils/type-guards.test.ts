/**
 * 🧪 타입 가드 함수 단위 테스트
 */

import { describe, expect, it } from 'vitest';
import {
  isErrorWithMessage,
  isRecord,
  isStringArray,
  toSafeArray,
  toSafeObject,
  toSafeString,
} from './safe-type-utils';

describe('Type Guard Functions', () => {
  describe('isErrorWithMessage', () => {
    it('should return true for Error instances', () => {
      const error = new Error('Test error');
      expect(isErrorWithMessage(error)).toBe(true);
    });

    it('should return true for objects with message property', () => {
      const errorLike = { message: 'Custom error' };
      expect(isErrorWithMessage(errorLike)).toBe(true);
    });

    it('should return false for objects without message', () => {
      const notError = { code: 'ERROR_CODE' };
      expect(isErrorWithMessage(notError)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isErrorWithMessage('string')).toBe(false);
      expect(isErrorWithMessage(123)).toBe(false);
      expect(isErrorWithMessage(null)).toBe(false);
      expect(isErrorWithMessage(undefined)).toBe(false);
    });

    it('should return false for objects with non-string message', () => {
      const invalidError = { message: 123 };
      expect(isErrorWithMessage(invalidError)).toBe(false);
    });
  });

  describe('isRecord', () => {
    it('should return true for plain objects', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ key: 'value' })).toBe(true);
      expect(isRecord({ nested: { obj: true } })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2, 3])).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isRecord('string')).toBe(false);
      expect(isRecord(123)).toBe(false);
      expect(isRecord(true)).toBe(false);
    });

    it('should return true for class instances', () => {
      class TestClass {}
      expect(isRecord(new TestClass())).toBe(true);
    });
  });

  describe('isStringArray', () => {
    it('should return true for arrays of strings', () => {
      expect(isStringArray([])).toBe(true);
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray([''])).toBe(true);
    });

    it('should return false for arrays with non-string elements', () => {
      expect(isStringArray([1, 2, 3])).toBe(false);
      expect(isStringArray(['a', 1, 'c'])).toBe(false);
      expect(isStringArray([null, undefined])).toBe(false);
      expect(isStringArray([{}])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isStringArray('string')).toBe(false);
      expect(isStringArray({})).toBe(false);
      expect(isStringArray(null)).toBe(false);
      expect(isStringArray(undefined)).toBe(false);
    });
  });

  describe('toSafeObject', () => {
    it('should return the object if it is a valid record', () => {
      const obj = { key: 'value' };
      expect(toSafeObject(obj)).toBe(obj);
    });

    it('should return empty object for non-records', () => {
      expect(toSafeObject(null)).toEqual({});
      expect(toSafeObject(undefined)).toEqual({});
      expect(toSafeObject('string')).toEqual({});
      expect(toSafeObject(123)).toEqual({});
      expect(toSafeObject([])).toEqual({});
    });
  });

  describe('toSafeArray', () => {
    it('should return the array if it is valid', () => {
      const arr = [1, 2, 3];
      expect(toSafeArray(arr)).toBe(arr);
    });

    it('should return empty array for non-arrays', () => {
      expect(toSafeArray(null)).toEqual([]);
      expect(toSafeArray(undefined)).toEqual([]);
      expect(toSafeArray('string')).toEqual([]);
      expect(toSafeArray({})).toEqual([]);
      expect(toSafeArray(123)).toEqual([]);
    });
  });

  describe('toSafeString', () => {
    it('should return the string if it is valid', () => {
      expect(toSafeString('hello')).toBe('hello');
      expect(toSafeString('')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(toSafeString(null)).toBe('');
      expect(toSafeString(undefined)).toBe('');
    });

    it('should convert other types to string', () => {
      expect(toSafeString(123)).toBe('123');
      expect(toSafeString(true)).toBe('true');
      expect(toSafeString(false)).toBe('false');
      expect(toSafeString({})).toBe('[object Object]');
      expect(toSafeString([1, 2, 3])).toBe('1,2,3');
    });
  });
});
