/**
 * 대시보드 서버 카드 + 상세 route E2E 테스트
 *
 * 테스트 범위:
 * - 서버 카드 렌더링
 * - 서버 카드 클릭 → 서버 상세 route 이동
 * - 상세 route 내용 확인 (탭, 메트릭)
 */

import { expect, test } from '@playwright/test';
import {
  getServerCardButtons,
  hasEmptyServerState,
} from './helpers/server-cards';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

const isCI = process.env.CI === 'true';

test.describe('대시보드 서버 카드 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);

    // 서버 카드 로드 대기
    const serverCards = getServerCardButtons(page);
    const hasServerCard = await serverCards
      .first()
      .isVisible({ timeout: TIMEOUTS.DASHBOARD_LOAD })
      .catch(() => false);

    if (!hasServerCard) {
      const hasEmptyState = await hasEmptyServerState(page).catch(() => false);
      if (hasEmptyState) {
        if (isCI) {
          throw new Error(
            'CI에서는 대시보드 서버 카드 데이터가 비어 있으면 안 됩니다.'
          );
        }
        test.skip(
          true,
          '대시보드에 서버 카드가 없어 상세 route 테스트를 건너뜁니다.'
        );
      }
    }

    await expect(serverCards.first()).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });
  });

  test('서버 카드 렌더링 확인', async ({ page }) => {
    // 서버 카드가 최소 1개 이상 렌더링되는지 확인
    const serverCards = getServerCardButtons(page);
    await expect(serverCards.first()).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });

    const cardCount = await serverCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('서버 카드 메트릭 표시 확인', async ({ page }) => {
    // 첫 번째 서버 카드가 표시되는지 확인
    const serverCard = getServerCardButtons(page).first();
    await expect(serverCard).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 대시보드 전체에서 보이는 CPU/Memory 메트릭 라벨 존재 확인
    const cpuLabel = page.locator('text=/CPU|cpu/i').first();
    const memoryLabel = page.locator('text=/Memory|메모리/i').first();

    await expect(cpuLabel).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    await expect(memoryLabel).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
  });

  test('서버 카드 클릭 → 서버 상세 route 이동', async ({ page }) => {
    const firstCard = getServerCardButtons(page).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);
    await expect(page.getByRole('heading', { name: '서버 상세' })).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });

  test('서버 상세 route에서 목록으로 돌아갈 수 있다', async ({ page }) => {
    const firstCard = getServerCardButtons(page).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);

    await page.getByRole('link', { name: /서버 목록/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/servers$/);
    await expect(getServerCardButtons(page).first()).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });

  test('서버 상세 route 탭 전환 확인', async ({ page }) => {
    const firstCard = getServerCardButtons(page).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);

    // 탭 버튼이 존재하는지 확인 (종합 상황, 성능 분석 등)
    await expect(page.getByRole('tab', { name: '종합 상황' })).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
    await expect(page.getByRole('tab', { name: '성능 분석' })).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
  });

  test('모바일 서버 상세 route에 수평 오버플로와 컨트롤 겹침이 없다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const firstCard = getServerCardButtons(page).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);
    await expect(page.getByRole('tab', { name: '종합 상황' })).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });

    const layoutCheck = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const pageOverflow =
        document.documentElement.scrollWidth > viewportWidth + 1 ||
        document.body.scrollWidth > viewportWidth + 1;
      const main = document.querySelector('main') ?? document.body;
      const controls = Array.from(
        main.querySelectorAll('button, a, select, input')
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      const overlaps: string[] = [];

      for (let i = 0; i < controls.length; i += 1) {
        for (let j = i + 1; j < controls.length; j += 1) {
          const first = controls[i];
          const second = controls[j];

          if (first.contains(second) || second.contains(first)) {
            continue;
          }

          const a = first.getBoundingClientRect();
          const b = second.getBoundingClientRect();
          const horizontal =
            Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const vertical =
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

          if (horizontal > 2 && vertical > 2) {
            overlaps.push(
              `${first.tagName.toLowerCase()}[${first.textContent?.trim() ?? ''}] <-> ${second.tagName.toLowerCase()}[${second.textContent?.trim() ?? ''}]`
            );
          }
        }
      }

      return { pageOverflow, overlaps: overlaps.slice(0, 5) };
    });

    expect(layoutCheck.pageOverflow, JSON.stringify(layoutCheck)).toBe(false);
    expect(layoutCheck.overlaps, JSON.stringify(layoutCheck)).toEqual([]);
  });

  test('성능 분석 탭의 주요 버튼/컨트롤이 동작한다', async ({ page }) => {
    const firstCard = getServerCardButtons(page).first();
    await expect(firstCard).toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);

    // 상위 탭: 성능 분석
    const metricsTab = page.getByRole('tab', { name: '성능 분석' });
    await expect(metricsTab).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await metricsTab.click();

    // 하위 뷰 토글: 기본 ↔ 분석
    const advancedViewButton = page.getByRole('button', { name: '분석' });
    await expect(advancedViewButton).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
    await advancedViewButton.click();

    await expect(page.getByText(/트렌드 분석/).first()).toBeVisible({
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });

    // 메트릭 버튼 순회
    for (const metric of ['CPU', 'MEMORY', 'DISK', 'NETWORK']) {
      const metricButton = page.getByRole('button', { name: metric }).first();
      await expect(metricButton).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await metricButton.click();
    }

    // 시간 범위 선택 변경
    const rangeSelect = page.locator('select').first();
    await expect(rangeSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await rangeSelect.selectOption('24h');

    // 토글 옵션 클릭
    const predictionToggle = page.getByLabel('예측').first();
    const anomaliesToggle = page.getByLabel('이상탐지').first();
    await predictionToggle.click();
    await anomaliesToggle.click();

    // 새로고침 버튼 동작
    const refreshButton = page.getByRole('button', { name: '새로고침' });
    await expect(refreshButton).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await refreshButton.click();

    // 에러 배너가 뜨더라도 상세 route가 유지되어야 함 (치명 크래시 방지)
    await expect(page).toHaveURL(/\/dashboard\/servers\/[^/]+/);
  });
});
