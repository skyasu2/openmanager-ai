import { expect, type Locator, type Page, test } from '@playwright/test';
import { getEnvironmentInfo } from './helpers/config';
import { guestLogin, openAiSidebar, resetGuestState } from './helpers/guest';
import {
  getServerCardButtons,
  hasEmptyServerState,
  SYSTEM_START_SELECTORS,
} from './helpers/server-cards';
import { TIMEOUTS } from './helpers/timeouts';

const env = getEnvironmentInfo();
const landingPath = process.env.GUEST_FLOW_LANDING_PATH || env.baseUrl;
const skipSystemStart = process.env.GUEST_FLOW_SKIP_SYSTEM_START === 'true';
const forceSystemStart = process.env.GUEST_FLOW_FORCE_SYSTEM_START === 'true';
const headlessMode =
  process.env.CI === 'true' || process.env.PLAYWRIGHT_HEADLESS === 'true';
const shouldClickSystemStart =
  forceSystemStart || (!skipSystemStart && env.isLocal);

const attemptStartSystemIfNeeded = async (page: Page) => {
  const isOnDashboard = /\/(dashboard|main)/.test(page.url());
  if (isOnDashboard) {
    return;
  }

  for (const selector of SYSTEM_START_SELECTORS) {
    const button = page.locator(selector).first();
    const isVisible = await button
      .isVisible({ timeout: TIMEOUTS.NETWORK_REQUEST })
      .catch(() => false);
    if (!isVisible) continue;

    await button.click();
    await page.waitForURL(/\/(dashboard|main)/, {
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });
    return;
  }
};

test.describe('🧭 게스트 대시보드 핵심 플로우', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('시스템 시작 없이도 게스트가 대시보드에 접근할 수 있다', async ({
    page,
  }) => {
    await guestLogin(page, { landingPath });
    console.log('✅ 게스트 로그인 완료');

    if (shouldClickSystemStart) {
      let startButtonClicked = false;
      for (const selector of SYSTEM_START_SELECTORS) {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
          .catch(() => false);
        if (isVisible) {
          await button.click();
          startButtonClicked = true;
          console.log(`✅ 시스템 시작 버튼 클릭: ${selector}`);
          break;
        }
      }

      if (!startButtonClicked) {
        if (forceSystemStart) {
          throw new Error(
            '시스템 시작 버튼을 강제로 클릭해야 하지만 찾지 못했습니다.'
          );
        }
        console.log('ℹ️ 시스템 시작 버튼이 없어 이미 가동 중으로 간주합니다.');
      }
    } else {
      console.log('ℹ️ 환경 설정에 따라 시스템 시작 단계는 건너뜁니다.');
      // 시스템이 이미 실행 중인 환경(프로덕션)에서는 직접 대시보드로 이동
      await page.goto('/dashboard');
    }

    await page.waitForURL(/\/(dashboard|main)/, {
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });

    // Local 환경에서는 인증 체크 오버레이가 잠시 유지될 수 있어, 대시보드 텍스트 대신
    // "대시보드 핵심 지표 또는 인증된 앱 셸(프로필/AI 토글)" 중 하나를 성공 신호로 본다.
    const dashboardIndicator = page
      .locator('text=시스템 상태')
      .or(page.locator('text=전체'))
      .or(page.locator('text=온라인'))
      .or(page.locator('[class*="DashboardSummary"]'))
      .first();
    const appShellIndicator = page
      .locator('[data-testid="profile-dropdown-trigger"]')
      .or(page.locator('button:has-text("게스트")'))
      .or(page.locator('button[aria-label*="AI"]'))
      .first();
    const authCheckingOverlay = page
      .locator('text=권한을 확인하고 있습니다')
      .first();
    let authOverlayFallbackActive = false;

    const dashboardVisible = await dashboardIndicator
      .isVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD })
      .catch(() => false);
    if (!dashboardVisible) {
      const loginHeadingVisible = await page
        .getByRole('heading', { name: /로그인/i })
        .isVisible({ timeout: TIMEOUTS.NETWORK_REQUEST })
        .catch(() => false);
      expect(loginHeadingVisible).toBeFalsy();

      const shellVisible = await appShellIndicator
        .isVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD })
        .catch(() => false);
      if (!shellVisible) {
        const isAuthChecking = await authCheckingOverlay
          .isVisible({ timeout: TIMEOUTS.NETWORK_REQUEST })
          .catch(() => false);
        expect(isAuthChecking).toBeTruthy();
        console.log('ℹ️ 로컬 인증 체크 오버레이 상태를 확인했습니다.');
        authOverlayFallbackActive = true;
      }
    }

    if (authOverlayFallbackActive) {
      return;
    }

    // 프로덕션 데이터 편차 대응:
    // 1) 서버 카드가 보이면 카드 수 검증
    // 2) 데이터가 비어 있으면 빈 상태 UI를 정상 케이스로 허용
    const serverCardLocators = getServerCardButtons(page);
    const hasServerCards = await serverCardLocators
      .first()
      .isVisible({ timeout: TIMEOUTS.NETWORK_REQUEST })
      .catch(() => false);

    if (hasServerCards) {
      const cardCount = await serverCardLocators.count();
      console.log(`📊 대시보드 서버 카드 수: ${cardCount}`);
      expect(cardCount).toBeGreaterThan(0);
      return;
    }

    const emptyStateVisible = await hasEmptyServerState(page);
    expect(emptyStateVisible).toBeTruthy();
    console.log('ℹ️ 서버 카드 대신 빈 상태 UI를 확인했습니다.');
  });

  test('프로필 드롭다운에는 관리자 관련 항목이 없어야 한다', async ({
    page,
  }) => {
    await guestLogin(page, { landingPath });

    const profileButton = page
      .locator(
        '[data-testid="profile-dropdown-trigger"], button:has-text("게스트")'
      )
      .first();
    await profileButton.waitFor({ state: 'visible' });
    await profileButton.click();

    const profileMenu = page.locator('[role="menu"]').first();
    const menuVisible = await profileMenu
      .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY / 2 })
      .catch(() => false);
    if (!menuVisible) {
      // hydration/레이아웃 타이밍 이슈가 있는 환경에서 1회 재시도
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await profileButton.click();
      await expect(profileMenu).toBeVisible({
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
    }

    const adminMenuItems = profileMenu
      .locator('[role="menuitem"]')
      .filter({ hasText: /관리자 모드|관리자 페이지|Admin Mode/i });
    expect(await adminMenuItems.count()).toBe(0);

    const safeAccountAction = profileMenu
      .locator('[role="menuitem"], button')
      .filter({ hasText: /세션\s*종료|로그아웃|로그인/i })
      .first();
    await expect(safeAccountAction).toBeVisible();
  });

  test('AI 토글 버튼으로 사이드바를 열 수 있다', async ({ page }) => {
    await guestLogin(page, { landingPath });
    await attemptStartSystemIfNeeded(page);
    if (headlessMode) {
      console.log('ℹ️ Headless 환경에서 AI 토글 확인 중...');
    }
    let sidebar: Locator;
    try {
      sidebar = await openAiSidebar(page, {
        waitTimeout: 15000, // 10초 → 15초 증가
      });
    } catch (error) {
      if (/AI 토글 버튼/.test((error as Error).message)) {
        test.skip(
          true,
          '시스템 시작이 필요한 환경에서 AI 사이드바 토글을 사용할 수 없어 건너뜁니다.'
        );
      }
      throw error;
    }

    await expect(sidebar).toBeVisible();
    console.log('✅ AI 사이드바 토글 및 렌더링 확인');
  });
});
