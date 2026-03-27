/**
 * MSW Browser Setup
 *
 * Browser 환경에서 MSW를 초기화합니다.
 * 개발 서버에서 API 목 처리를 위해 사용됩니다.
 *
 * @see https://mswjs.io/docs/integrations/browser
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// 개발 환경에서만 MSW를 활성화
if (process.env.NODE_ENV === 'development') {
  void worker.start({
    onUnhandledRequest: 'warn', // 처리되지 않은 요청에 대해 경고
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
}
