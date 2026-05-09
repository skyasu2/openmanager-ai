import { type NextRequest, NextResponse } from 'next/server';

function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/dashboard';
  if (!path.startsWith('/')) return '/dashboard';
  if (path.startsWith('//')) return '/dashboard';
  if (path.includes('\n') || path.includes('\r')) return '/dashboard';
  return path;
}

export function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeRedirectPath(
    requestUrl.searchParams.get('next') ||
      requestUrl.searchParams.get('redirectTo')
  );

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
