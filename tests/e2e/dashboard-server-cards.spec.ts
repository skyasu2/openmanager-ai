/**
 * 대시보드 서버 카드 + 모달 E2E 테스트
 *
 * 테스트 범위:
 * - 서버 카드 렌더링
 * - 서버 카드 클릭 → 모달 열기
 * - 모달 내용 확인 (탭, 메트릭)
 * - 모달 닫기 (ESC, 외부 클릭)
 */

import { expect, test } from '@playwright/test';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

// 서버 카드는 role=button + aria-label="<서버명> 서버 상세 보기" 패턴을 사용
const SERVER_CARD_SELECTOR = '[role="button"][aria-label*="서버 상세 보기"]';
const EMPTY_STATE_SELECTOR = 'text=표시할 서버가 없습니다.';

test.describe('대시보드 서버 카드 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);

    // 서버 카드 로드 대기
    const hasServerCard = await page
      .locator(SERVER_CARD_SELECTOR)
      .first()
      .isVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD })
      .catch(() => false);

    if (!hasServerCard) {
      const hasEmptyState = await page
        .locator(EMPTY_STATE_SELECTOR)
        .first()
        .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
        .catch(() => false);
      if (hasEmptyState) {
        test.skip(
          true,
          '대시보드에 서버 카드가 없어 모달 테스트를 건너뜁니다.'
        );
      }
    }

    await expect(page.locator(SERVER_CARD_SELECTOR).first()).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });
  });

  test('서버 카드 렌더링 확인', async ({ page }) => {
    // 서버 카드가 최소 1개 이상 렌더링되는지 확인
    const serverCards = page.locator(SERVER_CARD_SELECTOR);
    await expect(serverCards.first()).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });

    const cardCount = await serverCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('서버 카드 메트릭 표시 확인', async ({ page }) => {
    // 첫 번째 서버 카드가 표시되는지 확인
    const serverCard = page.locator(SERVER_CARD_SELECTOR).first();
    await expect(serverCard).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 대시보드 전체에서 "보이는" CPU/Memory 메트릭 라벨 존재 확인
    const visibleCpuCount = await page.locator('text=/CPU|cpu/i').evaluateAll(
      (elements) =>
        elements.filter((el) => {
          const htmlEl = el as HTMLElement;
          const style = window.getComputedStyle(htmlEl);
          const rect = htmlEl.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        }).length
    );
    const visibleMemoryCount = await page
      .locator('text=/Memory|메모리/i')
      .evaluateAll(
        (elements) =>
          elements.filter((el) => {
            const htmlEl = el as HTMLElement;
            const style = window.getComputedStyle(htmlEl);
            const rect = htmlEl.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0
            );
          }).length
      );

    expect(visibleCpuCount).toBeGreaterThan(0);
    expect(visibleMemoryCount).toBeGreaterThan(0);
  });

  test('서버 카드 클릭 → 모달 열기', async ({ page }) => {
    const firstCard = page.locator(SERVER_CARD_SELECTOR).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    // 모달이 나타나는지 확인 (native <dialog> element or [role="dialog"])
    const modal = page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"]')
      .first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
  });

  test('서버 모달 닫기 (ESC 키)', async ({ page }) => {
    const firstCard = page.locator(SERVER_CARD_SELECTOR).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    // Native <dialog> element or [role="dialog"]
    const modal = page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"]')
      .first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // ESC 키로 닫기
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
  });

  test('서버 모달 탭 전환 확인', async ({ page }) => {
    const firstCard = page.locator(SERVER_CARD_SELECTOR).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    // Native <dialog> element or [role="dialog"]
    const modal = page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"]')
      .first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 탭 버튼이 존재하는지 확인 (종합 상황, 성능 분석 등)
    const tabButtons = modal.locator(
      'button:has-text("종합 상황"), button:has-text("성능 분석")'
    );
    const tabCount = await tabButtons.count();

    expect(tabCount).toBeGreaterThan(0);
  });

  test('성능 분석 탭의 주요 버튼/컨트롤이 동작한다', async ({ page }) => {
    const firstCard = page.locator(SERVER_CARD_SELECTOR).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    const modal = page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"]')
      .first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 상위 탭: 성능 분석
    const metricsTab = modal.getByRole('tab', { name: '성능 분석' });
    await expect(metricsTab).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await metricsTab.click();

    // 하위 뷰 토글: 기본 ↔ 분석
    const advancedViewButton = modal.getByRole('button', { name: '분석' });
    await expect(advancedViewButton).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
    await advancedViewButton.click();

    await expect(modal.getByText(/트렌드 분석/).first()).toBeVisible({
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });

    // 메트릭 버튼 순회
    for (const metric of ['CPU', 'MEMORY', 'DISK', 'NETWORK']) {
      const metricButton = modal.getByRole('button', { name: metric }).first();
      await expect(metricButton).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await metricButton.click();
    }

    // 시간 범위 선택 변경
    const rangeSelect = modal.locator('select').first();
    await expect(rangeSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await rangeSelect.selectOption('24h');

    // 토글 옵션 클릭
    const predictionToggle = modal.getByLabel('예측').first();
    const anomaliesToggle = modal.getByLabel('이상탐지').first();
    await predictionToggle.click();
    await anomaliesToggle.click();

    // 새로고침 버튼 동작
    const refreshButton = modal.getByRole('button', { name: '새로고침' });
    await expect(refreshButton).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await refreshButton.click();

    // 에러 배너가 뜨더라도 모달이 유지되어야 함 (치명 크래시 방지)
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  });
});
