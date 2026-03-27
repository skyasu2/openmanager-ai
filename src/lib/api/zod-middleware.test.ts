import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

// ===== Mocks =====

const {
  mockLogger,
  mockGetCorsHeaders,
  mockValidateRequestBody,
  mockValidateQueryParams,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockGetCorsHeaders: vi.fn(() => ({ 'Access-Control-Allow-Origin': '*' })),
  mockValidateRequestBody: vi.fn(),
  mockValidateQueryParams: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({ logger: mockLogger }));
vi.mock('@/lib/api/cors', () => ({ getCorsHeaders: mockGetCorsHeaders }));
vi.mock('@/types/validation-utils', () => ({
  validateRequestBody: mockValidateRequestBody,
  validateQueryParams: mockValidateQueryParams,
}));

import {
  ApiRouteBuilder,
  createApiRoute,
  type MiddlewareConfig,
} from './zod-middleware';

// ===== Helpers =====

function makeRequest(
  method: string,
  url = 'http://localhost:3000/api/test',
  body?: Record<string, unknown>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { origin: 'http://localhost:3000' },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] =
      'application/json';
  }
  return new Request(url, init) as unknown as NextRequest;
}

async function parseJson(
  response: NextResponse
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

// ===== Tests =====

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateRequestBody.mockResolvedValue({ success: true, data: {} });
  mockValidateQueryParams.mockReturnValue({ success: true, data: {} });
});

describe('createApiRoute', () => {
  it('returns an ApiRouteBuilder instance', () => {
    const builder = createApiRoute();
    expect(builder).toBeInstanceOf(ApiRouteBuilder);
  });
});

describe('ApiRouteBuilder - builder pattern', () => {
  it('body() returns self for chaining', () => {
    const builder = createApiRoute();
    const result = builder.body(z.object({ name: z.string() }));
    expect(result).toBeInstanceOf(ApiRouteBuilder);
  });

  it('query() returns self for chaining', () => {
    const builder = createApiRoute();
    const result = builder.query(z.object({ page: z.string() }));
    expect(result).toBeInstanceOf(ApiRouteBuilder);
  });

  it('response() returns self for chaining', () => {
    const builder = createApiRoute();
    const result = builder.response(z.object({ id: z.number() }));
    expect(result).toBeInstanceOf(ApiRouteBuilder);
  });

  it('use() returns self for chaining', () => {
    const builder = createApiRoute();
    const result = builder.use(async (req) => req);
    expect(result).toBeInstanceOf(ApiRouteBuilder);
  });

  it('configure() returns self for chaining', () => {
    const builder = createApiRoute();
    const result = builder.configure({ timeout: 5000 });
    expect(result).toBeInstanceOf(ApiRouteBuilder);
  });
});

describe('build() - success path', () => {
  it('handler returns success response with data', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false })
      .build(async () => ({ message: 'ok' }));

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(json.success).toBe(true);
    expect(json.data).toEqual({ message: 'ok' });
  });

  it('response includes timestamp', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false })
      .build(async () => ({ id: 1 }));

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(json.timestamp).toBeDefined();
    expect(typeof json.timestamp).toBe('string');
  });

  it('CORS headers are included', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false })
      .build(async () => 'ok');

    const response = await handler(makeRequest('GET'));

    expect(mockGetCorsHeaders).toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('logs request when enableLogging is true', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: true })
      .build(async () => 'ok');

    await handler(makeRequest('GET'));

    expect(mockLogger.info).toHaveBeenCalled();
  });
});

describe('build() - body validation', () => {
  it('validates body for POST requests', async () => {
    const bodySchema = z.object({ name: z.string() });
    mockValidateRequestBody.mockResolvedValue({
      success: true,
      data: { name: 'test' },
    });

    const handler = createApiRoute()
      .body(bodySchema)
      .configure({ enableLogging: false })
      .build(async (_req, ctx) => ctx.body);

    const request = makeRequest('POST', undefined, { name: 'test' });
    const response = await handler(request);
    const json = await parseJson(response);

    expect(mockValidateRequestBody).toHaveBeenCalledWith(request, bodySchema);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ name: 'test' });
  });

  it('skips body validation for GET requests', async () => {
    const handler = createApiRoute()
      .body(z.object({ name: z.string() }))
      .configure({ enableLogging: false })
      .build(async () => 'ok');

    await handler(makeRequest('GET'));

    expect(mockValidateRequestBody).not.toHaveBeenCalled();
  });

  it('returns validation error response when body is invalid', async () => {
    const errorResponse = NextResponse.json(
      { success: false, error: 'Validation failed' },
      { status: 400 }
    );
    mockValidateRequestBody.mockResolvedValue({
      success: false,
      error: errorResponse,
    });

    const handler = createApiRoute()
      .body(z.object({ name: z.string() }))
      .configure({ enableLogging: false })
      .build(async () => 'ok');

    const response = await handler(
      makeRequest('POST', undefined, { name: 123 as unknown as string })
    );
    const json = await parseJson(response);

    expect(json.success).toBe(false);
    expect(response.status).toBe(400);
  });
});

describe('build() - query validation', () => {
  it('validates query params when querySchema is set', async () => {
    const querySchema = z.object({ page: z.string() });
    mockValidateQueryParams.mockReturnValue({
      success: true,
      data: { page: '1' },
    });

    const handler = createApiRoute()
      .query(querySchema)
      .configure({ enableLogging: false })
      .build(async (_req, ctx) => ctx.query);

    const response = await handler(
      makeRequest('GET', 'http://localhost:3000/api/test?page=1')
    );
    const json = await parseJson(response);

    expect(mockValidateQueryParams).toHaveBeenCalled();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ page: '1' });
  });
});

describe('build() - error handling (handleError)', () => {
  it('ZodError returns 400 with validation failure message', async () => {
    const zodError = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number',
      },
    ]);

    const handler = createApiRoute()
      .configure({ enableLogging: false, showDetailedErrors: false })
      .build(async () => {
        throw zodError;
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('요청 데이터 검증 실패');
  });

  it('timeout error returns 408', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false })
      .build(async () => {
        throw new Error('Request timeout');
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(408);
    expect(json.success).toBe(false);
    expect(json.error).toBe('요청 시간 초과');
  });

  it('generic Error returns 500', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false, showDetailedErrors: true })
      .build(async () => {
        throw new Error('Something went wrong');
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Something went wrong');
  });

  it('unknown error returns 500 with generic message', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false })
      .build(async () => {
        throw 'some string error';
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('알 수 없는 오류가 발생했습니다');
  });
});

describe('build() - middleware', () => {
  it('custom middleware can intercept and return response', async () => {
    const interceptResponse = NextResponse.json(
      { intercepted: true },
      { status: 403 }
    );

    const handler = createApiRoute()
      .use(async () => interceptResponse)
      .configure({ enableLogging: false })
      .build(async () => 'should not reach');

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(403);
    expect(json.intercepted).toBe(true);
  });

  it('custom onError handler is called on error', async () => {
    const customErrorResponse = NextResponse.json(
      { custom: true, error: 'handled' },
      { status: 422 }
    );
    const onError = vi.fn((..._args: never): unknown => customErrorResponse);

    const handler = createApiRoute()
      .configure({
        enableLogging: false,
        onError: onError as MiddlewareConfig['onError'],
      })
      .build(async () => {
        throw new Error('test error');
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(onError).toHaveBeenCalled();
    expect(response.status).toBe(422);
    expect(json.custom).toBe(true);
  });
});

describe('build() - timeout', () => {
  it('handler timeout returns 408', async () => {
    const handler = createApiRoute()
      .configure({ enableLogging: false, timeout: 50 })
      .build(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'too late';
      });

    const response = await handler(makeRequest('GET'));
    const json = await parseJson(response);

    expect(response.status).toBe(408);
    expect(json.success).toBe(false);
    expect(json.error).toBe('요청 시간 초과');
  });
});
