/**
 * 대시보드 AI 사이드바 전체 플로우 테스트
 *
 * 테스트 범위:
 * - AI 사이드바 열기/닫기
 * - AI 메시지 입력
 * - 채팅 히스토리 표시
 */

import { expect, test } from '@playwright/test';
import { openAiSidebar } from './helpers/guest';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

test.describe('대시보드 AI 사이드바 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);

    // AI 토글 렌더링 대기 (문구 exact-match 의존 제거)
    await page
      .locator('[data-testid="ai-assistant"]')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_DISPLAY });
  });

  test('AI 사이드바 열기', async ({ page }) => {
    const sidebar = await openAiSidebar(page);
    await expect(sidebar).toBeVisible();
  });

  test('AI 메시지 입력 필드 확인', async ({ page }) => {
    await openAiSidebar(page);

    // Fix: input/textarea는 텍스트 노드가 없으므로 placeholder 사용
    const input = page
      .locator(
        'textarea[placeholder*="메시지"], textarea[placeholder*="질문"], input[type="text"][placeholder*="AI"]'
      )
      .first();
    await expect(input).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  });

  test('AI 스타터 프롬프트 카드가 입력창에 반영된다', async ({ page }) => {
    const sidebar = await openAiSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    const promptCards = page.locator('[data-testid="ai-starter-prompt-card"]');
    await expect(promptCards.first()).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });

    const cardCount = await promptCards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const card = promptCards.nth(i);
      await expect(card).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
      await card.click();

      await expect
        .poll(async () => {
          const value = await input.inputValue();
          return value.trim().length > 0;
        })
        .toBe(true);

      await input.fill('');
    }
  });

  test('AI 사이드바 닫기 (ESC)', async ({ page }) => {
    const sidebar = await openAiSidebar(page);

    await page.keyboard.press('Escape');
    await expect(sidebar).not.toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  });
});
