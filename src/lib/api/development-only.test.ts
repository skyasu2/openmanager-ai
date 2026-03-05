import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  blockInProduction,
  developmentOnly,
  isProductionEnvironment,
} from './development-only';

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalVercelEnv !== undefined) {
    process.env.VERCEL_ENV = originalVercelEnv;
  } else {
    delete process.env.VERCEL_ENV;
  }
});

describe('isProductionEnvironment', () => {
  it('returns false when NODE_ENV is "test" (default)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;

    expect(isProductionEnvironment()).toBe(false);
  });

  it('returns true when NODE_ENV is "production"', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL_ENV;

    expect(isProductionEnvironment()).toBe(true);
  });

  it('returns true when VERCEL_ENV is "production" even if NODE_ENV is not', () => {
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'production';

    expect(isProductionEnvironment()).toBe(true);
  });

  it('returns false when both are not "production"', () => {
    process.env.NODE_ENV = 'development';
    process.env.VERCEL_ENV = 'preview';

    expect(isProductionEnvironment()).toBe(false);
  });
});

describe('blockInProduction', () => {
  it('returns null when not in production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;

    expect(blockInProduction()).toBeNull();
  });

  it('returns NextResponse with status 404 when in production', () => {
    process.env.NODE_ENV = 'production';

    const response = blockInProduction();

    expect(response).not.toBeNull();
    expect(response!.status).toBe(404);
  });

  it('response body contains "Not Found" error', async () => {
    process.env.NODE_ENV = 'production';

    const response = blockInProduction();
    const body = await response!.json();

    expect(body).toEqual({
      error: 'Not Found',
      message: 'This endpoint is only available in development environment',
    });
  });
});

describe('developmentOnly', () => {
  it('calls handler in non-production environment', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;

    const handler = vi.fn((..._args: never) => new Response('ok'));
    const wrapped = developmentOnly(handler);

    const request = new NextRequest('http://localhost:3000/api/test');
    wrapped(request);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 404 without calling handler in production', () => {
    process.env.NODE_ENV = 'production';

    const handler = vi.fn((..._args: never) => new Response('ok'));
    const wrapped = developmentOnly(handler);

    const request = new NextRequest('http://localhost:3000/api/test');
    const response = wrapped(request);

    expect(handler).not.toHaveBeenCalled();
    expect(response).toBeDefined();
    expect((response as Response).status).toBe(404);
  });

  it('passes request and context to handler', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;

    const handler = vi.fn((..._args: never) => new Response('ok'));
    const wrapped = developmentOnly(handler);

    const request = new NextRequest('http://localhost:3000/api/test');
    const context = { params: Promise.resolve({ id: '123' }) };
    wrapped(request, context);

    expect(handler).toHaveBeenCalledWith(request, context);
  });
});
