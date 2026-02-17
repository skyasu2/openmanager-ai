/**
 * 🛡️ 에러 바운더리 E2E 테스트 (핵심만)
 *
 * 에러 페이지, 404, 인증 에러 등의 핵심 에러 처리 테스트
 */

import { expect, test } from '@playwright/test';
import {
  skipIfSecurityBlocked,
  skipIfSecurityCheckpoint,
} from './helpers/security';

test.describe('에러 바운더리 테스트', () => {
  test('404 응답 및 페이지 렌더링', async ({ page }) => {
    // API 레벨 404 확인
    const response = await page.request.get('/this-page-does-not-exist-12345');

    if (skipIfSecurityBlocked(response.status())) return;

    expect(response.status()).toBe(404);

    // 페이지 렌더링 확인
    await page.goto('/this-page-does-not-exist-12345');
    await skipIfSecurityCheckpoint(page);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('인증 에러 페이지 로드 및 네비게이션', async ({ page }) => {
    await page.goto('/auth/error');
    await skipIfSecurityCheckpoint(page);
    await expect(page).toHaveTitle(/OpenManager/);

    // 로그인 페이지로 이동 가능한지 확인
    const loginLink = page
      .locator('a[href*="login"], button:has-text("로그인")')
      .first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('API 에러 응답 검증', async ({ page }) => {
    // 잘못된 API 경로 404
    const notFoundResponse = await page.request.get(
      '/api/this-api-does-not-exist'
    );
    if (!skipIfSecurityBlocked(notFoundResponse.status())) {
      expect(notFoundResponse.status()).toBe(404);
    }

    // 인증되지 않은 요청 (존재하지 않는 보호된 경로)
    const authResponse = await page.request.get('/api/protected/resource');
    expect([401, 403, 404]).toContain(authResponse.status());
  });

  test('콘솔 에러 모니터링', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/this-page-does-not-exist-12345');
    await page.waitForLoadState('domcontentloaded');

    // 치명적인 에러 필터링
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('source-map') &&
        !error.includes('DevTools') &&
        !error.includes('403') &&
        !error.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('에러 후 정상 페이지로 복구 가능', async ({ page }) => {
    // 에러 페이지 방문
    await page.goto('/this-page-does-not-exist-12345');
    await skipIfSecurityCheckpoint(page);
    await page.waitForLoadState('domcontentloaded');

    // 정상 페이지로 이동
    await page.goto('/login');
    await skipIfSecurityCheckpoint(page);

    await expect(page).toHaveTitle(/OpenManager/);
    await expect(page.locator('h1')).toBeVisible();
  });
});
