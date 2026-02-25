import { expect, test } from '@playwright/test';
import { guestLogin, resetGuestState } from './helpers/guest';
import { ensureVercelBypassCookie } from './helpers/security';
import { TIMEOUTS } from './helpers/timeouts';

test.describe('♿ 접근성 (Accessibility) 검증', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
    await ensureVercelBypassCookie(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('키보드 네비게이션 테스트', async ({ page }) => {
    await page.goto('/');

    const focusableElements = [];
    await page.keyboard.press('Tab');

    for (let i = 0; i < 10; i++) {
      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused
          ? {
              tagName: focused.tagName,
              role: focused.getAttribute('role'),
              ariaLabel: focused.getAttribute('aria-label'),
              textContent: focused.textContent?.substring(0, 50),
            }
          : null;
      });

      if (focusedElement) {
        focusableElements.push(focusedElement);
        console.log(
          `Tab ${i + 1}: ${focusedElement.tagName} - ${focusedElement.textContent || focusedElement.ariaLabel || 'No text'}`
        );
      }

      await page.keyboard.press('Tab');
    }

    expect(focusableElements.length).toBeGreaterThan(3);
    console.log('✅ 키보드 네비게이션 테스트 완료');
  });

  test('ARIA 라벨 및 역할 검증', async ({ page }) => {
    await guestLogin(page);

    const profileButton = page
      .locator('button[aria-label="프로필 메뉴"]')
      .first();
    await expect(profileButton).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });

    const ariaSummary = await page.evaluate(() => {
      const roleElements = Array.from(document.querySelectorAll('[role]'));
      const labelElements = Array.from(
        document.querySelectorAll('[aria-label], [aria-labelledby]')
      );
      return {
        roleCount: roleElements.length,
        labelCount: labelElements.length,
        preview: roleElements.slice(0, 12).map((el) => ({
          tagName: el.tagName,
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          textContent: el.textContent?.substring(0, 30),
        })),
      };
    });

    console.log('📊 ARIA 접근성 요소 분석:');
    ariaSummary.preview.forEach((el, index) => {
      console.log(
        `   ${index + 1}. ${el.tagName}: role="${el.role}", label="${el.ariaLabel}"`
      );
    });
    console.log(
      `📌 role=${ariaSummary.roleCount}, aria-label/labelledby=${ariaSummary.labelCount}`
    );

    // 모바일/데스크탑 렌더링 차이를 허용하되 핵심 접근성 요소는 유지한다.
    expect(ariaSummary.roleCount).toBeGreaterThan(0);
    expect(ariaSummary.labelCount).toBeGreaterThan(0);
    expect(
      ariaSummary.roleCount + ariaSummary.labelCount
    ).toBeGreaterThanOrEqual(4);
    console.log('✅ ARIA 접근성 검증 완료');
  });

  test('색상 대비 검증 (간이)', async ({ page }) => {
    await guestLogin(page);

    const contrastResults = await page.evaluate(() => {
      const textElements = Array.from(
        document.querySelectorAll('p, span, div, button, a')
      ).slice(0, 20);

      return textElements
        .map((el) => {
          const styles = window.getComputedStyle(el);
          return {
            text: el.textContent?.substring(0, 30),
            color: styles.color,
            backgroundColor: styles.backgroundColor,
          };
        })
        .filter((item) => item.text && item.text.trim().length > 0);
    });

    console.log('📊 색상 대비 분석 (처음 10개):');
    contrastResults.slice(0, 10).forEach((item, index) => {
      console.log(
        `   ${index + 1}. "${item.text}" - 색상: ${item.color}, 배경: ${item.backgroundColor}`
      );
    });

    expect(contrastResults.length).toBeGreaterThan(0);
    console.log('✅ 색상 대비 검증 완료 (수동 확인 필요)');
  });

  test('스크린 리더 호환성 (로그인 페이지 헤딩 구조)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('heading', { level: 1 })
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK_REQUEST });

    const headings = await page.evaluate(() => {
      const headingElements = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      );
      return headingElements.map((el) => ({
        level: el.tagName,
        text: el.textContent?.trim(),
      }));
    });

    console.log('📊 로그인 페이지 헤딩 구조:');
    headings.forEach((heading, index) => {
      console.log(`   ${index + 1}. ${heading.level}: "${heading.text}"`);
    });

    expect(headings.length).toBeGreaterThan(0);
    console.log('✅ 로그인 페이지 헤딩 검증 완료');
  });

  test('스크린 리더 호환성 (대시보드 헤딩 및 랜드마크)', async ({ page }) => {
    await guestLogin(page);

    const profileButton = page
      .locator('button[aria-label="프로필 메뉴"]')
      .first();
    await expect(profileButton).toBeVisible({
      timeout: TIMEOUTS.DASHBOARD_LOAD,
    });

    const headings = await page.evaluate(() => {
      const headingElements = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      );
      return headingElements.map((el) => ({
        level: el.tagName,
        text: el.textContent?.trim(),
      }));
    });

    console.log('📊 대시보드 헤딩 구조:');
    headings.forEach((heading, index) => {
      console.log(`   ${index + 1}. ${heading.level}: "${heading.text}"`);
    });

    expect(headings.length).toBeGreaterThan(0);

    const landmarks = await page.evaluate(() => {
      const landmarkRoles = ['banner', 'navigation', 'main', 'contentinfo'];
      return landmarkRoles.map((role) => ({
        role,
        count:
          document.querySelectorAll(`[role="${role}"]`).length +
          (role === 'banner' ? document.querySelectorAll('header').length : 0) +
          (role === 'navigation'
            ? document.querySelectorAll('nav').length
            : 0) +
          (role === 'main' ? document.querySelectorAll('main').length : 0) +
          (role === 'contentinfo'
            ? document.querySelectorAll('footer').length
            : 0),
      }));
    });

    console.log('📊 대시보드 랜드마크:');
    landmarks.forEach((lm) => {
      console.log(`   ${lm.role}: ${lm.count}개`);
    });

    const totalLandmarks = landmarks.reduce((sum, lm) => sum + lm.count, 0);
    expect(totalLandmarks).toBeGreaterThan(0);

    const mainLandmark = landmarks.find((lm) => lm.role === 'main');
    if (!mainLandmark?.count) {
      console.log('⚠️ 대시보드에 <main> 랜드마크가 없습니다 — 접근성 개선 권장');
    }

    console.log('✅ 대시보드 헤딩 및 랜드마크 검증 완료');
  });
});
