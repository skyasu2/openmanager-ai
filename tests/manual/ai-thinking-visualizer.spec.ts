import * as fs from 'node:fs/promises';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { resetGuestState } from '../e2e/helpers/guest';
import { skipIfSecurityCheckpoint } from '../e2e/helpers/security';
import { TIMEOUTS } from '../e2e/helpers/timeouts';
import {
  handleClarificationIfPresent,
  navigateToDashboard,
} from '../e2e/helpers/ui-flow';

const THINKING_PROMPTS = [
  '/qa-thinking-visualizer',
  'lb-haproxy-dc1-01 서버 상태를 분석하고 즉시 조치 우선순위 3단계를 제시해줘. 각 단계 근거도 함께 써줘.',
  '전체 서버 중 이상 징후 상위 3개를 찾아서 원인 가설과 대응 순서를 표로 정리해줘.',
  'api-was-dc1-01의 CPU/메모리/디스크 지표를 기반으로 현재 위험도를 판정하고 운영자가 바로 실행할 체크리스트를 만들어줘.',
];

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();
    // Local dev(Turbopack/HMR)에서 간헐적으로 발생하는 websocket handshake 노이즈는 QA 판정에서 제외
    const isDevHmrNoise =
      text.includes('/_next/webpack-hmr') &&
      text.includes('ERR_INVALID_HTTP_RESPONSE');
    if (isDevHmrNoise) return;
    const isLocalOtelLoaderNoise =
      text.includes('[OTel Data Loader] Error loading timeseries.json') &&
      text.includes('Failed to fetch');
    if (isLocalOtelLoaderNoise) return;

    errors.push(text);
  });
  return errors;
}

async function openFullscreenWorkspace(page: Page): Promise<void> {
  await page.goto('/dashboard/ai-assistant', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.DASHBOARD_LOAD,
  });
  await skipIfSecurityCheckpoint(page, 'thinking-visualizer-fullscreen');
  await expect(page.getByText(/AI Workspace|AI Chat/).first()).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
}

async function submitPromptAndWaitForAssistant(
  page: Page,
  prompt: string
): Promise<void> {
  const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
  await expect(input).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });

  const conversationLog = page.getByRole('log', { name: 'AI 대화 메시지' });
  const previousText =
    (await conversationLog.textContent().catch(() => '')) ?? '';

  await input.fill(prompt);
  await input.press('Enter');

  await handleClarificationIfPresent(page);

  await expect
    .poll(
      async () => {
        const currentText =
          (await conversationLog.textContent().catch(() => '')) ?? '';
        return currentText.trim().length > previousText.trim().length + 10;
      },
      { timeout: TIMEOUTS.AI_RESPONSE }
    )
    .toBe(true);
}

async function resetConversationIfPossible(page: Page): Promise<void> {
  const newChatButton = page.getByRole('button', { name: '새 대화' }).first();
  const isVisible = await newChatButton
    .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
    .catch(() => false);

  if (!isVisible) return;

  await newChatButton.click();
  const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
  await expect(input).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });
}

async function findThinkingToggle(page: Page): Promise<Locator | null> {
  const toggles = page.locator('button:has-text("AI 처리 과정 (")');
  const count = await toggles.count();
  if (count === 0) return null;
  return toggles.nth(count - 1);
}

test.describe('Production thinking visualizer manual', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
    await navigateToDashboard(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('thinking visualizer toggles with a prompt set that triggers reasoning steps', async ({
    page,
  }, testInfo) => {
    const consoleErrors = trackConsoleErrors(page);
    await openFullscreenWorkspace(page);

    let matchedPrompt: string | null = null;

    for (const prompt of THINKING_PROMPTS) {
      await submitPromptAndWaitForAssistant(page, prompt);

      const toggle = await findThinkingToggle(page);
      if (toggle) {
        await toggle.click();
        const visualizer = page.locator('text=🤖 AI 처리 과정').last();
        await expect(visualizer).toBeVisible({
          timeout: TIMEOUTS.COMPLEX_INTERACTION,
        });
        matchedPrompt = prompt;
        break;
      }

      await resetConversationIfPossible(page);
    }

    expect(matchedPrompt).not.toBeNull();
    expect(consoleErrors).toEqual([]);

    const summaryPath = testInfo.outputPath('thinking-visualizer-summary.txt');
    const summary = `matchedPrompt=${matchedPrompt ?? 'none'}\npromptCount=${THINKING_PROMPTS.length}\n`;
    await fs.writeFile(summaryPath, summary, 'utf8');

    const screenshotPath = testInfo.outputPath('thinking-visualizer.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    await testInfo.attach('thinking-visualizer-summary', {
      path: summaryPath,
      contentType: 'text/plain',
    });
    await testInfo.attach('thinking-visualizer-screenshot', {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });
});
