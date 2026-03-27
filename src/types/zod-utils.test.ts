import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { formatZodErrors, validateData } from './zod-utils';

describe('validateData', () => {
  it('returns nested field details for invalid payloads', () => {
    const schema = z.object({
      user: z.object({
        name: z.string().min(3),
        age: z.number().int(),
      }),
    });

    const result = validateData(schema, {
      user: { name: 'ab', age: 'invalid' },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected validation to fail');
    }

    expect(result.error).toContain('user.name');
    expect(result.error).toContain('user.age');
    expect(result.details).toMatchObject({
      'user.name': expect.arrayContaining([
        expect.stringContaining('>=3 characters'),
      ]),
      'user.age': expect.arrayContaining([
        expect.stringContaining('expected number'),
      ]),
    });
  });
});

describe('formatZodErrors', () => {
  it('keeps root-level refine errors under the root key', () => {
    const schema = z.object({ name: z.string() }).refine(() => false, {
      message: 'root failure',
    });

    const parsed = schema.safeParse({ name: 'openmanager' });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error('expected validation to fail');
    }

    const formatted = formatZodErrors(parsed.error);

    expect(formatted.message).toBe('root failure');
    expect(formatted.details).toEqual({ root: ['root failure'] });
  });
});
