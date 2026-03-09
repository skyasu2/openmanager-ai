/**
 * UI 플로우 헬퍼 함수
 *
 * @description UI 클릭 기반 테스트 플로우를 위한 헬퍼 함수 모음
 * @file tests/e2e/helpers/ui-flow.ts
 */

import { expect, type Page } from '@playwright/test';
import { isLocalEnvironment } from './config';
import { guestLogin } from './guest';
import { skipIfSecurityCheckpoint } from './security';
import { TIMEOUTS } from './timeouts';

const DASHBOARD_ROUTE_REGEX = /\/(dashboard|main)(\/|\?|$)/;

function profileTriggerLocator(page: Page) {
  return page.locator(
    '[data-testid="profile-dropdown-trigger"], [aria-label="프로필 메뉴"]'
  );
}

/**
 * 프로필 드롭다운 열기
 *
 * @description data-testid 기반 안정적 셀렉터로 프로필 버튼 클릭
 * @param page Playwright Page 객체
 * @throws 프로필 버튼을 찾을 수 없거나 클릭할 수 없는 경우
 *
 * @example
 * await openProfileDropdown(page);
 */
export async function openProfileDropdown(page: Page): Promise<void> {
  // 대시보드/메인 화면이 완전히 로드될 때까지 대기 (WSL ↔️ Vercel 지연 대비)
  await page.waitForURL(DASHBOARD_ROUTE_REGEX, {
    timeout: TIMEOUTS.DASHBOARD_LOAD,
  });
  await page.waitForLoadState('networkidle', {
    timeout: TIMEOUTS.DASHBOARD_LOAD,
  });

  const trigger = profileTriggerLocator(page);

  await trigger.waitFor({
    state: 'visible',
    timeout: TIMEOUTS.DASHBOARD_LOAD,
  });
  await expect(trigger).toBeVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD });
  await trigger.click({ timeout: TIMEOUTS.FORM_SUBMIT });
  const dropdown = page
    .locator('[role="menu"], [data-testid="profile-dropdown-menu"]')
    .first();
  await expect(dropdown)
    .toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE })
    .catch(() => undefined);
}

/**
 * 대시보드로 안전하게 이동
 *
 * @description 게스트 로그인 → 시스템 시작 → 대시보드 이동 전체 플로우
 * @param page Playwright Page 객체
 * @param options 옵션
 * @param options.maxRetries 최대 재시도 횟수 (기본값: 3)
 * @param options.skipGuestLogin 게스트 로그인 건너뛰기 (기본값: false)
 *
 * @example
 * await navigateToDashboard(page);
 * await navigateToDashboard(page, { skipGuestLogin: true });
 */
export async function navigateToDashboard(
  page: Page,
  options: { maxRetries?: number; skipGuestLogin?: boolean } = {}
): Promise<void> {
  const { maxRetries = 3, skipGuestLogin = false } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!skipGuestLogin) {
        await guestLogin(page);
      } else {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await skipIfSecurityCheckpoint(page);
      }

      await page.waitForLoadState('networkidle', { timeout: 15000 });

      if (isLocalEnvironment()) {
        // 로컬: 시스템 시작 버튼 → system-boot → dashboard 흐름
        const startButton = page
          .locator(
            'button:has-text("🚀 시스템 시작"), button:has-text("시스템 시작")'
          )
          .first();
        const hasStartButton = await startButton
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasStartButton) {
          await startButton.click();
          await page.waitForURL('**/dashboard', {
            timeout: TIMEOUTS.DASHBOARD_LOAD,
          });
        } else {
          await page.goto('/dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await skipIfSecurityCheckpoint(page);
        }
      } else {
        // Vercel: 직접 대시보드 이동 (system-start 리다이렉트 불안정)
        await page.goto('/dashboard', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await skipIfSecurityCheckpoint(page);
      }

      await page.waitForLoadState('networkidle', { timeout: 15000 });
      return; // 성공
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await page
        .waitForLoadState('domcontentloaded', { timeout: 1000 })
        .catch(() => undefined);
    }
  }
}

/**
 * Clarification 다이얼로그 처리
 *
 * @description 모호한 질문에 대해 시스템이 명확화를 요청할 때 옵션 선택 또는 취소
 * @param page Playwright Page 객체
 * @returns 옵션을 선택했으면 true, 그렇지 않으면 false
 *
 * @example
 * const wasHandled = await handleClarificationIfPresent(page);
 */
export async function handleClarificationIfPresent(
  page: Page
): Promise<boolean> {
  // Production에서는 data-testid가 strip됨 → aria-label 기반 감지
  const dismissBtn = page.locator('button[aria-label="명확화 취소"]').first();
  const hasClarification = await dismissBtn
    .isVisible({ timeout: TIMEOUTS.API_RESPONSE * 2 })
    .catch(() => false);

  if (!hasClarification) return false;

  // 옵션 버튼을 클릭해야 쿼리가 진행됨
  const clarificationContainer = dismissBtn.locator('..').locator('..');
  const optionButtons = clarificationContainer.locator(
    'button:not([aria-label="명확화 취소"]):not(:has-text("직접 입력하기"))'
  );
  const optionCount = await optionButtons.count();

  if (optionCount > 0) {
    await optionButtons.first().click();
    await expect(dismissBtn)
      .toBeHidden({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => undefined);
    return true;
  }

  // 옵션 없으면 dismiss (쿼리 취소됨)
  await dismissBtn.click();
  await expect(dismissBtn)
    .toBeHidden({ timeout: TIMEOUTS.DOM_UPDATE })
    .catch(() => undefined);
  return false;
}
