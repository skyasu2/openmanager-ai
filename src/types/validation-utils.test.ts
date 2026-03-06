import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { validateQueryParams, validateRequestBody } from './validation-utils';

function makeRequest(body: string): NextRequest {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body,
  }) as unknown as NextRequest;
}

describe('validateRequestBody', () => {
  it('returns a 400 response when the body shape is invalid', async () => {
    const schema = z.object({ name: z.string(), enabled: z.boolean() });
    const result = await validateRequestBody(
      makeRequest(JSON.stringify({ name: 123, enabled: true })),
      schema
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected validation to fail');
    }

    expect(result.error.status).toBe(400);
    await expect(result.error.json()).resolves.toMatchObject({
      success: false,
      details: {
        name: expect.arrayContaining([
          expect.stringContaining('expected string'),
        ]),
      },
    });
  });

  it('returns a 400 response when the body is not valid JSON', async () => {
    const result = await validateRequestBody(
      makeRequest('not-json'),
      z.object({ name: z.string() })
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected validation to fail');
    }

    expect(result.error.status).toBe(400);
    await expect(result.error.json()).resolves.toMatchObject({
      success: false,
      error: '잘못된 요청 형식입니다',
      details: {
        body: expect.any(Array),
      },
    });
  });
});

describe('validateQueryParams', () => {
  it('keeps duplicate query keys as arrays before validating', () => {
    const schema = z.object({ tag: z.array(z.string()) });
    const result = validateQueryParams(
      new URLSearchParams('tag=cpu&tag=memory'),
      schema
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected validation to succeed');
    }

    expect(result.data).toEqual({ tag: ['cpu', 'memory'] });
  });
});
