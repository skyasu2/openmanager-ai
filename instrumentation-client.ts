/**
 * Next.js Client Instrumentation (Next.js 16 권장 방식)
 *
 * 브라우저에서 페이지 로드 시 실행되는 Sentry 클라이언트 초기화
 * 로컬 분석 opt-in 전용. OpenManager production 앱 기능으로 사용하지 않는다.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

if (
  process.env.NEXT_PUBLIC_SENTRY_LOCAL_ANALYSIS === 'true' &&
  process.env.NEXT_PUBLIC_SENTRY_DSN
) {
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
