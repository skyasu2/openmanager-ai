import type { Page } from '@playwright/test';
import { test } from '@playwright/test';
import { getTestBaseUrl, isVercelProduction } from './config';
import { TIMEOUTS } from './timeouts';

// Note: Environment variables loaded via globalSetup

const SECURITY_CHECKPOINT_TITLE = 'Vercel Security Checkpoint';

/**
 * 현재 페이지가 Vercel Security Checkpoint인지 확인합니다.
 */
export async function isSecurityCheckpoint(page: Page): Promise<boolean> {
  try {
    const title = await page.title();
    return title.includes(SECURITY_CHECKPOINT_TITLE);
  } catch {
    return false;
  }
}

/**
 * Vercel Security Checkpoint가 감지되면 테스트를 스킵합니다.
 * @param page Playwright Page 객체
 * @param testName 테스트 이름 (로그용)
 */
export async function skipIfSecurityCheckpoint(
  page: Page,
  testName?: string
): Promise<void> {
  if (await isSecurityCheckpoint(page)) {
    const message = `Vercel Security Checkpoint detected${testName ? ` in ${testName}` : ''}`;
    console.log(`⚠️ ${message} - skipping`);
    test.skip(true, message);
  }
}

/**
 * API 응답이 403 (Security Checkpoint)이면 테스트를 스킵합니다.
 * @param status HTTP 상태 코드
 * @param testName 테스트 이름 (로그용)
 * @returns true면 스킵됨
 */
export function skipIfSecurityBlocked(
  status: number,
  testName?: string
): boolean {
  if (status === 403) {
    const message = `API blocked by Vercel Security Checkpoint${testName ? ` in ${testName}` : ''}`;
    console.log(`⚠️ ${message} - skipping`);
    test.skip(true, message);
    return true;
  }
  return false;
}

/**
 * Vercel Security Checkpoint를 우회하기 위해 bypass 쿠키를 선행 세팅합니다.
 *
 * 일부 테스트가 / 루트 진입 직후 `Failed to verify your browser (Code 21)`
 * 를 만나 버튼을 찾지 못하는 이슈가 반복되어, 실제 페이지 이동 전에
 * vercel_bypass 파라미터를 붙여 한 번 방문합니다.
 */
export async function ensureVercelBypassCookie(page: Page): Promise<void> {
  const baseUrl = getTestBaseUrl();
  if (!isVercelProduction(baseUrl)) {
    return;
  }

  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypassSecret) {
    return; // Skip silently - header-based bypass is primary method
  }

  const bypassUrl = new URL(baseUrl);
  bypassUrl.searchParams.set('vercel_bypass', bypassSecret);

  try {
    await page.goto(bypassUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });
    await page
      .locator('body')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => undefined);
  } catch {
    // Silently continue - header-based bypass in config is the fallback
  }
}

/**
 * Next.js 개발 오버레이 포털을 숨깁니다.
 * Dev 서버에서 E2E 테스트 시 오버레이가 테스트를 방해할 수 있습니다.
 *
 * @see https://stackoverflow.com/questions/79757200
 */
export async function hideNextJsDevOverlay(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      // Next.js 포털 요소 숨기기
      const portal = document.querySelector('nextjs-portal');
      if (portal instanceof HTMLElement) {
        portal.style.display = 'none';
      }

      // Next.js 에러 오버레이 숨기기
      const errorOverlay = document.querySelector(
        '[data-nextjs-dialog-overlay]'
      );
      if (errorOverlay instanceof HTMLElement) {
        errorOverlay.style.display = 'none';
      }

      // Next.js 개발 표시기 숨기기
      const devIndicator = document.querySelector('[data-nextjs-toast]');
      if (devIndicator instanceof HTMLElement) {
        devIndicator.style.display = 'none';
      }
    });
  } catch {
    // 오버레이가 없거나 이미 숨겨진 경우 무시
  }
}

/**
 * 페이지 네비게이션 후 안전하게 Dev 오버레이를 숨깁니다.
 * page.goto() 후에 호출하세요.
 */
export async function safeNavigateAndHideOverlay(
  page: Page,
  url: string,
  options?: { timeout?: number }
): Promise<void> {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: options?.timeout ?? TIMEOUTS.PAGE_LOAD,
  });

  // DOM 안정화 대기 후 오버레이 숨기기
  await page
    .waitForFunction(() => document.readyState !== 'loading', {
      timeout: TIMEOUTS.DOM_UPDATE,
    })
    .catch(() => undefined);
  await hideNextJsDevOverlay(page);
}
