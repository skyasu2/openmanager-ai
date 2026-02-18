/**
 * Next.js Client Instrumentation (Next.js 16 권장 방식)
 *
 * 브라우저에서 페이지 로드 시 실행되는 Sentry 클라이언트 초기화
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';
import { makeFetchTransport } from '@sentry/nextjs';

// Sentry DSN (Public Key - 전송만 가능, 읽기 불가)
const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://c4cfe13cdda790d1d9a6c3f92c593f39@o4509732473667584.ingest.de.sentry.io/4510731369119824';

Sentry.init({
  dsn: SENTRY_DSN,

  // 🎯 Tunnel 경로 (ad-blocker 우회, 수동 API route)
  tunnel: '/api/sentry-tunnel',

  // 🎯 페이지 전환 시 abort 방지: keepalive fetch
  transport: makeFetchTransport,
  transportOptions: {
    fetchOptions: { keepalive: true },
  },

  // 🎯 무료 티어 최적화: Replay 비활성화 (이벤트 절약)
  integrations: [],

  // 🎯 무료 티어: 샘플링 10% (tunnel 호출량 절감, 월 10,000 트랜잭션 이내)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // 🎯 Replay 비활성화 (무료 티어 제한)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Production에서만 활성화
  enabled: process.env.NODE_ENV === 'production',

  debug: false,
});

/**
 * Next.js 16 권장: 라우터 트랜지션 캡처
 * 페이지 간 네비게이션 추적
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
