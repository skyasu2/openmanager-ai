/**
 * MSW Test Environment Setup
 *
 * Vitest 테스트 환경에서 MSW를 자동으로 설정합니다.
 *
 * @usage vitest.config.ts의 setupFiles에 이 파일 추가
 * @see https://mswjs.io/docs/integrations/node
 */

import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../../src/__mocks__/msw/server';

const isVerboseMsw = process.env.VITEST_VERBOSE_MSW === 'true';

/**
 * 테스트 시작 전: MSW 서버 시작
 */
beforeAll(() => {
  if (isVerboseMsw) {
    console.log('[MSW] Starting mock server for tests...');
  }
  server.listen({
    onUnhandledRequest: 'warn', // 처리되지 않은 요청에 대해 경고
  });
});

/**
 * 각 테스트 후: 핸들러 초기화
 *
 * 테스트 간 상태 격리를 위해 핸들러를 초기화합니다.
 */
afterEach(() => {
  server.resetHandlers();
});

/**
 * 모든 테스트 종료 후: MSW 서버 정리
 */
afterAll(() => {
  if (isVerboseMsw) {
    console.log('[MSW] Cleaning up mock server...');
  }
  server.close();
});
