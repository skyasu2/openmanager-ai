# OpenManager AI E2E 테스트 가이드

> Playwright 기반 End-to-End 테스트 범위와 실행/운영 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/guides/testing/e2e-testing-guide.md
> Tags: testing,e2e,playwright,cicd
>
> **Updated**: 2026-01-18

**목차**: [개요](#-개요) | [테스트 범위](#-테스트-범위) | [실행 방법](#-테스트-실행-방법) | [결과 분석](#-테스트-결과-분석) | [설정](#-테스트-설정) | [환경별 전략](#-환경별-테스트-전략) | [디버깅](#-디버깅-가이드) | [CI/CD](#-cicd-통합)

---

## 📋 개요

OpenManager AI 프론트엔드의 종합적인 End-to-End 테스트 시스템입니다. 사용자 플로우부터 AI 어시스턴트 기능까지 전체 애플리케이션의 품질을 보장합니다.

> ⚠️ **2025-11 업데이트**  
> v5.80.0에서 관리자 모드 및 /admin 페이지가 완전히 제거되었습니다.  
> 관리자 전용 E2E 시나리오(예: `admin-mode-improved.spec.ts`, `ai-assistant-advanced-test.spec.ts`, `vercel-guest-admin-full-check.spec.ts`)는 더 이상 실행되지 않으며 Playwright 파일 상단에서 자동으로 `skip` 처리됩니다.  
> 새로운 대시보드/게스트 중심 플로우가 정의되기 전까지는 `npm run test:e2e:*` 명령이 관리자 기능을 검증하지 않습니다.

## 🎯 테스트 범위

### 1. 🔐 사용자 인증 플로우

- **게스트 체험하기**: 메인 페이지 → "게스트로 체험하기" 버튼 클릭 → 대시보드 접근
- ~~**관리자 인증**: 프로필 메뉴 → 관리자 모드 → PIN 인증 (4231)~~ → v5.80.0 이후 제거
- **세션 관리**: 페이지 새로고침, 브라우저 탭 전환 후 상태 유지

### 2. 📊 대시보드 모니터링 기능

- **서버 카드 상호작용**: 클릭, 모달 열기, 상세 정보 확인
- **실시간 메트릭**: CPU, 메모리, 디스크 사용률 업데이트
- **시스템 상태**: 상태 표시기, 알림, 헬스 체크

### 3. 🤖 AI 어시스턴트 기능

- **사이드바 접근성**: AI 버튼 클릭, 사이드바 열기/닫기
- **쿼리 처리**: 다양한 AI 쿼리 패턴 테스트
- **응답 품질**: 응답 시간, 내용 품질, 에러 처리
- **상태 관리**: 네트워크 오류, 세션 지속성

### 4. ⚡ 성능 및 품질

- **Core Web Vitals**: LCP, CLS, FID 측정
- **리소스 로딩**: JavaScript, CSS, 이미지 최적화
- **메모리 관리**: 메모리 누수 감지, DOM 노드 관리
- **접근성**: 키보드 네비게이션, ARIA 라벨, 색상 대비

### 5. 🖼️ 시각적 회귀

- **스크린샷 비교**: 메인 대시보드, AI 사이드바, 서버 카드
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 뷰
- **다크 모드**: 테마 전환 후 UI 일관성

## 🚀 테스트 실행 방법

### 기본 실행

```bash
# 전체 E2E 테스트 (권장)
npm run test:e2e:comprehensive

# 카테고리별 실행
npm run test:e2e:basic        # 기본 UI/UX 테스트
npm run test:e2e:ai           # AI 어시스턴트 테스트
npm run test:e2e:performance  # 성능 및 시각적 회귀 테스트

# 브라우저별 실행
npm run test:e2e:cross-browser  # Chrome, Firefox, Safari
npm run test:e2e:headed         # 브라우저 창 표시 모드

# CI/CD 환경
npm run test:e2e:ci
```

### 신규 게스트 전용 시나리오

- `tests/e2e/guest-dashboard-flow.spec.ts`: 게스트 로그인 → 시스템 시작 → 대시보드 및 프로필 검증.
  ```bash
  npx playwright test tests/e2e/guest-dashboard-flow.spec.ts --project=chromium
  ```

### 고급 옵션

```bash
# 개발 서버 시작 후 테스트
npm run dev &
sleep 15
npm run test:e2e:basic

# 프로덕션 빌드 테스트
npm run build
npm run start &
sleep 10
npm run test:e2e:performance

# 특정 브라우저만
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## 📊 테스트 결과 분석

### HTML 리포트

```bash
# 테스트 실행 후 자동 생성
open test-results/test-report.html
```

### JSON 리포트

```bash
# CI/CD 통합용
cat test-results/test-report.json
```

### GitHub Actions 리포트

- 자동으로 PR 코멘트에 결과 요약 표시
- 실패 시 Issue 자동 생성
- Step Summary에 상세 결과 링크

## 🔧 테스트 설정

### Playwright 설정 (`playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
```

## 🚀 환경별 테스트 전략

### 🎯 베르셀 프로덕션 환경 테스트의 핵심 가치

| 환경                | URL                   | 성능           | 테스트 가치         | 권장도     |
| ------------------- | --------------------- | -------------- | ------------------- | ---------- |
| **개발 서버**       | localhost:3000        | 24.1s 초기로드 | 개발 중 빠른 피드백 | ⭐⭐⭐     |
| **로컬 프로덕션**   | localhost:3000 (빌드) | 최적화된 빌드  | 배포 전 검증        | ⭐⭐⭐⭐   |
| **베르셀 프로덕션** | vercel.app            | 152ms 응답     | 실제 사용자 환경    | ⭐⭐⭐⭐⭐ |

**✅ 베르셀 환경에서만 발견 가능한 이슈들:**

- **프로덕션 빌드 최적화** 관련 버그
- **CDN 캐싱** 및 Edge 최적화 문제
- **베르셀 환경변수** 적용 오류
- **SSR/SSG** 렌더링 차이점
- **실제 네트워크 지연** 및 응답 시간

### 🧪 베르셀 환경 테스트 추가 시나리오

#### 1. 프로덕션 성능 검증

```typescript
test('베르셀 프로덕션 성능 측정', async ({ page }) => {
  // 베르셀 환경 접속
  await page.goto('https://openmanager-ai.vercel.app');

  // 페이지 로드 시간 측정
  const loadTime = await page.evaluate(() => {
    return performance.timing.loadEventEnd - performance.timing.navigationStart;
  });

  expect(loadTime).toBeLessThan(3000); // 3초 이내
});
```

#### 2. CDN 캐싱 효과 확인

```typescript
test('베르셀 CDN 캐싱 성능', async ({ page }) => {
  // 첫 방문
  const firstLoad = await page.goto('https://openmanager-ai.vercel.app');
  const firstTime = await firstLoad.request().timing();

  // 페이지 새로고침 (캐시 활용)
  await page.reload();
  const secondTime = await page.evaluate(() => performance.now());

  // 캐시 효과로 두 번째 로드가 더 빨라야 함
  console.log(
    `캐시 효과: ${firstTime.responseEnd - firstTime.requestStart}ms → ${secondTime}ms`
  );
});
```

### 환경 변수

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
CI=true  # CI 환경에서만
PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright
```

## 📁 테스트 파일 구조

```
tests/e2e/
├── comprehensive-ui-ux-test.spec.ts      # 🔐 전체 UI/UX 플로우
├── ai-assistant-advanced-test.spec.ts     # 🤖 AI 기능 심화 테스트
├── performance-visual-regression.spec.ts  # ⚡ 성능 및 시각적 회귀
├── guest-dashboard-flow.spec.ts           # 👤 게스트 대시보드 플로우
├── helpers/
│   └── auth.ts                            # 🔧 인증 헬퍼 함수
└── test-runner.ts                         # 🎮 통합 테스트 실행기
```

## 🎭 테스트 시나리오 상세

### 1. 기본 사용자 플로우

```typescript
test('게스트 로그인 → 대시보드 접근', async ({ page }) => {
  // 1. 메인 페이지 접근
  await page.goto('/');

  // 2. 게스트 로그인
  await page.click('button:has-text("게스트로 체험하기")');

  // 3. 대시보드 로딩 확인
  await expect(page.locator('main')).toBeVisible();

  // 4. URL 검증
  await expect(page).toHaveURL(/\/(dashboard)?/);
});
```

### 2. AI 어시스턴트 상호작용

```typescript
test('AI 쿼리 입력 및 응답', async ({ page }) => {
  // 게스트 모드로 대시보드 접근
  await page.goto('/');
  await page.click('button:has-text("게스트로 체험하기")');

  // AI 사이드바 열기
  await page.click('[data-testid="ai-assistant"]');

  // 쿼리 입력
  await page.fill('[data-testid="ai-chat-input"]', '시스템 상태 요약');
  await page.press('[data-testid="ai-chat-input"]', 'Enter');

  // 응답 대기 및 검증
  await expect(page.locator('.ai-response')).toBeVisible();
});
```

### 3. 성능 측정

```typescript
test('Core Web Vitals 측정', async ({ page }) => {
  // Performance API 초기화
  await page.addInitScript(() => {
    window.performanceMetrics = { lcp: 0, cls: 0 };
  });

  // 페이지 로드 및 측정
  await page.goto('/');
  const metrics = await page.evaluate(() => window.performanceMetrics);

  // 성능 기준 검증
  expect(metrics.lcp).toBeLessThan(2500); // 2.5초 이내
  expect(metrics.cls).toBeLessThan(0.1); // 0.1 이하
});
```

## 🔍 디버깅 가이드

### 테스트 실패 시 체크리스트

1. **개발 서버 상태 확인**

   ```bash
   curl -f http://localhost:3000
   ```

2. **브라우저 콘솔 에러 확인**

   ```typescript
   page.on('console', (msg) => console.log(msg.text()));
   ```

3. **스크린샷 촬영**

   ```typescript
   await page.screenshot({ path: 'debug.png', fullPage: true });
   ```

4. **네트워크 요청 모니터링**
   ```typescript
   page.on('response', (response) => {
     if (!response.ok()) {
       console.log(`Failed: ${response.url()} - ${response.status()}`);
     }
   });
   ```

### 일반적인 문제 해결

#### 1. 요소를 찾을 수 없음

```typescript
// 여러 선택자 시도
const selectors = [
  '[data-testid="target"]',
  '.target-class',
  'button:has-text("텍스트")',
];

for (const selector of selectors) {
  const element = page.locator(selector);
  if ((await element.count()) > 0) {
    await element.click();
    break;
  }
}
```

#### 2. 타이밍 이슈

```typescript
// 명시적 대기
await page.waitForSelector('[data-testid="element"]');
await page.waitForLoadState('networkidle');
await page.waitForFunction(() => window.dataLoaded === true);
```

#### 3. 상태 동기화

```typescript
// 상태 확인 후 진행
await expect(async () => {
  const isReady = await page.evaluate(() => window.appReady);
  expect(isReady).toBe(true);
}).toPass({ timeout: 10000 });
```

## 📈 성능 최적화 팁

### 1. 테스트 병렬화

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
});
```

### 2. 브라우저 재사용

```typescript
// 테스트 그룹별 브라우저 컨텍스트 공유
test.describe.configure({ mode: 'serial' });
```

### 3. 선택적 테스트 실행

```bash
# 태그 기반 실행
npx playwright test --grep "@smoke"
npx playwright test --grep "@critical"
```

## 🔄 CI/CD 통합

### GitHub Actions 워크플로우

- **트리거**: Push, PR, 스케줄 (매일 오전 9시)
- **병렬 실행**: 기본, AI, 성능 테스트 분리
- **결과 리포트**: HTML, JSON, GitHub Summary
- **실패 알림**: Issue 자동 생성, Slack 알림

### 품질 게이트

- **성공률**: 90% 이상
- **성능**: LCP 2.5초 이내, CLS 0.1 이하
- **커버리지**: UI 요소 95% 이상 검증

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## 🤝 기여 가이드

### 새로운 테스트 추가

1. 적절한 카테고리 파일에 테스트 케이스 추가
2. `data-testid` 속성을 UI 요소에 추가
3. 헬퍼 함수로 공통 로직 추상화
4. 문서화 및 코멘트 추가

### 테스트 수정

1. 기존 테스트 실패 원인 분석
2. UI 변경에 따른 선택자 업데이트
3. 성능 기준 조정 (필요시)
4. 회귀 테스트 방지를 위한 추가 검증

---

**💡 팁**: 테스트는 사용자 관점에서 작성하고, 구현 세부사항보다는 기능과 가치에 초점을 맞추세요.
