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
import {
  doesAiTextMatchDashboardStatus,
  formatDashboardStatusSnapshot,
  getNewConversationText,
  readDashboardStatusSnapshot,
} from './helpers/dashboard-ai-parity';
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
  page: import('@playwright/test').Page,
  submittedPrompt: string
): Promise<string> {
  const conversationLog = sidebar.getByRole('log', { name: 'AI 대화 메시지' });
  const previousText =
    (await conversationLog.textContent().catch(() => '')) ?? '';

  // Clarification 다이얼로그 처리
  await handleClarificationIfPresent(page);

  // Production에서는 data-testid가 strip되고, 응답은 collapse view로 렌더링될 수 있음
  await expect
    .poll(
      async () => {
        const text =
          (await conversationLog.textContent().catch(() => '')) ?? '';
        const newConversationText = getNewConversationText(previousText, text);
        const normalizedText = newConversationText.trim();
        const responseCandidate = normalizedText
          .replace(submittedPrompt, '')
          .trim();
        if (
          !responseCandidate ||
          responseCandidate.includes('응답을 생성하지 못했습니다')
        ) {
          return '';
        }

        const hasAiResponse =
          responseCandidate.includes('Streaming AI') ||
          responseCandidate.includes('Job Queue AI') ||
          responseCandidate.includes('서버 현황 요약') ||
          /전체\s*\d+\s*대/.test(responseCandidate) ||
          /(핵심 요약|상세 분석|조치|서버|CPU|메모리|디스크|리스크|보고서)/.test(
            responseCandidate
          );

        return hasAiResponse ? normalizedText : '';
      },
      { timeout: TIMEOUTS.AI_RESPONSE }
    )
    .not.toBe('');

  const finalText = (await conversationLog.textContent().catch(() => '')) ?? '';
  return getNewConversationText(previousText, finalText);
}

async function getVisibleStarterPrompt(
  sidebar: import('@playwright/test').Locator
) {
  const candidates = [
    sidebar.locator('button[data-prompt-title="전체 서버 상태"]').first(),
    sidebar.locator('button[data-prompt-title="서버 상태 확인"]').first(),
    sidebar.locator('button[data-prompt-index="0"]').first(),
    sidebar
      .getByRole('button', {
        name: /전체 서버 상태|정상 상태 유지 점검|오늘 성능 추세|지난 1시간 이상 징후|장애 보고서 생성|보고서 생성|리스크 서버 분석/,
      })
      .first(),
  ];

  for (const candidate of candidates) {
    if (
      await candidate
        .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
        .catch(() => false)
    ) {
      return candidate;
    }
  }

  return sidebar
    .locator(
      'button[data-prompt-index], button[data-testid="ai-starter-prompt-card"]'
    )
    .first();
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

    const promptCard = await getVisibleStarterPrompt(sidebar);
    await expect(promptCard).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });
    await promptCard.click();

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).not.toHaveValue('');
    const starterPromptText = await input.inputValue();

    // 전송
    await submitMessage(page, input);

    // AI 응답 대기
    const aiResponseText = await waitForAiResponse(
      sidebar,
      page,
      starterPromptText
    );
    expect(
      aiResponseText.trim().length,
      `Starter AI response must be non-empty for prompt=${starterPromptText}. response=${aiResponseText.slice(
        0,
        500
      )}`
    ).toBeGreaterThan(0);
  });

  test('직접 메시지 입력 → 전송 → AI 응답 수신', async ({ page }) => {
    const dashboardSnapshot = await readDashboardStatusSnapshot(page);
    const sidebar = await openAiSidebar(page, {
      waitTimeout: TIMEOUTS.COMPLEX_INTERACTION,
    });
    await expect(sidebar).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });

    // Clarification을 유도하지 않는 명시적 질의 사용
    const directPrompt = '현재 모든 서버의 상태를 요약해줘';
    await input.fill(directPrompt);
    await submitMessage(page, input);

    // AI 응답 대기
    const aiResponseText = await waitForAiResponse(sidebar, page, directPrompt);
    expect(
      doesAiTextMatchDashboardStatus(aiResponseText, dashboardSnapshot),
      `AI response must match dashboard status counts (${formatDashboardStatusSnapshot(
        dashboardSnapshot
      )}). response=${aiResponseText.slice(0, 500)}`
    ).toBe(true);
  });
});
