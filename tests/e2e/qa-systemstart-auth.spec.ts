import { expect, test } from '@playwright/test';
import { LOGIN_BUTTON_SELECTORS, resetGuestState } from './helpers/guest';
import { skipIfSecurityCheckpoint } from './helpers/security';
import { SYSTEM_START_SELECTORS } from './helpers/server-cards';
import { TIMEOUTS } from './helpers/timeouts';

test.describe('QA: 시스템 시작/로그인 정책 검증', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('비로그인 상태에서 시스템 시작 클릭 시 로그인 모달이 노출된다', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await skipIfSecurityCheckpoint(page, '비로그인 시스템 시작 모달');

    let started = false;
    for (const selector of SYSTEM_START_SELECTORS) {
      const button = page.locator(selector).first();
      const visible = await button
        .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
        .catch(() => false);
      if (!visible) continue;

      await button.click();
      started = true;
      break;
    }

    expect(
      started,
      `시스템 시작 버튼을 찾지 못했습니다. 현재 메인 랜딩 텍스트: ${await page
        .textContent('main')
        .catch(() => '')}`
    ).toBeTruthy();

    const loginModal = page
      .locator('[data-testid="system-start-auth-modal"]')
      .or(page.locator('text=로그인 필요'))
      .or(page.locator('text=로그인 페이지로 이동'))
      .first();
    await expect(loginModal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    const modalDialog = page.getByRole('dialog', { name: '로그인 필요' });
    await expect(modalDialog).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    const loginRedirectButton = page
      .locator('button:has-text("로그인 페이지로 이동")')
      .first();
    await expect(loginRedirectButton).toBeEnabled();

    await expect(modalDialog).toContainText('GitHub');
    await expect(modalDialog).toContainText('Google');
    await expect(modalDialog).toContainText('이메일');
    await expect(modalDialog).toContainText(
      '현재 로그인 상태가 아니어도 시스템 시작 버튼은 보이지만, 시작하려면 로그인해야 합니다.'
    );
    await expect(modalDialog).not.toContainText('GitHub만');
    await expect(modalDialog).not.toContainText(
      '시스템 시작은 로그인 후 이용할 수 있습니다.'
    );
    await expect(modalDialog).not.toContainText('GitHub만으로');
  });

  test('로그인 페이지에서 게스트 PIN으로 인증 후 시스템 시작 버튼 접근', async ({
    page,
  }) => {
    const pin = process.env.PLAYWRIGHT_GUEST_PIN?.trim() || '4231';
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await skipIfSecurityCheckpoint(page, '게스트 PIN 로그인');

    let guestButton = null;
    for (const selector of LOGIN_BUTTON_SELECTORS.guest) {
      const button = page.locator(selector).first();
      const visible = await button
        .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
        .catch(() => false);
      if (visible) {
        guestButton = button;
        break;
      }
    }

    expect(guestButton).not.toBeNull();
    await guestButton!.click();

    const pinInput = page.locator('input#guest-pin-input').first();
    await expect(pinInput).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    await pinInput.fill(pin);
    await pinInput.press('Enter');

    const loginButton = page.getByRole('button', { name: '로그인' }).first();
    await loginButton
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.MODAL_DISPLAY })
      .catch(() => undefined);

    await page
      .waitForFunction(
        () => !window.location.pathname.startsWith('/login'),
        null,
        { timeout: TIMEOUTS.NETWORK_REQUEST }
      )
      .catch(() => undefined);
    await page.waitForLoadState('domcontentloaded');

    const hasGuestAuth =
      !new URL(page.url()).pathname.startsWith('/login') ||
      page.url().includes('/dashboard') ||
      page.url().includes('/main') ||
      /auth_session_id|guest_session_id/.test(
        await page.evaluate(() => document.cookie)
      );

    expect(hasGuestAuth).toBeTruthy();

    const homePath = new URL(page.url()).pathname;
    if (homePath === '/login') {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    const systemStart = page.locator('button:has-text("시스템 시작")').first();
    await expect(systemStart).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
  });
});
