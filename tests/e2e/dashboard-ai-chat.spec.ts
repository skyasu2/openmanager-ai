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
import { openAiSidebar, resetGuestState } from './helpers/guest';
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

/** AI 응답 대기: 프로덕션 렌더링 기준으로 로그 텍스트 변화 확인 */
async function waitForAiResponse(
  sidebar: import('@playwright/test').Locator,
  page: import('@playwright/test').Page
) {
  const conversationLog = sidebar.getByRole('log', { name: 'AI 대화 메시지' });
  const previousText = (await conversationLog.textContent().catch(() => '')) ?? '';

  // Clarification 다이얼로그 처리
  await handleClarificationIfPresent(page);

  // Production에서는 data-testid가 strip되고, 응답은 collapse view로 렌더링될 수 있음
  await expect
    .poll(
      async () => {
        const text = (await conversationLog.textContent().catch(() => '')) ?? '';
        return text.trim();
      },
      { timeout: TIMEOUTS.AI_RESPONSE }
    )
    .toSatisfy((text) => {
      if (!text || text.length <= previousText.trim().length) return false;
      if (text.includes('응답을 생성하지 못했습니다')) return false;
      return (
        text.includes('Streaming AI') ||
        text.includes('Job Queue AI') ||
        text.includes('서버 현황 요약') ||
        text.includes('전체 15대')
      );
    });
}

test.describe('AI 채팅 E2E 테스트', () => {
  test.describe.configure({ timeout: TIMEOUTS.FULL_USER_FLOW });

  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
    await navigateToDashboard(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('스타터 프롬프트 클릭 → 메시지 전송 → AI 응답 수신', async ({
    page,
  }) => {
    const sidebar = await openAiSidebar(page, {
      waitTimeout: TIMEOUTS.COMPLEX_INTERACTION,
    });
    await expect(sidebar).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    // Production에서는 data-testid가 strip되므로, starter prompt는 버튼 텍스트로 선택
    const promptCards = page.locator(
      'button:has-text("서버 상태 확인"), button:has-text("장애 분석"), button:has-text("성능 예측")'
    );
    await expect(promptCards.first()).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
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
    const sidebar = await openAiSidebar(page, {
      waitTimeout: TIMEOUTS.COMPLEX_INTERACTION,
    });
    await expect(sidebar).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });

    // Clarification을 유도하지 않는 명시적 질의 사용
    await input.fill('현재 모든 서버의 상태를 요약해줘');
    await submitMessage(page, input);

    // AI 응답 대기
    await waitForAiResponse(sidebar, page);
  });
});
