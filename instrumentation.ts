/**
 * Next.js Instrumentation (Next.js 16 권장 방식)
 *
 * 앱 시작 시 실행되는 초기화 코드
 * - Sentry Server/Edge SDK 통합 초기화 (local analysis opt-in only)
 * - 환경변수 검증
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

export async function register() {
  const { getLocalSentryDsn, isLocalSentryServerEnabled } = await import(
    './src/lib/observability/local-sentry-server'
  );
  const sentryEnabled = isLocalSentryServerEnabled();

  // dev 모드에서는 Sentry가 명시적으로 켜진 경우만 startup instrumentation을 실행한다.
  if (process.env.NODE_ENV !== 'production' && !sentryEnabled) {
    return;
  }

  // ── Production only ──────────────────────────────────────────────────────

  const SENTRY_DSN = getLocalSentryDsn();

  // Node.js 런타임 (Server)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (sentryEnabled) {
      const { default: Sentry } = await import('@sentry/nextjs');
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.01,
        enabled: true,
        debug: false,
      });
    }

    // 환경변수 검증
    try {
      await import('./src/env');
      console.log('✅ 환경변수 검증 완료');
    } catch (error) {
      console.error('🚨 환경변수 검증 실패:', error);
      process.exit(1);
    }

    // 선택적 환경변수 검증
    try {
      const { validateEnvironmentVariables } = await import(
        './src/lib/config/env-validation'
      );
      validateEnvironmentVariables();
    } catch (error) {
      console.error('⚠️ 선택적 환경변수 검증 실패:', error);
      process.exit(1);
    }

    // OpenTelemetry (ENABLE_OPENTELEMETRY=true 시 활성화)
    try {
      const { initMonitoring } = await import('./src/lib/otel/otel-sdk');
      await initMonitoring();
    } catch (error) {
      console.warn('⚠️ OTel module load failed (non-fatal):', error);
    }
  }

  // Edge 런타임
  if (process.env.NEXT_RUNTIME === 'edge' && sentryEnabled) {
    const { default: Sentry } = await import('@sentry/nextjs');
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.01,
      enabled: true,
      debug: false,
    });
  }
}

/**
 * Next.js 16 권장: Request Error 캡처
 * Server Components, Route Handlers 등에서 발생하는 에러 캡처
 */
export async function onRequestError(
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
  const { isLocalSentryServerEnabled } = await import(
    './src/lib/observability/local-sentry-server'
  );
  if (!isLocalSentryServerEnabled()) return;
  const { default: Sentry } = await import('@sentry/nextjs');
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
