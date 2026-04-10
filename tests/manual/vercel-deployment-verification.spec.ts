import * as path from 'node:path';
import { expect, type Page, type TestInfo, test } from '@playwright/test';

/**
 * Vercel 배포 검증 및 E2E 테스트 실패 분석
 *
 * 목적:
 * 1. Vercel 프로덕션 배포 상태 확인
 * 2. E2E 테스트 실패 케이스 재현
 * 3. 프로덕션 환경 최종 검증
 * 4. 종합 결과 리포트 생성
 */

const VERCEL_URL = 'https://openmanager-ai.vercel.app';

async function saveArtifactScreenshot(
  page: Page,
  testInfo: TestInfo,
  fileName: string
) {
  const screenshotPath = testInfo.outputPath(fileName);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  console.log(
    `📸 스크린샷 저장: ${path.relative(process.cwd(), screenshotPath)}`
  );
}

test.describe('Vercel 배포 검증 및 E2E 테스트 분석', () => {
  test.beforeEach(async ({ page }) => {
    // Vercel Protection Bypass 쿠키 설정
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypassSecret) {
      await page.setExtraHTTPHeaders({
        'x-vercel-protection-bypass': bypassSecret,
      });
    }
  });

  test('1단계: Vercel 배포 확인 및 스크린샷', async ({ page }, testInfo) => {
    console.log('🔍 1단계: Vercel 배포 상태 확인 시작');

    // 1. 페이지 이동
    console.log(`📡 URL 이동: ${VERCEL_URL}`);
    const response = await page.goto(VERCEL_URL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // 2. 응답 상태 확인
    console.log(`✅ HTTP 응답: ${response?.status()}`);
    expect(response?.status()).toBe(200);

    // 3. 페이지 로드 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // 추가 렌더링 대기

    // 4. 핵심 UI 요소 확인
    const dashboardVisible = await page
      .locator('text=/Dashboard|OpenManager/i')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    console.log(`📊 Dashboard UI 표시: ${dashboardVisible ? '✅' : '❌'}`);

    // 5. 페이지 제목 확인
    const title = await page.title();
    console.log(`📄 페이지 제목: "${title}"`);
    expect(title).toBeTruthy();

    // 6. 스크린샷 저장
    await saveArtifactScreenshot(page, testInfo, 'deployment-verification.png');

    // 7. 콘솔 에러 확인
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(`[Console Error] ${msg.text()}`);
      }
    });

    console.log(`✅ 1단계 완료: Vercel 배포 정상 확인`);
  });

  test('2단계: E2E 테스트 실패 케이스 재현 - 게스트 로그인', async ({
    page,
  }, testInfo) => {
    console.log('🔍 2단계: E2E 테스트 실패 케이스 재현 시작');

    // 로그인 페이지 이동
    await page.goto(VERCEL_URL, { waitUntil: 'networkidle' });

    // 게스트 로그인 버튼 찾기
    const guestButton = page
      .locator('button:has-text("게스트로 체험하기")')
      .first();
    const isVisible = await guestButton
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    console.log(`👤 게스트 로그인 버튼 표시: ${isVisible ? '✅' : '❌'}`);

    if (isVisible) {
      // 버튼 클릭
      await guestButton.click();
      await page.waitForTimeout(2000);

      // 대시보드 페이지로 이동 확인
      const currentUrl = page.url();
      console.log(`🌐 현재 URL: ${currentUrl}`);

      // 스크린샷 저장
      await saveArtifactScreenshot(page, testInfo, 'guest-login-result.png');
    } else {
      console.log('⚠️ 게스트 로그인 버튼을 찾을 수 없음');
      await saveArtifactScreenshot(
        page,
        testInfo,
        'guest-login-button-not-found.png'
      );
    }

    console.log(`✅ 2단계 완료: 게스트 로그인 테스트 완료`);
  });

  test('3단계: 프로덕션 환경 최종 검증', async ({ page }, testInfo) => {
    console.log('🔍 3단계: 프로덕션 환경 최종 검증 시작');

    // 1. 페이지 이동
    await page.goto(VERCEL_URL, { waitUntil: 'networkidle' });

    // 2. 게스트 로그인 (있으면)
    const guestButton = page
      .locator('button:has-text("게스트로 체험하기")')
      .first();
    const guestButtonExists = await guestButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (guestButtonExists) {
      await guestButton.click();
      await page.waitForTimeout(3000);
    }

    // 3. 데이터 테이블 확인
    const tableRows = await page
      .locator('table tbody tr')
      .count()
      .catch(() => 0);
    console.log(`📋 데이터 테이블 행 수: ${tableRows}`);

    // 4. API 엔드포인트 호출 테스트
    console.log('🔌 API 엔드포인트 테스트 시작...');

    const apiTests = [
      { endpoint: '/api/servers/all', name: '서버 목록 API' },
      { endpoint: '/api/auth/debug', name: '인증 디버그 API' },
    ];

    for (const api of apiTests) {
      try {
        const apiResponse = await page.evaluate(async (endpoint) => {
          const res = await fetch(endpoint);
          return {
            status: res.status,
            ok: res.ok,
            body: await res.text().catch(() => 'Unable to read body'),
          };
        }, api.endpoint);

        console.log(
          `  ${api.name}: HTTP ${apiResponse.status} ${apiResponse.ok ? '✅' : '❌'}`
        );
      } catch (error) {
        console.log(`  ${api.name}: ❌ 오류 - ${error}`);
      }
    }

    // 5. 네트워크 요청 로그
    const networkRequests: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        networkRequests.push(`[${response.status()}] ${response.url()}`);
      }
    });

    await page.waitForTimeout(2000);
    console.log(`📡 네트워크 요청 (API): ${networkRequests.length}개`);
    for (const req of networkRequests.slice(0, 10)) {
      console.log(`  ${req}`);
    }

    // 6. 최종 스크린샷
    await saveArtifactScreenshot(
      page,
      testInfo,
      'production-final-verification.png'
    );

    console.log(`✅ 3단계 완료: 프로덕션 환경 검증 완료`);
  });

  test('4단계: 접근성 테스트 (ARIA, 키보드 네비게이션)', async ({
    page,
  }, testInfo) => {
    console.log('🔍 4단계: 접근성 테스트 시작');

    await page.goto(VERCEL_URL, { waitUntil: 'networkidle' });

    // ARIA 요소 확인
    const ariaElements = await page.locator('[role]').all();
    console.log(`♿ ARIA 역할 요소: ${ariaElements.length}개`);

    // 키보드 네비게이션 테스트
    console.log('⌨️ 키보드 네비게이션 테스트 (Tab 키 5회)');
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluateHandle(
        () => document.activeElement
      );
      const tagName = await page.evaluate(
        (el) => el?.tagName || 'NONE',
        focusedElement
      );
      console.log(`  Tab ${i}: ${tagName}`);
    }

    await saveArtifactScreenshot(page, testInfo, 'accessibility-test.png');

    console.log(`✅ 4단계 완료: 접근성 테스트 완료`);
  });
});
