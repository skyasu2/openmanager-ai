/**
 * 서버 카드 관련 공유 헬퍼
 *
 * guest.spec.ts, dashboard-server-cards.spec.ts 등에서 공통으로 사용
 */

import type { Page } from '@playwright/test';
import { TIMEOUTS } from './timeouts';

export const EMPTY_STATE_SELECTORS = [
  'text=표시할 서버가 없습니다.',
  'text=서버 정보 없음',
  'text=등록된 서버가 없습니다.',
];

export const SYSTEM_START_SELECTORS = [
  'button:has-text("🚀 로그인 후 시작")',
  'button:has-text("🚀 시스템 시작")',
  'button:has-text("시스템 시작")',
  '[data-testid="start-system"]',
];

export const getServerCardButtons = (page: Page) =>
  page
    .locator('main')
    .locator('button')
    .filter({ has: page.locator('h2') });

export const hasEmptyServerState = async (page: Page) => {
  for (const selector of EMPTY_STATE_SELECTORS) {
    const isVisible = await page.locator(selector).first().isVisible({
      timeout: TIMEOUTS.NETWORK_REQUEST,
    });
    if (isVisible) return true;
  }
  return false;
};
