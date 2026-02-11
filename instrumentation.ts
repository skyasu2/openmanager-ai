/**
 * Next.js Instrumentation (Next.js 16 권장 방식)
 *
 * 앱 시작 시 실행되는 초기화 코드
 * - Sentry Server/Edge SDK 통합 초기화
 * - 환경변수 검증
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

// Sentry DSN (Public Key - 전송만 가능, 읽기 불가)
const SENTRY_DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://c4cfe13cdda790d1d9a6c3f92c593f39@o4509732473667584.ingest.de.sentry.io/4510731369119824';

export async function register() {
  // Node.js 런타임 (Server)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: SENTRY_DSN,

      // 🎯 무료 티어: 샘플링 30% (월 10,000 트랜잭션 제한, ~70% 사용)
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.3 : 0,

      // Production에서만 활성화
      enabled: process.env.NODE_ENV === 'production',

      debug: false,
    });

    // 환경변수 검증
    try {
      await import('./src/env');
      console.log('✅ 환경변수 검증 완료');
    } catch (error) {
      console.error('🚨 환경변수 검증 실패:', error);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // 선택적 환경변수 검증
    try {
      const { validateEnvironmentVariables } = await import(
        './src/lib/config/env-validation'
      );
      validateEnvironmentVariables();
    } catch (error) {
      console.error('⚠️ 선택적 환경변수 검증 실패:', error);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // OpenTelemetry (disabled by default, ENABLE_OPENTELEMETRY=true to activate)
    try {
      const { initMonitoring } = await import('./src/lib/otel/otel-sdk');
      await initMonitoring();
    } catch (error) {
      console.warn('⚠️ OTel module load failed (non-fatal):', error);
    }
  }

  // Edge 런타임
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: SENTRY_DSN,

      // 🎯 무료 티어: 샘플링 30%
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.3 : 0,

      // Production에서만 활성화
      enabled: process.env.NODE_ENV === 'production',

      debug: false,
    });
  }
}

/**
 * Next.js 16 권장: Request Error 캡처
 * Server Components, Route Handlers 등에서 발생하는 에러 캡처
 */
export function onRequestError(
  error: Error & { digest?: string },
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) {
  Sentry.captureException(error, {
    extra: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      method: request.method,
      path: request.path,
    },
    tags: {
      routeType: context.routeType,
      routerKind: context.routerKind,
    },
  });
}
