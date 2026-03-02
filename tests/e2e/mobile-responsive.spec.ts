/**
 * 모바일 반응형 E2E 테스트
 *
 * 목적:
 * - 모바일 viewport에서 가로 스크롤 없이 대시보드가 렌더링되는지 검증
 * - 모바일 환경에서도 서버 카드 상세 모달 상호작용이 가능한지 검증
 */

import { expect, test } from '@playwright/test';
import {
  getServerCardButtons,
  hasEmptyServerState,
} from './helpers/server-cards';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

const isMobileProject = (projectName: string) =>
  projectName.startsWith('mobile-');

test.describe('모바일 반응형 대시보드', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isMobileProject(testInfo.project.name),
      '모바일 프로젝트에서만 실행됩니다.'
    );

    await navigateToDashboard(page);

    const serverCards = getServerCardButtons(page);
    const hasServerCard = await serverCards
      .first()
      .isVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD })
      .catch(() => false);

    if (!hasServerCard) {
      const hasEmptyState = await hasEmptyServerState(page).catch(() => false);
      if (hasEmptyState) {
        test.skip(
          true,
          '대시보드에 서버 카드가 없어 모바일 반응형 테스트를 건너뜁니다.'
        );
      }
    }

    await expect(serverCards.first()).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });
  });

  test('가로 스크롤 없이 서버 카드가 렌더링된다', async ({ page }) => {
    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });

    expect(hasHorizontalOverflow).toBeFalsy();

    const firstCardBounds = await getServerCardButtons(page)
      .first()
      .boundingBox();
    expect(firstCardBounds).not.toBeNull();
    expect(firstCardBounds?.width ?? 0).toBeGreaterThan(180);
  });

  test('모바일에서도 서버 카드 상세 모달을 열 수 있다', async ({ page }) => {
    const firstCard = getServerCardButtons(page).first();
    await firstCard.click();

    const modal = page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"]')
      .first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
  });
});
