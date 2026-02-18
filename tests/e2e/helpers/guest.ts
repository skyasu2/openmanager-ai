import type { Locator, Page } from '@playwright/test';
import { ensureVercelBypassCookie } from './security';
import { TIMEOUTS } from './timeouts';

export type LoginProvider = 'guest' | 'github' | 'google';

export interface LoginButtonSelectors {
  guest: string[];
  github: string[];
  google: string[];
  loginButton: string[];
}

export interface GuestLoginOptions {
  landingPath?: string;
  guestButtonSelector?: string;
  waitForPath?: string;
  skipLandingNavigation?: boolean;
  /** 로그인 페이지로 직접 이동할지 여부 (기본값: false - 메인에서 로그인 버튼 클릭) */
  navigateToLoginPage?: boolean;
}

/**
 * 로그인 버튼 셀렉터 (우선순위 순서)
 * 2024-12: Google 로그인 추가, 버튼명 변경 반영
 */
export const LOGIN_BUTTON_SELECTORS: LoginButtonSelectors = {
  guest: [
    'button:has-text("게스트 모드")',
    'button:has-text("게스트로 체험하기")', // 레거시 지원
    '[data-testid="guest-login"]',
    'button[aria-label*="게스트"]',
  ],
  github: [
    'button:has-text("GitHub로 로그인")',
    'button:has-text("GitHub")',
    '[data-testid="github-login"]',
    'button[aria-label*="GitHub"]',
  ],
  google: [
    'button:has-text("Google로 로그인")',
    'button:has-text("Google")',
    '[data-testid="google-login"]',
    'button[aria-label*="Google"]',
  ],
  loginButton: [
    'button:has-text("로그인")',
    '[data-testid="login-button"]',
    'button[aria-label*="로그인"]',
    'a:has-text("로그인")',
  ],
};

export interface AiToggleOptions {
  buttonSelectors?: string[];
  sidebarSelectors?: string[];
  waitForSidebar?: boolean;
  waitTimeout?: number;
}

const DEFAULT_AI_BUTTON_SELECTORS = [
  'button:has-text("AI 어시스턴트 열기")',
  'button:has-text("AI 어시스턴트")',
  '[data-testid="ai-assistant"]',
  '[data-testid="ai-sidebar-trigger"]',
  'button[aria-label*="AI"]',
  'button[title*="AI"]',
];

const DEFAULT_AI_SIDEBAR_SELECTORS = [
  'dialog:has-text("AI 어시스턴트")',
  '[role="dialog"]:has-text("AI")',
  '[data-testid="ai-sidebar"]',
  '.ai-sidebar',
  '.ai-panel',
];

/**
 * 게스트 세션 관련 상태(localStorage/cookies)를 정리합니다.
 */
export async function resetGuestState(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  await context.clearPermissions().catch(() => undefined);

  const isRetryableContextError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /Execution context was destroyed|Cannot find context with specified id|Target closed/i.test(
      error.message
    );
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto('about:blank', {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.DOM_UPDATE,
      });

      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // noop
        }
      });
      return;
    } catch (error) {
      if (!isRetryableContextError(error) || attempt === 2) {
        return;
      }
      await page.waitForTimeout(150);
    }
  }
}

/**
 * 로그인 페이지로 이동합니다.
 * 메인 페이지에서 로그인 버튼을 클릭하거나 직접 /login으로 이동합니다.
 */
export async function navigateToLoginPage(
  page: Page,
  options: { direct?: boolean } = {}
): Promise<void> {
  const { direct = false } = options;

  await ensureVercelBypassCookie(page);

  if (direct) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  } else {
    // 메인 페이지에서 로그인 버튼 클릭
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 로그인 버튼 찾기
    let loginButton: Locator | null = null;
    for (const selector of LOGIN_BUTTON_SELECTORS.loginButton) {
      const candidate = page.locator(selector).first();
      const isVisible = await candidate
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isVisible) {
        loginButton = candidate;
        break;
      }
    }

    if (!loginButton) {
      // 로그인 버튼이 없으면 이미 로그인 페이지이거나 직접 이동
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      return;
    }

    await loginButton.click();
    await page.waitForURL('**/login**', { timeout: TIMEOUTS.NETWORK_REQUEST });
  }

  await page.waitForLoadState('domcontentloaded');
}

/**
 * 특정 로그인 버튼을 찾아서 클릭합니다.
 */
async function clickLoginButton(
  page: Page,
  provider: LoginProvider
): Promise<void> {
  const selectors = LOGIN_BUTTON_SELECTORS[provider];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    try {
      await button.waitFor({
        state: 'visible',
        timeout: TIMEOUTS.MODAL_DISPLAY,
      });
      await button.click();
      return;
    } catch {
      // 다음 셀렉터 시도
    }
  }

  throw new Error(
    `${provider} 로그인 버튼을 찾을 수 없습니다.\n` +
      `페이지: ${page.url()}\n` +
      `시도한 셀렉터: ${selectors.join(', ')}`
  );
}

/**
 * 게스트 로그인 버튼을 클릭해 메인 페이지(/)로 이동합니다.
 * 2024-12: 새로운 로그인 흐름 지원 (메인 → 로그인 페이지 → 게스트 모드)
 */
export async function guestLogin(
  page: Page,
  options: GuestLoginOptions = {}
): Promise<void> {
  const {
    waitForPath = '/',
    skipLandingNavigation = false,
    navigateToLoginPage: goToLoginPage = true,
  } = options;

  await ensureVercelBypassCookie(page);

  if (!skipLandingNavigation) {
    if (goToLoginPage) {
      // 새로운 흐름: 로그인 페이지로 이동 후 게스트 버튼 클릭
      await navigateToLoginPage(page, { direct: true });
    } else {
      // 레거시 흐름: 메인 페이지에서 직접 게스트 버튼 찾기
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }
  }

  // 게스트 로그인 버튼 클릭
  await clickLoginButton(page, 'guest');

  // NOTE:
  // waitForPath 기본값 '/'는 '/login'도 매치되어 조기 통과될 수 있으므로,
  // 먼저 "로그인/콜백 단계 이탈"을 확정한 뒤 선택적으로 목표 경로를 확인한다.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith('/login') && !url.pathname.startsWith('/auth'),
    {
      timeout: TIMEOUTS.NETWORK_REQUEST,
    }
  );

  if (waitForPath !== '/') {
    await page.waitForURL(`**${waitForPath}**`, {
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });
  }

  await page
    .waitForFunction(
      () =>
        document.cookie.includes('auth_type=guest') ||
        localStorage.getItem('auth_type') === 'guest',
      null,
      { timeout: TIMEOUTS.NETWORK_REQUEST }
    )
    .catch(() => undefined);

  await page.waitForLoadState('domcontentloaded', {
    timeout: TIMEOUTS.NETWORK_REQUEST,
  });
}

/**
 * OAuth 로그인 테스트용 - 로그인 버튼 클릭까지만 수행
 * 실제 OAuth 인증은 외부 서비스이므로 버튼 클릭 여부만 확인
 */
export async function clickOAuthLoginButton(
  page: Page,
  provider: 'github' | 'google'
): Promise<void> {
  await ensureVercelBypassCookie(page);
  await navigateToLoginPage(page, { direct: true });
  await clickLoginButton(page, provider);
}

/**
 * 로그인 페이지에서 모든 로그인 옵션이 표시되는지 확인
 */
export async function verifyLoginOptions(page: Page): Promise<{
  guest: boolean;
  github: boolean;
  google: boolean;
}> {
  await ensureVercelBypassCookie(page);
  await navigateToLoginPage(page, { direct: true });

  const result = { guest: false, github: false, google: false };

  for (const provider of ['guest', 'github', 'google'] as const) {
    for (const selector of LOGIN_BUTTON_SELECTORS[provider]) {
      const button = page.locator(selector).first();
      const isVisible = await button
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isVisible) {
        result[provider] = true;
        break;
      }
    }
  }

  return result;
}

/**
 * AI 사이드바 토글을 열고 해당 locator를 반환합니다.
 * 이미 열려있는 경우 버튼을 클릭하지 않습니다.
 */
export async function openAiSidebar(
  page: Page,
  options: AiToggleOptions = {}
): Promise<Locator> {
  const {
    buttonSelectors = DEFAULT_AI_BUTTON_SELECTORS,
    sidebarSelectors = DEFAULT_AI_SIDEBAR_SELECTORS,
    waitForSidebar = true,
    waitTimeout = TIMEOUTS.DOM_UPDATE,
  } = options;

  // 먼저 사이드바가 이미 열려있는지 확인
  for (const selector of sidebarSelectors) {
    const sidebar = page.locator(selector).first();
    const isVisible = await sidebar
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (isVisible) {
      // 이미 열려있으면 바로 반환
      return sidebar;
    }
  }

  // 사이드바가 닫혀있으면 버튼을 찾아서 클릭
  let trigger: Locator | null = null;
  const attemptedButtonSelectors: string[] = [];

  for (const selector of buttonSelectors) {
    attemptedButtonSelectors.push(selector);
    const candidate = page.locator(selector).first();
    try {
      // waitFor를 사용하여 실제로 버튼이 나타날 때까지 기다림
      await candidate.waitFor({
        state: 'visible',
        timeout: TIMEOUTS.DOM_UPDATE,
      });
      trigger = candidate;
      break;
    } catch {}
  }

  if (!trigger) {
    throw new Error(
      `AI 토글 버튼을 찾을 수 없습니다.\n` +
        `페이지: ${page.url()}\n` +
        `시도한 셀렉터: ${attemptedButtonSelectors.join(', ')}`
    );
  }

  await trigger.click();

  if (!waitForSidebar) {
    return trigger;
  }

  const attemptedSidebarSelectors: string[] = [];

  for (const selector of sidebarSelectors) {
    attemptedSidebarSelectors.push(selector);
    const sidebar = page.locator(selector).first();
    try {
      await sidebar.waitFor({ state: 'visible', timeout: waitTimeout });
      return sidebar;
    } catch {
      // 다음 셀렉터 시도
    }
  }

  throw new Error(
    `AI 사이드바가 나타나지 않았습니다.\n` +
      `페이지: ${page.url()}\n` +
      `시도한 셀렉터: ${attemptedSidebarSelectors.join(', ')}`
  );
}
