import { expect, test } from '@playwright/test';

// Visual Regression Testing (VRT)
// 이 테스트는 Playwright의 내장 기능을 활용한 무료 시각적 회귀 테스트입니다.
// 스크린샷 최초 생성 및 갱신: npm run test:e2e:visual:update
test.describe('Visual Regression Tests', () => {
  test('Landing Page Snapshot', async ({ page }) => {
    // 1. 랜딩 페이지 접속
    await page.goto('/');

    // 2. 폰트/이미지 등 리소스 로드 대기
    await page.waitForLoadState('networkidle');

    // 3. 전체 페이지 스크린샷 찍기 및 비교 (동적 요소 제외 설정 가능)
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // 5% 픽셀 차이 허용 (안티앨리어싱 등 감안)
    });
  });

  test('Login Modal Snapshot', async ({ page }) => {
    // 1. 접속 후 로그인 버튼 클릭
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 네비게이션 바 또는 메인 영역의 '로그인' 버튼 찾기
    const loginButton = page
      .getByRole('button', { name: /(로그인|Login)/i })
      .first();

    if (await loginButton.isVisible()) {
      await loginButton.click();

      // 모달 트랜지션 완료 대기
      await page.waitForTimeout(1000);

      // 화면 전체 스냅샷 (모달이 뜬 상태)
      await expect(page).toHaveScreenshot('login-modal.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });
});
