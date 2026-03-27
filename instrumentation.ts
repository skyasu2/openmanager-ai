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
import { OBSERVABILITY } from './src/config/constants';

const SENTRY_DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  OBSERVABILITY.SENTRY.DEFAULT_DSN;

export async function register() {
  // Node.js 런타임 (Server)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: SENTRY_DSN,

      // 🎯 무료 티어: 서버 샘플링 1% (클라이언트 5%와 분리, 에러 캡처는 100% 유지)
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0,

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

      // 🎯 무료 티어: Edge 샘플링 1%
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0,

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
