/**
 * Sentry Tunnel API Route
 *
 * ad-blocker를 우회하여 Sentry 이벤트를 프록시
 * Next.js App Router 수동 tunnel 구현
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/cors';
import { logger } from '@/lib/logging';

// Sentry DSN 파싱 - 환경변수 필수
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// DSN에서 Sentry ingest URL 추출
function getSentryIngestUrl(): string | null {
  if (!SENTRY_DSN) {
    logger.warn('[Sentry Tunnel] SENTRY_DSN 환경변수 미설정');
    return null;
  }

  try {
    const url = new URL(SENTRY_DSN);
    const projectId = url.pathname.replace('/', '');
    return `https://${url.host}/api/${projectId}/envelope/`;
  } catch {
    logger.error('[Sentry Tunnel] Invalid SENTRY_DSN format');
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();

    if (!body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    const sentryUrl = getSentryIngestUrl();
    if (!sentryUrl) {
      return new NextResponse(null, { status: 204 });
    }

    // Sentry로 이벤트 전달
    const response = await fetch(sentryUrl, {
      method: 'POST',
      body,
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
    });

    // Sentry 응답 전달
    const responseText = await response.text();

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    logger.error('[Sentry Tunnel] Error:', error);
    return NextResponse.json({ error: 'Tunnel error' }, { status: 500 });
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}
