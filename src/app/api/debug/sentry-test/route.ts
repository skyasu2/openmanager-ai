/**
 * Sentry Test Endpoint
 *
 * 테스트용 에러를 발생시켜 Sentry 연동 확인
 * Production에서만 실제 에러 전송
 */

import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// Sentry DSN (환경변수에서만 로드 — 하드코딩 금지)
const SENTRY_DSN =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '';

// Sentry 초기화 (serverless 환경에서 필요)
function ensureSentryInitialized() {
  if (!Sentry.getClient()) {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
      enabled: process.env.NODE_ENV === 'production',
      debug: false,
    });
  }
}

async function handleGET(request: NextRequest) {
  // Sentry 초기화 확인
  ensureSentryInitialized();

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'info';

  // 상태 정보
  if (action === 'info') {
    // Sentry 클라이언트 상태 확인
    const client = Sentry.getClient();
    const options = client?.getOptions();

    return NextResponse.json({
      status: 'ok',
      sentry: {
        enabled: process.env.NODE_ENV === 'production',
        dsn: SENTRY_DSN ? 'configured' : 'missing',
        dsnSource: process.env.SENTRY_DSN
          ? 'env'
          : process.env.NEXT_PUBLIC_SENTRY_DSN
            ? 'next_public'
            : 'fallback',
        environment: process.env.NODE_ENV,
        // SDK 클라이언트 상태
        clientInitialized: !!client,
        sdkEnabled: options?.enabled ?? 'unknown',
        sdkDsn: options?.dsn ? 'set' : 'not set',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 테스트 에러 발생
  if (action === 'error') {
    try {
      // 의도적 에러 발생
      throw new Error('Sentry Test Error - 테스트용 에러입니다');
    } catch (error) {
      // Sentry에 에러 전송
      Sentry.captureException(error, {
        tags: {
          type: 'test',
          endpoint: '/api/debug/sentry-test',
        },
        extra: {
          triggered_at: new Date().toISOString(),
          user_agent: request.headers.get('user-agent'),
        },
      });

      // Sentry에 이벤트 플러시
      await Sentry.flush(2000);

      return NextResponse.json({
        status: 'error_sent',
        message: 'Test error captured and sent to Sentry',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 테스트 메시지 전송
  if (action === 'message') {
    Sentry.captureMessage('Sentry Test Message - 연결 테스트', {
      level: 'info',
      tags: { type: 'test' },
    });

    await Sentry.flush(2000);

    return NextResponse.json({
      status: 'message_sent',
      message: 'Test message sent to Sentry',
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export const GET = withAuth(handleGET);
