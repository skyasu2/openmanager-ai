import { type NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { getErrorMessage } from './type-utils';
import { validateData } from './zod-utils';

export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<
  { success: true; data: z.infer<T> } | { success: false; error: NextResponse }
> {
  try {
    const body = await request.json();
    const result = validateData(schema, body);

    if (!result.success) {
      return {
        success: false,
        error: NextResponse.json(
          {
            success: false,
            error: result.error,
            details: result.details,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        ),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: '잘못된 요청 형식입니다',
          details: { body: [getErrorMessage(error)] },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      ),
    };
  }
}

export function validateQueryParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: NextResponse } {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      params[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      params[key] = value;
    }
  });

  const result = validateData(schema, params);

  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
