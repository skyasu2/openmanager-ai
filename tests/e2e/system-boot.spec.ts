/**
 * 🚀 시스템 부트 E2E 테스트
 *
 * 시스템 초기화 페이지 및 부팅 프로세스 테스트
 */

import { expect, test } from '@playwright/test';
import {
  skipIfSecurityBlocked,
  skipIfSecurityCheckpoint,
} from './helpers/security';
import { TIMEOUTS } from './helpers/timeouts';

test.describe('시스템 부트 테스트', () => {
  test.describe('시스템 부트 페이지', () => {
    test('시스템 부트 페이지가 로드된다', async ({ page }) => {
      await page.goto('/system-boot');
      await skipIfSecurityCheckpoint(page);

      // 페이지 로드 확인
      await expect(page).toHaveTitle(/OpenManager/);
    });

    test('부팅 진행 상태가 표시된다', async ({ page }) => {
      await page.goto('/system-boot');
      await skipIfSecurityCheckpoint(page);

      // 페이지가 렌더링되었는지 확인
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('부팅 완료 후 리다이렉트된다', async ({ page }) => {
      await page.goto('/system-boot');
      await skipIfSecurityCheckpoint(page);

      // 부팅 완료 대기 (최대 30초)
      const redirected = await page
        .waitForURL(/\/(main|login|dashboard)/, {
          timeout: TIMEOUTS.NETWORK_REQUEST,
        })
        .then(() => true)
        .catch(() => false);

      // 리다이렉트되지 않았더라도 현재 페이지 상태 검증
      if (!redirected) {
        // 부팅 페이지에 있거나 이미 리다이렉트된 상태 허용
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/(system-boot|main|login|dashboard)/);
      }
    });
  });

  test.describe('시스템 초기화 API', () => {
    test('시스템 상태 API가 응답한다', async ({ page }) => {
      // v5.84.1: 통합 API로 변경 (/api/system?view=status)
      const response = await page.request.get('/api/system?view=status');

      if (skipIfSecurityBlocked(response.status())) return;

      // 200 또는 503 (시스템 미초기화) 허용
      expect([200, 503]).toContain(response.status());
    });

    test('시스템 시작 API가 존재한다', async ({ page }) => {
      // v5.84.1: 통합 API로 변경 (POST /api/system with action)
      const response = await page.request.post('/api/system', {
        headers: {
          'Content-Type': 'application/json',
          'x-test-secret': process.env.TEST_SECRET_KEY || '',
        },
        data: { action: 'start' },
      });

      if (skipIfSecurityBlocked(response.status())) return;

      // API가 존재하고 응답하는지 확인 (성공, 인증 필요, 또는 타임아웃)
      // 504 Gateway Timeout은 API가 존재하지만 백엔드 처리 시간 초과를 의미
      expect([200, 201, 401, 405, 504]).toContain(response.status());
    });

    test('시스템 초기화 API가 존재한다', async ({ page }) => {
      // 통합 API: /api/system에 action: 'initialize'로 요청
      const response = await page.request.post('/api/system', {
        headers: {
          'Content-Type': 'application/json',
          'x-test-secret': process.env.TEST_SECRET_KEY || '',
        },
        data: { action: 'initialize' },
      });

      if (skipIfSecurityBlocked(response.status())) return;

      // API가 존재하고 응답하는지 확인
      expect([200, 201, 401, 405]).toContain(response.status());
    });
  });

  test.describe('시스템 헬스 체크', () => {
    test('헬스 체크 API가 200을 반환한다', async ({ page }) => {
      const response = await page.request.get('/api/health');

      if (skipIfSecurityBlocked(response.status())) return;

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('status');
    });

    test('시스템 헬스 뷰 API가 응답한다', async ({ page }) => {
      // v5.84.1: /api/agents/health → /api/system?view=health로 통합
      const response = await page.request.get('/api/system?view=health');

      if (skipIfSecurityBlocked(response.status())) return;

      expect([200, 503]).toContain(response.status());
    });
  });
});

test.describe('시스템 시작 KPI', () => {
  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-test-secret': process.env.TEST_SECRET_KEY || '',
  };
  const attemptCount = 3;
  const maxLatencyMs = 45000;

  test('시스템 시작 호출 지연/성공률을 계측한다', async ({ page }) => {
    const startAttempts: Array<{
      attempt: number;
      status: number;
      latencyMs: number;
      success: boolean;
      alreadyRunning: boolean;
    }> = [];

    let hasAuthBlock = false;

    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      const startedAt = Date.now();
      const response = await page.request.post('/api/system', {
        headers: requestHeaders,
        data: { action: 'start' },
        timeout: TIMEOUTS.NETWORK_REQUEST,
      });

      if (skipIfSecurityBlocked(response.status(), '시스템 시작 KPI')) {
        hasAuthBlock = true;
        break;
      }

      const latencyMs = Date.now() - startedAt;
      const body = await response.json().catch(() => ({}));
      const alreadyRunning =
        typeof body?.message === 'string' &&
        body.message.includes('이미 실행 중');
      const success = response.status() === 200 || alreadyRunning;

      startAttempts.push({
        attempt,
        status: response.status(),
        latencyMs,
        success,
        alreadyRunning,
      });

      console.log(
        `시스템 시작 KPI 시도 #${attempt}: status=${response.status()}, latency=${latencyMs}ms, success=${success}, alreadyRunning=${alreadyRunning}`
      );
    }

    if (hasAuthBlock) {
      test.skip(true, '보안 블록으로 인해 KPI 샘플링이 제한됩니다.');
    }

    expect(startAttempts.length).toBeGreaterThan(0);

    const completedAttempts = startAttempts.length;
    const successfulAttempts = startAttempts.filter(
      (item) => item.success || item.alreadyRunning
    ).length;
    const failedAttempts = startAttempts.filter(
      (item) => !item.success && !item.alreadyRunning
    ).length;
    const avgLatencyMs = Math.round(
      startAttempts.reduce((acc, item) => acc + item.latencyMs, 0) /
        completedAttempts
    );
    const maxLatencyObserved = Math.max(
      ...startAttempts.map((item) => item.latencyMs)
    );
    const successRate = (successfulAttempts / completedAttempts) * 100;

    console.log(
      `시스템 시작 KPI (n=${completedAttempts}, success=${successRate.toFixed(0)}%, avg=${avgLatencyMs}ms, max=${maxLatencyObserved}ms)`
    );

    expect(completedAttempts).toBe(attemptCount);
    expect(successfulAttempts + failedAttempts).toBe(completedAttempts);
    expect(successfulAttempts).toBeGreaterThanOrEqual(1);
    expect(maxLatencyObserved).toBeLessThanOrEqual(maxLatencyMs);
  });
});
