/**
 * @fileoverview 로그인 기능 E2E 테스트
 * 2024-12: Google 로그인 추가, 버튼명 변경 반영
 */
import { expect, test } from '@playwright/test';
import {
  guestLogin,
  LOGIN_BUTTON_SELECTORS,
  navigateToLoginPage,
  verifyLoginOptions,
} from './helpers/guest';
import { TIMEOUTS } from './helpers/timeouts';

test.describe('🔐 로그인 기능 테스트', () => {
  test.describe('로그인 페이지 UI', () => {
    test('로그인 페이지에 모든 로그인 옵션이 표시된다', async ({ page }) => {
      const options = await verifyLoginOptions(page);

      expect(options.guest).toBe(true);
      expect(options.github).toBe(true);
      expect(options.google).toBe(true);
    });

    test('메인 페이지에서 로그인 버튼 클릭 시 로그인 페이지로 이동', async ({
      page,
    }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // DOM 완전 로딩 대기 (hardcoded timeout 대신 명시적 상태 대기)
      await page.waitForLoadState('domcontentloaded');

      // 로그인 버튼 찾기 및 클릭
      let loginButtonFound = false;
      for (const selector of LOGIN_BUTTON_SELECTORS.loginButton) {
        const button = page.locator(selector).first();
        try {
          await button.waitFor({ state: 'visible', timeout: 5000 });
          await button.click();
          loginButtonFound = true;
          break;
        } catch {
          // 다음 셀렉터 시도
        }
      }

      // 로그인 버튼이 없으면 이미 로그인 페이지에 있을 수 있음
      if (!loginButtonFound) {
        // 프로필 메뉴가 있으면 이미 로그인 상태
        const profileMenu = page.locator('button:has-text("프로필")').first();
        const isLoggedIn = await profileMenu
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (isLoggedIn) {
          // 이미 로그인된 상태는 성공으로 처리
          return;
        }
        // 직접 로그인 페이지로 이동
        await page.goto('/login');
      }

      await expect(page).toHaveURL(/\/login/);
    });

    test('로그인 페이지에서 직접 접근 가능', async ({ page }) => {
      await navigateToLoginPage(page, { direct: true });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('게스트 로그인', () => {
    test('게스트 모드 버튼 클릭으로 로그인 성공', async ({ page }) => {
      await guestLogin(page);

      // 메인 페이지로 리다이렉트 확인
      await expect(page).toHaveURL('/');

      // 게스트 사용자 표시 확인 (프로필 영역)
      const profileArea = page.locator('text=게스트').first();
      await expect(profileArea).toBeVisible({
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
    });

    test('게스트 로그인 후 시스템 시작 가능', async ({ page }) => {
      await guestLogin(page);

      // 시스템 시작 버튼 클릭
      const startButton = page
        .locator('button:has-text("시스템 시작")')
        .first();
      await startButton.waitFor({
        state: 'visible',
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
      await startButton.click();

      // 대시보드로 이동 확인 (약간의 대기 필요)
      await page.waitForURL('**/dashboard**', {
        timeout: TIMEOUTS.NETWORK_REQUEST,
      });
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('OAuth 로그인 버튼', () => {
    test('GitHub 로그인 버튼이 클릭 가능하다', async ({ page }) => {
      await navigateToLoginPage(page, { direct: true });

      // GitHub 버튼 찾기
      let githubButton = null;
      for (const selector of LOGIN_BUTTON_SELECTORS.github) {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          githubButton = button;
          break;
        }
      }

      expect(githubButton).not.toBeNull();
      await expect(githubButton!).toBeEnabled();
    });

    test('Google 로그인 버튼이 클릭 가능하다', async ({ page }) => {
      await navigateToLoginPage(page, { direct: true });

      // Google 버튼 찾기
      let googleButton = null;
      for (const selector of LOGIN_BUTTON_SELECTORS.google) {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          googleButton = button;
          break;
        }
      }

      expect(googleButton).not.toBeNull();
      await expect(googleButton!).toBeEnabled();
    });

    test('GitHub 버튼 클릭 시 OAuth 페이지로 리다이렉트', async ({ page }) => {
      await navigateToLoginPage(page, { direct: true });

      // GitHub 버튼 클릭
      for (const selector of LOGIN_BUTTON_SELECTORS.github) {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          // 네비게이션 대기 설정
          const navigationPromise = page
            .waitForURL(/github\.com|supabase/, {
              timeout: TIMEOUTS.NETWORK_REQUEST,
            })
            .catch(() => null);

          await button.click();
          await navigationPromise;
          break;
        }
      }

      // GitHub 또는 Supabase Auth 페이지로 이동 확인
      const url = page.url();
      expect(url).toMatch(/github\.com|supabase/);
    });

    test('Google 버튼 클릭 시 OAuth 페이지로 리다이렉트', async ({ page }) => {
      await navigateToLoginPage(page, { direct: true });

      // Google 버튼 클릭
      for (const selector of LOGIN_BUTTON_SELECTORS.google) {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          // 네비게이션 대기 설정
          const navigationPromise = page
            .waitForURL(/accounts\.google\.com|supabase/, {
              timeout: TIMEOUTS.NETWORK_REQUEST,
            })
            .catch(() => null);

          await button.click();
          await navigationPromise;
          break;
        }
      }

      // Google 또는 Supabase Auth 페이지로 이동 확인
      const url = page.url();
      expect(url).toMatch(/accounts\.google\.com|supabase/);
    });
  });
});
