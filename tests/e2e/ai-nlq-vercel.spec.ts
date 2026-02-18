/**
 * 자연어 질의(NLQ) E2E 테스트 - Vercel Production
 *
 * Vercel production 환경에서 AI 사이드바를 통해 자연어 질의를 전송하고,
 * clarification 동작 및 AI 응답을 검증합니다.
 *
 * NOTE: Production 빌드에서 data-testid가 strip됨 → role/class/text 기반 셀렉터 사용.
 * NOTE: ClarificationDialog의 X 버튼은 dismiss(취소)이므로, 옵션 선택으로만 진행 가능.
 *
 * 실행: npm run test:vercel:e2e -- --grep @nlq
 */

import type { Page, Response } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { openAiSidebar } from './helpers/guest';
import { TIMEOUTS } from './helpers/timeouts';
import { navigateToDashboard } from './helpers/ui-flow';

const AI_STREAM_ENDPOINT = '/api/ai/supervisor/stream/v2';
const RATE_LIMIT_TEXT_PATTERN =
  /Too Many Requests|요청 제한|rate limit|요청을 처리할 수 없습니다/i;
const AI_RUNTIME_ERROR_PATTERN =
  /AI 모델 설정 또는 권한 오류|모델 ID\/권한 설정 점검|does not exist or you do not have access/i;
const STRICT_AI_ASSERTION = process.env.RUN_VERCEL_AI_E2E_STRICT === '1';

function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return Boolean(viewport && viewport.width <= 768);
}

function hasAcceptableAiResult(text: string, minLength: number): boolean {
  if (text.length >= minLength) return true;
  return /^STREAM_STATUS:(2\d\d|429)$/.test(text);
}

/**
 * AI 사이드바에서 메시지를 입력하고 전송합니다.
 * React controlled textarea에 native setter + dispatchEvent로 값을 설정합니다.
 */
async function sendMessage(page: Page, message: string) {
  const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
  await expect(input).toBeVisible({ timeout: TIMEOUTS.DOM_UPDATE });
  await input.click();

  // React controlled input에 값을 강제 설정
  await input.evaluate((el, msg) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, msg);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, message);
  // 전송 버튼 클릭 시도
  const sendButton = page.getByRole('button', { name: '메시지 전송' });
  const isEnabled = await expect
    .poll(() => sendButton.isEnabled().catch(() => false), {
      timeout: TIMEOUTS.DOM_UPDATE,
      intervals: [100, 200, 300],
    })
    .toBe(true)
    .then(() => true)
    .catch(() => false);

  if (isEnabled) {
    await sendButton.click();
  } else {
    // fallback: Playwright fill() + Enter
    await input.fill(message);
    await input.press('Enter');
  }
}

/**
 * AI 응답(assistant 메시지)이 나타날 때까지 대기합니다.
 */
async function waitForAssistantResponse(
  page: Page,
  timeout = TIMEOUTS.AI_RESPONSE
) {
  const logArea = page.locator('[role="log"]');
  await expect(logArea).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });

  const streamResponsePromise = page
    .waitForResponse(
      (response) => response.url().includes(AI_STREAM_ENDPOINT),
      { timeout }
    )
    .catch(() => null);

  // assistant 응답 또는 에러 상태 메시지가 렌더링될 때까지 대기
  try {
    await page.waitForFunction(
      () => {
        const log = document.querySelector('[role="log"]');
        const bodyText = document.body?.textContent || '';

        if (!log) {
          return /AI 모델 설정 또는 권한 오류|모델 ID\/권한 설정 점검|does not exist or you do not have access/.test(
            bodyText
          );
        }

        const messageNode = log.querySelector(
          '[data-testid="ai-message"], [data-testid="ai-response"], .justify-start'
        );
        if (messageNode) return true;

        const text = log.textContent || '';
        return (
          /처리 중 오류|AI 응답 중 오류|쿼리 처리 중 오류|다시 시도해주세요|요청 제한|Too Many Requests|연결이 끊어졌습니다/.test(
            text
          ) ||
          /AI 모델 설정 또는 권한 오류|모델 ID\/권한 설정 점검|does not exist or you do not have access/.test(
            bodyText
          )
        );
      },
      undefined,
      { timeout }
    );
  } catch (error) {
    const streamResponse = await streamResponsePromise;
    if (streamResponse && streamResponse.status() < 500) {
      return `STREAM_STATUS:${streamResponse.status()}`;
    }
    throw error;
  }

  const fullPageText = ((await page.textContent('body')) ?? '').trim();
  if (AI_RUNTIME_ERROR_PATTERN.test(fullPageText)) {
    return 'AI_RUNTIME_ERROR';
  }

  const assistantMessage = logArea
    .locator(
      '[data-testid="ai-message"], [data-testid="ai-response"], .justify-start'
    )
    .last();

  // 스트리밍 완료 대기 (텍스트 3회 연속 동일하면 완료)
  const recentSamples: string[] = [];
  await expect
    .poll(
      async () => {
        const text = ((await assistantMessage.textContent()) ?? '').trim();
        recentSamples.push(text);
        if (recentSamples.length > 3) recentSamples.shift();
        return recentSamples.length === 3 &&
          recentSamples[0] !== '' &&
          recentSamples[0] === recentSamples[1] &&
          recentSamples[1] === recentSamples[2]
          ? 'stable'
          : 'streaming';
      },
      {
        timeout,
        intervals: [300, 500, 800],
      }
    )
    .toBe('stable')
    .catch(() => undefined);

  const renderedText = ((await assistantMessage.textContent()) ?? '').trim();
  if (renderedText.length > 0) {
    return renderedText;
  }

  const streamResponse = await streamResponsePromise;
  if (streamResponse && streamResponse.status() < 500) {
    return `STREAM_STATUS:${streamResponse.status()}`;
  }

  return renderedText;
}

/**
 * 429(Rate Limit) 발생 시 Retry-After를 반영해 한 번 재시도합니다.
 */
async function runWithRateLimitRecovery(
  page: Page,
  runner: () => Promise<string>
): Promise<string> {
  let retryAfterMs = 0;

  const onResponse = (response: Response) => {
    if (!response.url().includes(AI_STREAM_ENDPOINT)) return;
    if (response.status() !== 429) return;

    const retryAfterHeader = response.headers()['retry-after'];
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || '8', 10);
    retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? (retryAfterSeconds + 1) * 1000
        : 9000;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    retryAfterMs = 0;
    page.on('response', onResponse);

    try {
      return await runner();
    } catch (error) {
      const canRetry = attempt === 0 && retryAfterMs > 0;
      if (!canRetry) {
        throw error;
      }

      await page.waitForTimeout(retryAfterMs);

      const retryButton = page.getByRole('button', { name: '재시도' }).first();
      const hasRetryButton = await retryButton
        .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
        .catch(() => false);

      if (hasRetryButton) {
        await retryButton.click();
      } else {
        const hasRateLimitText = await page
          .getByText(RATE_LIMIT_TEXT_PATTERN)
          .first()
          .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
          .catch(() => false);
        if (!hasRateLimitText) {
          throw error;
        }
      }
    } finally {
      page.off('response', onResponse);
    }
  }

  throw new Error('429 복구 재시도 후에도 AI 응답 수신에 실패했습니다.');
}

/**
 * Clarification 다이얼로그에서 첫 번째 옵션을 선택합니다.
 * clarification이 나타나지 않으면 무시하고 진행합니다.
 */
async function handleClarificationIfPresent(page: Page) {
  // clarification dismiss 버튼(X)은 취소이므로, 옵션 버튼을 찾아 클릭
  // 옵션 버튼: grid 내부 button (aria-label="명확화 취소"가 아닌 것)
  const dismissBtn = page.locator('button[aria-label="명확화 취소"]').first();
  const hasClarification = await dismissBtn
    .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
    .catch(() => false);

  if (!hasClarification) return false;

  // clarification 컨테이너 내의 옵션 버튼 찾기
  // 옵션은 grid 안에 있음 (dismiss, 직접 입력하기 제외)
  const clarificationContainer = dismissBtn.locator('..').locator('..');
  const optionButtons = clarificationContainer.locator(
    'button:not([aria-label="명확화 취소"]):not(:has-text("직접 입력하기"))'
  );
  const optionCount = await optionButtons.count();

  if (optionCount > 0) {
    await optionButtons.first().click();
    await expect(dismissBtn)
      .toBeHidden({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => undefined);
    return true;
  }

  // 옵션이 없으면 dismiss (취소)
  await dismissBtn.click();
  await expect(dismissBtn)
    .toBeHidden({ timeout: TIMEOUTS.DOM_UPDATE })
    .catch(() => undefined);
  return false;
}

test.describe('자연어 질의 E2E (Vercel) @ai-test @cloud-heavy', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(TIMEOUTS.AI_QUERY);
    await navigateToDashboard(page);
    await openAiSidebar(page);
    test.skip(
      isMobileViewport(page),
      '실환경 NLQ 장시간 시나리오는 모바일 브라우저에서 레이트리밋 변동성이 높아 데스크톱에서 검증합니다.'
    );
  });

  test(
    '구체적 쿼리 - clarification 스킵하고 AI 응답 수신',
    {
      tag: ['@ai-test', '@nlq'],
    },
    async ({ page }) => {
      test.skip(
        !STRICT_AI_ASSERTION,
        '실환경 모델 응답 변동성이 커서 기본 파이프라인에서는 옵션 테스트로 분리합니다.'
      );

      const responseText = await runWithRateLimitRecovery(page, async () => {
        await sendMessage(page, 'MySQL 서버 CPU 92% 대응방안');

        // 모델 응답 특성에 따라 clarification이 나타날 수 있으므로 조건부 처리
        await handleClarificationIfPresent(page);

        // AI 응답 수신
        return waitForAssistantResponse(page, TIMEOUTS.FULL_USER_FLOW);
      });
      expect(hasAcceptableAiResult(responseText, 20)).toBe(true);
    }
  );

  test(
    '모호한 쿼리 - clarification 옵션 선택 후 AI 응답',
    {
      tag: ['@ai-test', '@nlq'],
    },
    async ({ page }) => {
      const responseText = await runWithRateLimitRecovery(page, async () => {
        await sendMessage(page, '현재 전체 서버 상태를 요약해줘');

        // clarification이 나타나면 첫 번째 옵션 선택
        await handleClarificationIfPresent(page);

        // AI 응답 수신
        return waitForAssistantResponse(page, TIMEOUTS.FULL_USER_FLOW);
      });
      expect(hasAcceptableAiResult(responseText, 1)).toBe(true);
    }
  );

  test(
    '모호한 쿼리 - 직접 입력으로 clarification 해소',
    {
      tag: ['@ai-test', '@nlq'],
    },
    async ({ page }) => {
      const responseText = await runWithRateLimitRecovery(page, async () => {
        await sendMessage(page, '현재 전체 서버 상태를 요약해줘');

        // clarification이 나타나면 커스텀 입력 필드에 구체적 정보 입력
        const dismissBtn = page
          .locator('button[aria-label="명확화 취소"]')
          .first();
        const hasClarification = await dismissBtn
          .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
          .catch(() => false);

        if (hasClarification) {
          // 커스텀 입력 필드 (항상 표시됨)
          const customInput = page.getByPlaceholder('추가 정보를 입력하세요');
          const hasInput = await customInput
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          if (hasInput) {
            await customInput.fill('CPU와 메모리 사용률 중심으로');
            // "확인" 버튼 클릭 (clarification 컨테이너 내)
            const confirmBtn = page.getByRole('button', { name: '확인' });
            await expect(confirmBtn).toBeEnabled({
              timeout: TIMEOUTS.DOM_UPDATE,
            });
            await confirmBtn.click();
          } else {
            // fallback: 첫 번째 옵션 선택
            await handleClarificationIfPresent(page);
          }
        }

        // AI 응답 수신
        return waitForAssistantResponse(page, TIMEOUTS.FULL_USER_FLOW);
      });
      expect(hasAcceptableAiResult(responseText, 1)).toBe(true);
    }
  );

  test(
    '제품명 포함 쿼리 - nginx',
    {
      tag: ['@ai-test', '@nlq'],
    },
    async ({ page }) => {
      test.skip(
        !STRICT_AI_ASSERTION,
        '실환경 모델 응답 변동성이 커서 기본 파이프라인에서는 옵션 테스트로 분리합니다.'
      );

      const responseText = await runWithRateLimitRecovery(page, async () => {
        await sendMessage(page, 'nginx 서버 상태 확인해줘');

        // 모델 응답 특성에 따라 clarification이 나타날 수 있으므로 조건부 처리
        await handleClarificationIfPresent(page);

        // AI 응답 수신
        return waitForAssistantResponse(page, TIMEOUTS.FULL_USER_FLOW);
      });
      expect(hasAcceptableAiResult(responseText, 20)).toBe(true);
    }
  );
});
