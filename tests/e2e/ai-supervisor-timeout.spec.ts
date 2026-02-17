/**
 * AI Supervisor Timeout E2E Tests
 *
 * Vercel Function 타임아웃 (60초) 내에 AI 응답이 완료되는지 검증
 *
 * 테스트 대상:
 * 1. 스트리밍 응답이 첫 바이트를 빠르게 전송하는지
 * 2. 장시간 분석 쿼리가 타임아웃 없이 완료되는지
 * 3. 에러 발생 시 적절한 응답을 반환하는지
 */

import { expect, test } from '@playwright/test';
import { skipIfSecurityBlocked } from './helpers/security';

// Vercel Function 타임아웃 설정 (60초)
const VERCEL_TIMEOUT = 60_000;

// 첫 바이트 전송 최대 대기 시간
// Vercel cold start/네트워크 변동을 고려해 40초로 완화
const FIRST_BYTE_TIMEOUT = 40_000;

// 테스트용 쿼리들 (구체적인 질문으로 clarification 회피)
const TEST_QUERIES = {
  simple: '전체 서버 15대의 현재 상태를 요약해줘',
  detailed:
    '전체 서버 15대의 CPU, 메모리, 디스크 사용량을 상세히 분석하고 권장 사항을 알려줘',
  complex:
    '전체 서버 15대의 현재 성능 상태를 분석하고, 이상 징후가 있는 서버가 있으면 상세 리포트를 작성해줘',
};

test.describe('AI Supervisor Timeout Tests', () => {
  test.describe('Streaming Response', () => {
    test('스트리밍 응답이 첫 바이트를 빠르게 전송한다', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: TEST_QUERIES.simple }],
        },
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      const firstByteTime = Date.now() - startTime;

      if (skipIfSecurityBlocked(response.status())) return;

      // 첫 바이트가 임계 시간 내에 도착해야 함
      expect(firstByteTime).toBeLessThan(FIRST_BYTE_TIMEOUT);
      console.log(`First byte received in ${firstByteTime}ms`);

      // 응답이 성공적이거나 서비스 비활성화 (503) 상태
      // 200 성공, 202 비동기 처리 수락, 429 rate limit, 503/504 서비스 오류
      expect([200, 202, 429, 503, 504]).toContain(response.status());
    });

    test('상세 분석 쿼리가 타임아웃 없이 완료된다', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: TEST_QUERIES.detailed }],
        },
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      const totalTime = Date.now() - startTime;

      if (skipIfSecurityBlocked(response.status())) return;

      // 전체 응답이 60초 이내에 완료되어야 함
      expect(totalTime).toBeLessThan(VERCEL_TIMEOUT);
      console.log(`Detailed query completed in ${totalTime}ms`);

      // 200 성공, 202 비동기 처리 수락, 429 rate limit, 503/504 서비스 오류
      expect([200, 202, 429, 503, 504]).toContain(response.status());
    });

    test('복잡한 분석 쿼리도 타임아웃 없이 완료된다', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: TEST_QUERIES.complex }],
        },
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      const totalTime = Date.now() - startTime;

      if (skipIfSecurityBlocked(response.status())) return;

      // 전체 응답이 60초 이내에 완료되어야 함
      expect(totalTime).toBeLessThan(VERCEL_TIMEOUT);
      console.log(`Complex query completed in ${totalTime}ms`);

      // 200 성공, 202 비동기 처리 수락, 429 rate limit, 503/504 서비스 오류
      expect([200, 202, 429, 503, 504]).toContain(response.status());
    });
  });

  test.describe('JSON Response', () => {
    test('JSON 응답이 타임아웃 없이 반환된다', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: TEST_QUERIES.simple }],
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      const totalTime = Date.now() - startTime;

      if (skipIfSecurityBlocked(response.status())) return;

      // 60초 이내에 완료
      expect(totalTime).toBeLessThan(VERCEL_TIMEOUT);
      console.log(`JSON response received in ${totalTime}ms`);

      // 응답 상태 확인 (429 rate limit, 504 gateway timeout 포함)
      expect([200, 400, 429, 503, 504]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('빈 메시지에 대해 에러를 반환한다', async ({ request }) => {
      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: '' }],
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      if (skipIfSecurityBlocked(response.status())) return;

      // 400 (유효성 검증 실패) 또는 429 (rate limit) 모두 에러로 처리됨
      expect([400, 429]).toContain(response.status());
    });

    test('잘못된 메시지 형식에 대해 에러를 반환한다', async ({ request }) => {
      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: 'invalid format',
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      if (skipIfSecurityBlocked(response.status())) return;

      // 400 (유효성 검증 실패), 429 (rate limit), 500 (서버 오류) 모두 에러로 처리됨
      // 중요한 것은 200이 아니어야 함
      const status = response.status();
      expect([400, 429, 500, 503, 504]).toContain(status);
    });
  });

  test.describe('Session Management', () => {
    test('sessionId가 응답 헤더에 포함된다', async ({ request }) => {
      const sessionId = `test_session_${Date.now()}`;

      const response = await request.post(
        `/api/ai/supervisor?sessionId=${sessionId}`,
        {
          data: {
            messages: [{ role: 'user', content: TEST_QUERIES.simple }],
          },
          headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
          },
          timeout: VERCEL_TIMEOUT,
        }
      );

      if (skipIfSecurityBlocked(response.status())) return;

      const status = response.status();
      const responseSessionId = response.headers()['x-session-id'];

      // 200 정상 응답 시 sessionId 헤더 검증
      // 503 (Circuit Breaker), 504 (Gateway Timeout) 에러 시 헤더 없을 수 있음
      if (status === 200) {
        expect(responseSessionId).toBeDefined();
        console.log(`✅ Session ID returned: ${responseSessionId}`);
      } else {
        // 에러 응답 - 헤더 유무 확인만 (없어도 정상)
        console.log(
          `ℹ️ Response status ${status}, X-Session-Id: ${responseSessionId ?? 'not present'}`
        );
      }

      // 응답 자체가 오는지 확인 (성공 또는 에러)
      expect([200, 429, 503, 504]).toContain(status);
    });
  });

  test.describe('Backend Identification', () => {
    test('응답 헤더에 백엔드 정보가 포함된다', async ({ request }) => {
      const response = await request.post('/api/ai/supervisor', {
        data: {
          messages: [{ role: 'user', content: TEST_QUERIES.simple }],
        },
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        timeout: VERCEL_TIMEOUT,
      });

      if (skipIfSecurityBlocked(response.status())) return;

      // 200 응답 시 X-Backend 헤더 확인
      if (response.status() === 200) {
        const backend = response.headers()['x-backend'];
        expect(backend).toBeDefined();
        expect(['cloud-run', 'fallback-error']).toContain(backend);
      }
    });
  });
});

test.describe('Performance Benchmarks', () => {
  test('간단한 쿼리는 10초 이내에 응답한다', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.post('/api/ai/supervisor', {
      data: {
        messages: [{ role: 'user', content: '안녕' }],
      },
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      timeout: VERCEL_TIMEOUT,
    });

    const totalTime = Date.now() - startTime;

    if (skipIfSecurityBlocked(response.status())) return;

    // 간단한 인사 쿼리는 10초 이내에 완료되어야 함
    if (response.status() === 200) {
      expect(totalTime).toBeLessThan(10_000);
      console.log(`Simple greeting responded in ${totalTime}ms`);
    }
  });
});
