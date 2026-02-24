/**
 * AI 채팅 E2E 테스트
 *
 * 테스트 범위:
 * - 스타터 프롬프트 → 전송 → AI 응답 수신
 * - 직접 메시지 입력 → 전송 → AI 응답 수신
 *
 * 참고: AI 응답 시간 최대 120초 (TIMEOUTS.AI_RESPONSE)
 */

import { expect, test } from '@playwright/test';
import { openAiSidebar } from './helpers/guest';
import { TIMEOUTS } from './helpers/timeouts';
import {
  handleClarificationIfPresent,
  navigateToDashboard,
} from './helpers/ui-flow';

/** 메시지 전송: submit 버튼 또는 Enter 키 */
async function submitMessage(
  page: import('@playwright/test').Page,
  input: import('@playwright/test').Locator
) {
  const sendButton = page
    .locator('button[type="submit"], button[aria-label*="전송"]')
    .first();
  const hasSendButton = await sendButton
    .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
    .catch(() => false);

  if (hasSendButton) {
    await sendButton.click();
  } else {
    await input.press('Enter');
  }
}

/** AI 응답 대기: data-testid="ai-message" 등장 확인 */
async function waitForAiResponse(
  sidebar: import('@playwright/test').Locator,
  page: import('@playwright/test').Page
) {
  // Clarification 다이얼로그 처리
  await handleClarificationIfPresent(page);

  // AI 응답 메시지가 나타날 때까지 대기
  const aiMessage = sidebar.locator('[data-testid="ai-message"]').first();
  await expect(aiMessage).toBeVisible({ timeout: TIMEOUTS.AI_RESPONSE });

  // 응답 텍스트가 비어있지 않은지 확인
  const text = await aiMessage.textContent();
  expect(text && text.trim().length > 0).toBe(true);
}

test.describe('AI 채팅 E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
    await page
      .locator('[data-testid="ai-assistant"]')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_DISPLAY });
  });

  test('스타터 프롬프트 클릭 → 메시지 전송 → AI 응답 수신', async ({
    page,
  }) => {
    const sidebar = await openAiSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    // 스타터 프롬프트 카드 클릭
    const promptCards = page.locator('[data-testid="ai-starter-prompt-card"]');
    await expect(promptCards.first()).toBeVisible({
      timeout: TIMEOUTS.DOM_UPDATE,
    });
    await promptCards.first().click();

    // 입력 필드에 값이 채워졌는지 확인
    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect
      .poll(async () => (await input.inputValue()).trim().length > 0)
      .toBe(true);

    // 전송
    await submitMessage(page, input);

    // AI 응답 대기
    await waitForAiResponse(sidebar, page);
  });

  test('직접 메시지 입력 → 전송 → AI 응답 수신', async ({ page }) => {
    const sidebar = await openAiSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });

    // 짧은 테스트 메시지 입력 → 전송
    await input.fill('서버 상태 요약');
    await submitMessage(page, input);

    // AI 응답 대기
    await waitForAiResponse(sidebar, page);
  });
});
