import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SENTRY_DSN =
  'https://c4cfe13cdda790d1d9a6c3f92c593f39@o4509732473667584.ingest.de.sentry.io/4510731369119824';

function getTunnelEndpoint(): string | null {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim() ||
    DEFAULT_SENTRY_DSN;

  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/^\/+/, '');
    if (!projectId) return null;
    return `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const endpoint = getTunnelEndpoint();
  if (!endpoint) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    const envelope = await request.text();
    if (!envelope) {
      return new NextResponse(null, { status: 202 });
    }

    const contentType =
      request.headers.get('content-type') || 'application/x-sentry-envelope';

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: envelope,
      cache: 'no-store',
    });

    if (!upstream.ok) {
      logger.warn(
        `[SentryTunnel] Upstream rejected event (status=${upstream.status})`
      );
    }
  } catch (error) {
    logger.warn('[SentryTunnel] Proxy failed:', error);
  }

  // 클라이언트 콘솔 노이즈를 줄이기 위해 항상 수신 성공으로 응답
  return new NextResponse(null, { status: 202 });
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: 'Sentry tunnel endpoint is available.',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
