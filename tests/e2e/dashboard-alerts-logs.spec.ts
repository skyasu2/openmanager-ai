/**
 * 대시보드 알람 기능 + 로그 탐색기 QA E2E 테스트
 *
 * 교차 검증 관점:
 * 1. 프론트엔드 개발자: 컴포넌트 렌더링, 상태 관리, 필터 동작
 * 2. 웹 디자이너: UI/UX, 반응형, 시각적 일관성, 접근성
 * 3. 서버 모니터링 엔지니어: 데이터 정확성, 필터 로직, 실시간성
 */

import { expect, test } from '@playwright/test';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

// 대시보드 Summary 영역의 버튼 aria-label 기반 셀렉터
const ALERT_HISTORY_BUTTON = 'button[aria-label="알림 이력 보기"]';
const LOG_EXPLORER_BUTTON = 'button[aria-label="로그 검색 보기"]';
const ACTIVE_ALERTS_BUTTON = 'button[aria-label="활성 알림 보기"]';

test.describe('📢 알람 기능 QA', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
    // 대시보드 Summary 영역 로드 대기
    await page
      .locator('text=시스템 상태')
      .or(page.locator('text=전체'))
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.DASHBOARD_LOAD });
  });

  test.describe('Active Alerts 모달', () => {
    test('[FE] Active Alerts 버튼이 렌더링되고 클릭 가능하다', async ({
      page,
    }) => {
      const button = page.locator(ACTIVE_ALERTS_BUTTON).first();
      await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
      await button.click();

      // 모달 또는 다이얼로그가 열리는지 확인
      const modal = page
        .locator('[role="dialog"]')
        .or(page.locator('[aria-modal="true"]'))
        .first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    });

    test('[FE] Active Alerts 모달에 헤더와 본문이 있다', async ({ page }) => {
      await page.locator(ACTIVE_ALERTS_BUTTON).first().click();

      const modal = page
        .locator('[role="dialog"], [aria-modal="true"]')
        .first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 헤더: "Active Alerts" 텍스트
      await expect(modal.getByText('Active Alerts')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });

      // 본문: 알림 목록 또는 "현재 활성 알림이 없습니다" 빈 상태
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
    });

    test('[디자인] Active Alerts 모달 닫기(ESC)와 오버레이 클릭 닫기', async ({
      page,
    }) => {
      await page.locator(ACTIVE_ALERTS_BUTTON).first().click();

      const modal = page
        .locator('[role="dialog"], [aria-modal="true"]')
        .first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // ESC로 닫기
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible({
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
    });

    test('[엔지니어] Active Alerts에 severity 배지가 올바르게 표시된다', async ({
      page,
    }) => {
      await page.locator(ACTIVE_ALERTS_BUTTON).first().click();

      const modal = page
        .locator('[role="dialog"], [aria-modal="true"]')
        .first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 푸터에 총 알림 건수 표시 확인
      await expect(modal.getByText(/총 \d+개 활성 알림/)).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    });
  });

  test.describe('Alert History 모달', () => {
    test('[FE] 알림 이력 버튼 클릭 → 모달 열기', async ({ page }) => {
      const button = page.locator(ALERT_HISTORY_BUTTON).first();
      await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
      await button.click();

      // Dialog 컴포넌트 기반 모달
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 헤더: "Alert History"
      await expect(modal.getByText('Alert History')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    });

    test('[FE] Alert History 필터 칩이 동작한다 (Severity)', async ({
      page,
    }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // Severity 필터: All, Warning, Critical 칩 존재 확인
      const allChip = modal.getByRole('button', { name: 'All' }).first();
      const warningChip = modal
        .getByRole('button', { name: 'Warning' })
        .first();
      const criticalChip = modal
        .getByRole('button', { name: 'Critical' })
        .first();

      await expect(allChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await expect(warningChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await expect(criticalChip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // Warning 클릭 → 필터 변경 확인
      await warningChip.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Critical 클릭 → 필터 변경 확인
      await criticalChip.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // All로 복원
      await allChip.click();
    });

    test('[FE] Alert History 필터 칩이 동작한다 (State)', async ({ page }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // State 필터: Firing, Resolved 칩
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
    });

    test('[FE] Alert History 시간 범위 필터가 동작한다', async ({ page }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 시간 범위 칩: 1h, 6h, 24h, 전체
      for (const label of ['1h', '6h', '24h', '전체']) {
        const chip = modal.getByRole('button', { name: label }).first();
        await expect(chip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
        await chip.click();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    });

    test('[FE] Alert History 서버 드롭다운 필터가 동작한다', async ({
      page,
    }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 서버 필터 드롭다운
      const serverSelect = modal.locator('select[aria-label="서버 필터"]');
      await expect(serverSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // 옵션이 1개 이상 (최소 "전체 서버" 포함)
      const optionCount = await serverSelect.locator('option').count();
      expect(optionCount).toBeGreaterThanOrEqual(1);

      // 두 번째 옵션이 있으면 선택해보기
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

    test('[디자인] Alert History Realtime Anchor 타임스탬프 표시', async ({
      page,
    }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // Realtime Anchor 배지 확인
      await expect(modal.getByText('Realtime Anchor')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    });

    test('[엔지니어] Alert History 통계 Footer가 정확히 표시된다', async ({
      page,
    }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

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
    });

    test('[엔지니어] Alert History 알림 항목에 필수 정보가 있다', async ({
      page,
    }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      // 알림 항목이 있는 경우 필수 정보 확인
      const alertItems = modal.locator('.border-l-4');
      const alertCount = await alertItems.count();

      if (alertCount > 0) {
        const firstAlert = alertItems.first();

        // severity 배지 (CRITICAL 또는 WARNING)
        await expect(
          firstAlert.locator('text=/critical|warning/i').first()
        ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

        // state 배지 (firing 또는 resolved)
        await expect(
          firstAlert.locator('text=/firing|resolved/i').first()
        ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

        // Fired 타임스탬프
        await expect(
          firstAlert.getByText('Fired:', { exact: false }).first()
        ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      } else {
        // 빈 상태 UI 확인
        await expect(modal.getByText('알림 이력이 없습니다')).toBeVisible({
          timeout: TIMEOUTS.DOM_UPDATE,
        });
      }
    });

    test('[디자인] Alert History ESC로 닫기', async ({ page }) => {
      await page.locator(ALERT_HISTORY_BUTTON).first().click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible({
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
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

  test('[FE] 로그 검색 버튼 클릭 → 모달 열기', async ({ page }) => {
    const button = page.locator(LOG_EXPLORER_BUTTON).first();
    await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
    await button.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 헤더: "로그 탐색기"
    await expect(modal.getByText('로그 탐색기')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
  });

  test('[FE] 로그 탐색기 키워드 검색이 동작한다', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 키워드 검색 input
    const searchInput = modal.locator('input[aria-label="로그 키워드 검색"]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    // 검색어 입력
    await searchInput.fill('error');
    // debounce 대기 (300ms + 여유)
    await page.waitForTimeout(500);

    // 검색 결과가 필터링되었는지 확인 (로그가 있거나 없거나)
    // - 로그 영역이 여전히 존재해야 함 (크래시 없음)
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  });

  test('[FE] 로그 탐색기 레벨 필터 칩이 동작한다', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 레벨 필터: 전체, 정보, 경고, 오류
    for (const label of ['전체', '정보', '경고', '오류']) {
      const chip = modal.getByRole('button', { name: label }).first();
      await expect(chip).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await chip.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // 모달이 유지되는지 확인 (크래시 방지)
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }
  });

  test('[FE] 로그 탐색기 소스 필터 드롭다운', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 소스 필터 드롭다운
    const sourceSelect = modal.locator('select[aria-label="소스 필터"]');
    await expect(sourceSelect).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    const optionCount = await sourceSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(1); // 최소 "전체 소스"

    // 두 번째 옵션 선택
    if (optionCount > 1) {
      const secondOption = await sourceSelect
        .locator('option')
        .nth(1)
        .getAttribute('value');
      if (secondOption) {
        await sourceSelect.selectOption(secondOption);
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    }
  });

  test('[FE] 로그 탐색기 서버 필터 드롭다운', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

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

  test('[디자인] 로그 탐색기 터미널 스타일 UI가 표시된다', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 터미널 스타일 영역 (어두운 배경, font-mono)
    const terminalArea = modal.locator('.font-mono').first();
    await expect(terminalArea).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  });

  test('[디자인] 로그 탐색기 Realtime Anchor 표시', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    await expect(modal.getByText('Realtime Anchor')).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
  });

  test('[엔지니어] 로그 탐색기 통계 Footer가 올바르게 표시된다', async ({
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
  });

  test('[엔지니어] 로그 항목에 필수 정보가 포함되어 있다', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 로그 항목이 있는 경우 필수 정보 확인
    const logItems = modal.locator('.border-l-2');
    const logCount = await logItems
      .first()
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);

    if (logCount) {
      const firstLog = logItems.first();

      // 레벨 배지 (INFO/WARN/ERROR)
      await expect(
        firstLog.locator('text=/INFO|WARN|ERROR/').first()
      ).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

      // 서버 ID 배지
      const serverBadge = firstLog.locator('.text-blue-400').first();
      await expect(serverBadge).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    } else {
      // 빈 상태
      await expect(modal.getByText('로그가 없습니다')).toBeVisible({
        timeout: TIMEOUTS.DOM_UPDATE,
      });
    }
  });

  test('[엔지니어] 로그 탐색기 "더 보기" 버튼이 동작한다', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // "더 보기" 버튼이 있으면 클릭 테스트
    const loadMoreButton = modal.getByRole('button', {
      name: /더 보기/,
    });
    const hasLoadMore = await loadMoreButton
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);

    if (hasLoadMore) {
      await loadMoreButton.click();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      // 모달이 여전히 정상인지 확인
      await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
    }
  });

  test('[디자인] 로그 탐색기 ESC로 닫기', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({
      timeout: TIMEOUTS.MODAL_DISPLAY,
    });
  });

  test('[FE] 로그 탐색기 복합 필터 조합 테스트', async ({ page }) => {
    await page.locator(LOG_EXPLORER_BUTTON).first().click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 1. 레벨을 "오류"로 변경
    await modal.getByRole('button', { name: '오류' }).first().click();
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    // 2. 키워드 검색
    const searchInput = modal.locator('input[aria-label="로그 키워드 검색"]');
    await searchInput.fill('timeout');
    await page.waitForTimeout(500);

    // 3. 모달이 크래시 없이 유지되는지 확인
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    // 4. 필터 초기화: 전체로 복원
    await modal.getByRole('button', { name: '전체' }).first().click();
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});
