/**
 * 대시보드 알람 + 로그 탐색기 QA E2E 테스트 (최적화 버전)
 *
 * 최적화: 27개 → 6개 테스트로 통합 (navigateToDashboard 21회 절감 ≈ ~12분 절약)
 * - Active Alerts: 4 → 1
 * - Alert History: 9 → 2
 * - Log Explorer: 14 → 3
 */

import { expect, test } from '@playwright/test';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

const ALERT_HISTORY_BUTTON = 'button[aria-label="알림 이력 보기"]';
const LOG_EXPLORER_BUTTON = 'button[aria-label="로그 검색 보기"]';
const ACTIVE_ALERTS_BUTTON = 'button[aria-label="활성 알림 보기"]';

test.describe('📢 알람 기능 QA', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
    await page
      .locator('text=시스템 상태')
      .or(page.locator('text=전체'))
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.DASHBOARD_LOAD });
  });

  test('Active Alerts: 모달 열기, 헤더, 컨텐츠, 푸터 통계, 닫기', async ({
    page,
  }) => {
    // 버튼 클릭 → 모달 열기
    const button = page.locator(ACTIVE_ALERTS_BUTTON).first();
    await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    await button.click();

    const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 헤더: "Active Alerts"
    await expect(modal.getByText('Active Alerts')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });

    // 본문: severity 배지(CRITICAL/WARNING) 또는 빈 상태
    const hasAlerts = await modal
      .locator('text=/CRITICAL|WARNING/i')
      .first()
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);

    if (!hasAlerts) {
      await expect(modal.getByText('현재 활성 알림이 없습니다')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    }

    // 푸터 StatCell: Total, Critical, Warning
    for (const label of ['Total', 'Critical', 'Warning']) {
      await expect(
        modal.getByText(label, { exact: false }).first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }

    // ESC 닫기
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });

  test('Alert History: 필터 (Severity, State, 시간, 서버)', async ({
    page,
  }) => {
    await page.locator(ALERT_HISTORY_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 헤더
    await expect(modal.getByText('Alert History')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });

    // Severity 필터: All, Warning, Critical
    const allChip = modal.getByRole('button', { name: 'All' }).first();
    const warningChip = modal.getByRole('button', { name: 'Warning' }).first();
    const criticalChip = modal
      .getByRole('button', { name: 'Critical' })
      .first();

    await expect(allChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await expect(warningChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await expect(criticalChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    await warningChip.click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);
    await criticalChip.click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);
    await allChip.click();

    // State 필터: Firing, Resolved
    const firingChip = modal.getByRole('button', { name: 'Firing' }).first();
    const resolvedChip = modal
      .getByRole('button', { name: 'Resolved' })
      .first();

    await expect(firingChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await expect(resolvedChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    await firingChip.click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);
    await resolvedChip.click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    // 시간 범위 필터: 1h, 6h, 24h, 전체
    for (const label of ['1h', '6h', '24h', '전체']) {
      const chip = modal.getByRole('button', { name: label }).first();
      await expect(chip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await chip.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
    }

    // 서버 필터 드롭다운
    const serverSelect = modal.locator('select[aria-label="서버 필터"]');
    await expect(serverSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    const optionCount = await serverSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    if (optionCount > 1) {
      const secondOption = await serverSelect
        .locator('option')
        .nth(1)
        .getAttribute('value');
      if (secondOption) {
        await serverSelect.selectOption(secondOption);
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    }
  });

  test('Alert History: Anchor, 통계, 알림 항목, 닫기', async ({ page }) => {
    await page.locator(ALERT_HISTORY_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // Realtime Anchor 배지
    await expect(modal.getByText('Realtime Anchor')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });

    // Stats Footer: Total, Critical, Warning, Firing, Avg Resolution
    for (const label of [
      'Total',
      'Critical',
      'Warning',
      'Firing',
      'Avg Resolution',
    ]) {
      await expect(
        modal.getByText(label, { exact: false }).first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }

    // 알림 항목 필수 정보 확인
    const alertItems = modal.locator('.border-l-4');
    const alertCount = await alertItems.count();

    if (alertCount > 0) {
      const firstAlert = alertItems.first();

      // severity 배지
      await expect(
        firstAlert.locator('text=/critical|warning/i').first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // state 배지
      await expect(
        firstAlert.locator('text=/firing|resolved/i').first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // Fired 타임스탬프
      await expect(
        firstAlert.getByText('Fired:', { exact: false }).first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    } else {
      await expect(modal.getByText('알림 이력이 없습니다')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    }

    // ESC 닫기
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });
});

test.describe('🔍 로그 탐색기 QA', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
    await page
      .locator('text=시스템 상태')
      .or(page.locator('text=전체'))
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.DASHBOARD_LOAD });
  });

  test('로그 탐색기: 열기, 헤더, 키워드 검색, 레벨 필터', async ({ page }) => {
    const button = page.locator(LOG_EXPLORER_BUTTON).first();
    await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    await button.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 헤더: "로그 탐색기"
    await expect(modal.getByText('로그 탐색기')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });

    // 키워드 검색
    const searchInput = modal.locator('input[aria-label="로그 키워드 검색"]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await searchInput.fill('error');
    await page.waitForTimeout(500); // debounce
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    await searchInput.clear();

    // 레벨 필터: 전체, 정보, 경고, 오류
    for (const label of ['전체', '정보', '경고', '오류']) {
      const chip = modal.getByRole('button', { name: label }).first();
      await expect(chip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await chip.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }
  });

  test('로그 탐색기: 드롭다운 필터, 터미널 UI, Anchor', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 소스 필터 드롭다운
    const sourceSelect = modal.locator('select[aria-label="소스 필터"]');
    await expect(sourceSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    const sourceCount = await sourceSelect.locator('option').count();
    expect(sourceCount).toBeGreaterThanOrEqual(1);

    if (sourceCount > 1) {
      const secondOption = await sourceSelect
        .locator('option')
        .nth(1)
        .getAttribute('value');
      if (secondOption) {
        await sourceSelect.selectOption(secondOption);
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    }

    // 서버 필터 드롭다운
    const serverSelect = modal.locator('select[aria-label="서버 필터"]');
    await expect(serverSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    const serverCount = await serverSelect.locator('option').count();
    expect(serverCount).toBeGreaterThanOrEqual(1);

    if (serverCount > 1) {
      const secondOption = await serverSelect
        .locator('option')
        .nth(1)
        .getAttribute('value');
      if (secondOption) {
        await serverSelect.selectOption(secondOption);
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    }

    // 터미널 스타일 영역 (font-mono)
    const terminalArea = modal.locator('.font-mono').first();
    await expect(terminalArea).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    // Realtime Anchor 배지
    await expect(modal.getByText('Realtime Anchor')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
  });

  test('로그 탐색기: 통계, 로그 항목, 더 보기, 복합 필터, 닫기', async ({
    page,
  }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // Stats Footer: 전체, 정보, 경고, 오류
    for (const label of ['전체', '정보', '경고', '오류']) {
      await expect(
        modal
          .locator('.uppercase')
          .filter({ hasText: new RegExp(`^${label}$`) })
          .first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }

    // 로그 항목 필수 정보 확인
    const logItems = modal.locator('.border-l-2');
    const hasLogs = await logItems
      .first()
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);

    if (hasLogs) {
      const firstLog = logItems.first();

      // 레벨 배지 (INFO/WARN/ERROR)
      await expect(
        firstLog.locator('text=/INFO|WARN|ERROR/').first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // 서버 ID 배지
      const serverBadge = firstLog.locator('.text-blue-400').first();
      await expect(serverBadge).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    } else {
      await expect(modal.getByText('로그가 없습니다')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    }

    // "더 보기" 버튼
    const loadMoreButton = modal.getByRole('button', { name: /더 보기/ });
    const hasLoadMore = await loadMoreButton
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);

    if (hasLoadMore) {
      await loadMoreButton.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }

    // 복합 필터 조합: 오류 레벨 + 키워드
    await modal.getByRole('button', { name: '오류' }).first().click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    const searchInput = modal.locator('input[aria-label="로그 키워드 검색"]');
    await searchInput.fill('timeout');
    await page.waitForTimeout(500);
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    // 필터 초기화
    await modal.getByRole('button', { name: '전체' }).first().click();
    await searchInput.clear();
    await page.waitForTimeout(500);

    // ESC 닫기
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });
});
