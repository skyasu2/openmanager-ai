import { describe, expect, it } from 'vitest';
import {
  dateDiff,
  formatPercentage,
  isEmpty,
  slugify,
  truncate,
} from './utils-functions';

describe('Utility Functions', () => {
  describe('formatPercentage', () => {
    it('formats numbers correctly', () => {
      expect(formatPercentage(75.123)).toBe('75.1%');
      expect(formatPercentage(75.123, 2)).toBe('75.12%');
    });

    it('handles null and undefined', () => {
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });
  });

  describe('truncate', () => {
    it('truncates string correctly', () => {
      expect(truncate('hello world', 5)).toBe('he...');
    });

    it('supports custom suffix', () => {
      expect(truncate('hello world', 5, '..')).toBe('hel..');
    });

    it('returns original string if short enough', () => {
      expect(truncate('hi', 5)).toBe('hi');
    });
  });

  describe('slugify', () => {
    it('converts string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('  Test  String  ')).toBe('test-string');
    });
  });

  describe('dateDiff', () => {
    it('calculates difference in ms', () => {
      const d1 = new Date('2023-01-01T00:00:00');
      const d2 = new Date('2023-01-01T00:00:01');
      expect(dateDiff(d1, d2)).toBe(1000);
    });
  });

  describe('isEmpty', () => {
    it('checks for empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
    });
  });
});
