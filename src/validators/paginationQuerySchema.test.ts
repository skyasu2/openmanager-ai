/**
 * paginationQuerySchema 단위 테스트
 * Zod v4 coerce API 검증
 *
 * @see src/validators/validation.ts
 */
import { describe, expect, it } from 'vitest';

import { paginationQuerySchema } from '@/validators/validation';

describe('paginationQuerySchema', () => {
  describe('page field', () => {
    it('should use default value 1 when page is undefined', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.page).toBe(1);
    });

    it('should coerce string "3" to number 3', () => {
      const result = paginationQuerySchema.parse({ page: '3' });
      expect(result.page).toBe(3);
    });

    it('should accept number directly', () => {
      const result = paginationQuerySchema.parse({ page: 5 });
      expect(result.page).toBe(5);
    });

    it('should reject negative numbers', () => {
      expect(() => paginationQuerySchema.parse({ page: -1 })).toThrow();
    });

    it('should reject zero', () => {
      expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('should reject non-integer values', () => {
      expect(() => paginationQuerySchema.parse({ page: 1.5 })).toThrow();
    });

    it('should reject non-numeric strings', () => {
      expect(() => paginationQuerySchema.parse({ page: 'abc' })).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => paginationQuerySchema.parse({ page: '' })).toThrow();
    });
  });

  describe('limit field', () => {
    it('should use default value 20 when limit is undefined', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('should coerce string "50" to number 50', () => {
      const result = paginationQuerySchema.parse({ limit: '50' });
      expect(result.limit).toBe(50);
    });

    it('should accept max value 100', () => {
      const result = paginationQuerySchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should reject values greater than 100', () => {
      expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject negative numbers', () => {
      expect(() => paginationQuerySchema.parse({ limit: -10 })).toThrow();
    });

    it('should reject zero', () => {
      expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow();
    });
  });

  describe('sort field', () => {
    it('should be undefined when not provided', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.sort).toBeUndefined();
    });

    it('should accept any string value', () => {
      const result = paginationQuerySchema.parse({ sort: 'createdAt' });
      expect(result.sort).toBe('createdAt');
    });
  });

  describe('order field', () => {
    it('should use default value "desc" when not provided', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.order).toBe('desc');
    });

    it('should accept "asc"', () => {
      const result = paginationQuerySchema.parse({ order: 'asc' });
      expect(result.order).toBe('asc');
    });

    it('should accept "desc"', () => {
      const result = paginationQuerySchema.parse({ order: 'desc' });
      expect(result.order).toBe('desc');
    });

    it('should reject invalid order values', () => {
      expect(() => paginationQuerySchema.parse({ order: 'invalid' })).toThrow();
    });
  });

  describe('full schema validation', () => {
    it('should parse complete valid input', () => {
      const result = paginationQuerySchema.parse({
        page: '2',
        limit: '30',
        sort: 'name',
        order: 'asc',
      });

      expect(result).toEqual({
        page: 2,
        limit: 30,
        sort: 'name',
        order: 'asc',
      });
    });

    it('should apply all defaults for empty object', () => {
      const result = paginationQuerySchema.parse({});

      expect(result).toEqual({
        page: 1,
        limit: 20,
        sort: undefined,
        order: 'desc',
      });
    });
  });
});
