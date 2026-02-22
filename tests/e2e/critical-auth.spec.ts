import { expect, test } from '@playwright/test';
import { guestLogin, resetGuestState } from './helpers/guest';
import {
  skipIfSecurityBlocked,
  skipIfSecurityCheckpoint,
} from './helpers/security';
import { TIMEOUTS } from './helpers/timeouts';

test.describe('핵심 인증/헬스체크 크리티컬 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('로그인 페이지 핵심 CTA가 렌더링된다', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await skipIfSecurityCheckpoint(page);

    await expect(
      page.getByRole('heading', { name: /OpenManager.*로그인/i })
    ).toBeVisible({ timeout: TIMEOUTS.NETWORK_REQUEST });
    await expect(
      page.getByRole('button', { name: /게스트.*(체험하기|모드)/i })
    ).toBeVisible();
  });

  test('게스트 로그인 후 세션이 생성된다', async ({ page }) => {
    await guestLogin(page);
    await expect(page).toHaveURL('/');

    const hasGuestSession = await page.evaluate(() => {
      return (
        document.cookie.includes('auth_session_id=') ||
        document.cookie.includes('guest_session_id=') ||
        localStorage.getItem('auth_session_id') !== null
      );
    });

    expect(hasGuestSession).toBe(true);
  });

  test('헬스/버전 API가 정상 응답한다', async ({ page }) => {
    const healthResponse = await page.request.get('/api/health');
    if (skipIfSecurityBlocked(healthResponse.status())) return;
    expect(healthResponse.ok()).toBeTruthy();

    const versionResponse = await page.request.get('/api/version');
    if (skipIfSecurityBlocked(versionResponse.status())) return;
    expect(versionResponse.ok()).toBeTruthy();
  });
});
