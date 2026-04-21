/**
 * Next.js Client Instrumentation (Next.js 16 권장 방식)
 *
 * 브라우저에서 페이지 로드 시 실행되는 Sentry 클라이언트 초기화
 * Production only — dev에서는 Sentry SDK 번들 비포함 (빌드 속도 향상)
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// dev에서는 Sentry 초기화 건너뜀 (번들에 @sentry/nextjs 포함 방지)
if (process.env.NODE_ENV === 'production') {
  void import('@sentry/nextjs').then(({ init, makeFetchTransport }) => {
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tunnel: '/api/sentry-tunnel',
      transport: makeFetchTransport,
      transportOptions: { fetchOptions: { keepalive: true } },
      integrations: [],
      tracesSampleRate: 0.05,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enabled: true,
      debug: false,
    });
  });
}
