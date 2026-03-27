/**
 * Development-only API middleware
 *
 * Blocks access to development/testing APIs in production environment
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Check if the current environment is production
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

/**
 * Block access in production environment
 *
 * @returns NextResponse with 404 if in production, null otherwise
 */
export function blockInProduction(): NextResponse | null {
  if (isProductionEnvironment()) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'This endpoint is only available in development environment',
      },
      { status: 404 }
    );
  }
  return null;
}

/**
 * Route handler function type for Next.js API routes
 */
type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Response | NextResponse | Promise<Response> | Promise<NextResponse>;

/**
 * Wrapper for development-only route handlers
 *
 * Usage:
 * ```typescript
 * export const GET = developmentOnly(async (request) => {
 *   // Your handler logic
 * });
 * ```
 */
export function developmentOnly<T extends RouteHandler>(handler: T): T {
  return ((
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    const blockResponse = blockInProduction();
    if (blockResponse) {
      return blockResponse;
    }
    return handler(request, context);
  }) as T;
}
