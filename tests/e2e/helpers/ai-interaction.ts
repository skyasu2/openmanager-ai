/**
 * 🤖 AI 사이드바 인터랙션 헬퍼 함수
 *
 * 🎯 목적: AI 사이드바 테스트의 공통 동작을 재사용 가능한 함수로 추상화
 * 📊 효과: 코드 중복 제거, 테스트 가독성 향상, MCP 통합 지원
 *
 * 사용 예시:
 * ```typescript
 * import { submitAiMessage, switchAiFunction, closeAiSidebar } from './helpers/ai-interaction';
 *
 * // AI 메시지 제출 및 응답 대기
 * const response = await submitAiMessage(page, '서버 상태를 알려주세요');
 *
 * // AI 기능 전환
 * await switchAiFunction(page, 'intelligent-monitoring');
 *
 * // 사이드바 닫기
 * await closeAiSidebar(page);
 * ```
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { TIMEOUTS } from './timeouts';

/**
 * AI 메시지 제출 옵션
 */
export interface SubmitAiMessageOptions {
  /** AI 응답 대기 여부 (기본값: true) */
  waitForResponse?: boolean;
  /** 응답 대기 timeout (기본값: TIMEOUTS.AI_RESPONSE) */
  responseTimeout?: number;
  /** SSE 스트리밍 완료 감지 여부 (기본값: true) */
  detectStreamingEnd?: boolean;
  /** MCP 콘솔 로깅 활성화 (기본값: true) */
  enableMcpLogging?: boolean;
}

/**
 * AI 기능 전환 옵션
 */
export interface SwitchAiFunctionOptions {
  /** 전환 후 UI 업데이트 대기 여부 (기본값: true) */
  waitForUiUpdate?: boolean;
  /** UI 업데이트 대기 timeout (기본값: TIMEOUTS.DOM_UPDATE) */
  uiUpdateTimeout?: number;
}

/**
 * 사이드바 닫기 옵션
 */
export interface CloseAiSidebarOptions {
  /** 닫기 방법: 'esc' | 'button' | 'overlay' (기본값: 'esc') */
  method?: 'esc' | 'button' | 'overlay';
  /** 닫힌 상태 확인 여부 (기본값: true) */
  verifyClose?: boolean;
  /** 닫힌 상태 확인 timeout (기본값: TIMEOUTS.DOM_UPDATE) */
  verifyTimeout?: number;
}

/**
 * AI 메시지 제출 응답
 */
export interface AiMessageResponse {
  /** AI 응답 텍스트 */
  responseText: string;
  /** 응답 시간 (ms) */
  responseTime: number;
  /** SSE 이벤트 수 */
  sseEventCount?: number;
  /** 콘솔 로그 (MCP 활성화 시) */
  consoleLogs?: string[];
}

/**
 * AI 사이드바에 메시지를 제출하고 응답을 대기합니다.
 *
 * @param page - Playwright Page 객체
 * @param message - 제출할 메시지
 * @param options - 제출 옵션
 * @returns AI 응답 정보
 *
 * @example
 * ```typescript
 * const response = await submitAiMessage(page, '서버 상태를 알려주세요');
 * expect(response.responseText).toContain('서버');
 * expect(response.responseTime).toBeLessThan(10000);
 * ```
 */
export async function submitAiMessage(
  page: Page,
  message: string,
  options: SubmitAiMessageOptions = {}
): Promise<AiMessageResponse> {
  const {
    waitForResponse = true,
    responseTimeout = TIMEOUTS.AI_RESPONSE,
    detectStreamingEnd = true,
    enableMcpLogging = true,
  } = options;

  const startTime = Date.now();
  const consoleLogs: string[] = [];

  // MCP 콘솔 로깅 설정
  if (enableMcpLogging) {
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[AI]') ||
        text.includes('[SSE]') ||
        text.includes('[Stream]')
      ) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });
  }

  // 입력 필드 찾기
  const inputSelectors = [
    'textarea[placeholder*="질문"]',
    'textarea[placeholder*="메시지"]',
    'textarea[name="message"]',
    'input[type="text"][placeholder*="질문"]',
  ];

  let inputField: Locator | null = null;
  for (const selector of inputSelectors) {
    const candidate = page.locator(selector).first();
    const isVisible = await candidate
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false);
    if (isVisible) {
      inputField = candidate;
      break;
    }
  }

  if (!inputField) {
    throw new Error(
      `AI 입력 필드를 찾을 수 없습니다.\n` +
        `페이지: ${page.url()}\n` +
        `시도한 셀렉터: ${inputSelectors.join(', ')}`
    );
  }

  // 메시지 입력
  await inputField.fill(message);

  // 제출 버튼 찾기
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("전송")',
    'button:has-text("Send")',
    'button[aria-label*="전송"]',
  ];

  let submitButton: Locator | null = null;
  for (const selector of submitSelectors) {
    const candidate = page.locator(selector).first();
    const isVisible = await candidate
      .isVisible({ timeout: TIMEOUTS.CLICK_RESPONSE })
      .catch(() => false);
    if (isVisible) {
      submitButton = candidate;
      break;
    }
  }

  if (!submitButton) {
    throw new Error(
      `AI 전송 버튼을 찾을 수 없습니다.\n` +
        `페이지: ${page.url()}\n` +
        `시도한 셀렉터: ${submitSelectors.join(', ')}`
    );
  }

  // 메시지 제출
  await submitButton.click();

  if (!waitForResponse) {
    return {
      responseText: '',
      responseTime: Date.now() - startTime,
      consoleLogs: enableMcpLogging ? consoleLogs : undefined,
    };
  }

  // AI 응답 대기
  let responseText = '';
  let sseEventCount = 0;

  if (detectStreamingEnd) {
    // SSE 스트리밍 완료 감지
    const responseSelectors = [
      '[data-testid="ai-response"]',
      '.ai-message',
      '.assistant-message',
      '[role="article"]',
    ];

    let responseElement: Locator | null = null;
    for (const selector of responseSelectors) {
      const candidate = page.locator(selector).last();
      const isVisible = await candidate
        .isVisible({ timeout: responseTimeout })
        .catch(() => false);
      if (isVisible) {
        responseElement = candidate;
        break;
      }
    }

    if (responseElement) {
      // 스트리밍 완료 대기 (텍스트가 3회 연속 동일하면 완료로 간주)
      const recentSamples: string[] = [];
      await expect
        .poll(
          async () => {
            const currentText = (
              (await responseElement.textContent()) ?? ''
            ).trim();
            const prevSample = recentSamples.at(-1);
            if (currentText && currentText !== prevSample) {
              sseEventCount++;
            }
            recentSamples.push(currentText);
            if (recentSamples.length > 3) recentSamples.shift();
            return recentSamples.length === 3 &&
              recentSamples[0] !== '' &&
              recentSamples[0] === recentSamples[1] &&
              recentSamples[1] === recentSamples[2]
              ? 'stable'
              : 'streaming';
          },
          {
            timeout: Math.min(responseTimeout, 8000),
            intervals: [100, 150, 200],
          }
        )
        .toBe('stable')
        .catch(() => undefined);

      responseText = ((await responseElement.textContent()) ?? '').trim();
    }
  } else {
    const lastMessage = page
      .locator(
        '.ai-message, [data-testid="ai-message"], [data-testid="ai-response"]'
      )
      .last();
    await expect(lastMessage).toBeVisible({ timeout: responseTimeout });
    await expect
      .poll(
        async () =>
          ((await lastMessage.textContent()) ?? '').trim().length > 0 ? 1 : 0,
        {
          timeout: responseTimeout,
          intervals: [100, 200, 300],
        }
      )
      .toBe(1);
    responseText = (await lastMessage.textContent()) ?? '';
  }

  const responseTime = Date.now() - startTime;

  return {
    responseText,
    responseTime,
    sseEventCount: detectStreamingEnd ? sseEventCount : undefined,
    consoleLogs: enableMcpLogging ? consoleLogs : undefined,
  };
}

/**
 * AI 사이드바의 기능을 전환합니다.
 *
 * @param page - Playwright Page 객체
 * @param functionName - 전환할 기능 이름 ('chat' | 'auto-report' | 'intelligent-monitoring' | 'advanced-management')
 * @param options - 전환 옵션
 *
 * @example
 * ```typescript
 * await switchAiFunction(page, 'intelligent-monitoring');
 * ```
 */
export async function switchAiFunction(
  page: Page,
  functionName:
    | 'chat'
    | 'auto-report'
    | 'intelligent-monitoring'
    | 'advanced-management',
  options: SwitchAiFunctionOptions = {}
): Promise<void> {
  const { waitForUiUpdate = true, uiUpdateTimeout = TIMEOUTS.DOM_UPDATE } =
    options;

  // 기능 버튼 찾기 (data-testid 또는 텍스트 기반)
  const functionSelectors: Record<typeof functionName, string[]> = {
    chat: [
      '[data-testid="ai-function-chat"]',
      'button:has-text("채팅")',
      'button:has-text("Chat")',
    ],
    'auto-report': [
      '[data-testid="ai-function-auto-report"]',
      'button:has-text("자동 보고서")',
      'button:has-text("Auto Report")',
    ],
    'intelligent-monitoring': [
      '[data-testid="ai-function-intelligent-monitoring"]',
      'button:has-text("지능형 모니터링")',
      'button:has-text("Intelligent Monitoring")',
    ],
    'advanced-management': [
      '[data-testid="ai-function-advanced-management"]',
      'button:has-text("고급 관리")',
      'button:has-text("Advanced Management")',
    ],
  };

  const selectors = functionSelectors[functionName];
  let functionButton: Locator | null = null;

  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    const isVisible = await candidate
      .isVisible({ timeout: TIMEOUTS.MODAL_DISPLAY })
      .catch(() => false);
    if (isVisible) {
      functionButton = candidate;
      break;
    }
  }

  if (!functionButton) {
    throw new Error(
      `AI 기능 버튼 "${functionName}"을 찾을 수 없습니다.\n` +
        `페이지: ${page.url()}\n` +
        `시도한 셀렉터: ${selectors.join(', ')}`
    );
  }

  // 버튼 클릭
  await functionButton.click();

  // UI 업데이트 대기
  if (waitForUiUpdate) {
    await expect
      .poll(
        async () => {
          const ariaPressed = await functionButton.getAttribute('aria-pressed');
          const dataState = await functionButton.getAttribute('data-state');
          const ariaCurrent = await functionButton.getAttribute('aria-current');
          return (
            ariaPressed === 'true' ||
            dataState === 'active' ||
            ariaCurrent === 'true'
          );
        },
        { timeout: uiUpdateTimeout, intervals: [100, 200, 300] }
      )
      .toBe(true)
      .catch(() => undefined);
  }
}

/**
 * AI 사이드바를 닫습니다.
 *
 * @param page - Playwright Page 객체
 * @param options - 닫기 옵션
 *
 * @example
 * ```typescript
 * // ESC 키로 닫기 (기본값)
 * await closeAiSidebar(page);
 *
 * // 닫기 버튼으로 닫기
 * await closeAiSidebar(page, { method: 'button' });
 *
 * // 오버레이 클릭으로 닫기
 * await closeAiSidebar(page, { method: 'overlay' });
 * ```
 */
export async function closeAiSidebar(
  page: Page,
  options: CloseAiSidebarOptions = {}
): Promise<void> {
  const {
    method = 'esc',
    verifyClose = true,
    verifyTimeout = TIMEOUTS.DOM_UPDATE,
  } = options;

  if (method === 'esc') {
    // ESC 키로 닫기
    await page.keyboard.press('Escape');
  } else if (method === 'button') {
    // 닫기 버튼으로 닫기
    const closeButtonSelectors = [
      '[data-testid="ai-sidebar-close"]',
      'button[aria-label*="닫기"]',
      'button[aria-label*="Close"]',
      'button:has-text("×")',
    ];

    let closeButton: Locator | null = null;
    for (const selector of closeButtonSelectors) {
      const candidate = page.locator(selector).first();
      const isVisible = await candidate
        .isVisible({ timeout: TIMEOUTS.CLICK_RESPONSE })
        .catch(() => false);
      if (isVisible) {
        closeButton = candidate;
        break;
      }
    }

    if (!closeButton) {
      throw new Error(
        `AI 사이드바 닫기 버튼을 찾을 수 없습니다.\n` +
          `페이지: ${page.url()}\n` +
          `시도한 셀렉터: ${closeButtonSelectors.join(', ')}`
      );
    }

    await closeButton.click();
  } else if (method === 'overlay') {
    // 오버레이 클릭으로 닫기
    const overlaySelectors = [
      '[data-testid="ai-sidebar-overlay"]',
      '.overlay',
      '[role="presentation"]',
    ];

    let overlay: Locator | null = null;
    for (const selector of overlaySelectors) {
      const candidate = page.locator(selector).first();
      const isVisible = await candidate
        .isVisible({ timeout: TIMEOUTS.CLICK_RESPONSE })
        .catch(() => false);
      if (isVisible) {
        overlay = candidate;
        break;
      }
    }

    if (!overlay) {
      throw new Error(
        `AI 사이드바 오버레이를 찾을 수 없습니다.\n` +
          `페이지: ${page.url()}\n` +
          `시도한 셀렉터: ${overlaySelectors.join(', ')}`
      );
    }

    await overlay.click();
  }

  // 닫힌 상태 확인
  if (verifyClose) {
    const sidebarSelectors = [
      '[data-testid="ai-sidebar"]',
      '[role="complementary"]',
      'aside:has-text("AI")',
      '.ai-sidebar',
    ];

    // 사이드바가 보이지 않을 때까지 대기
    let isClosed = false;
    for (const selector of sidebarSelectors) {
      const sidebar = page.locator(selector).first();
      const isHidden = await sidebar
        .isHidden({ timeout: verifyTimeout })
        .catch(() => false);
      if (isHidden) {
        isClosed = true;
        break;
      }
    }

    if (!isClosed) {
      throw new Error(
        `AI 사이드바가 닫히지 않았습니다.\n` +
          `페이지: ${page.url()}\n` +
          `닫기 방법: ${method}`
      );
    }
  }
}
