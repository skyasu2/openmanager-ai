# E2E Test Helpers 사용 가이드

## 📚 개요

E2E 테스트를 위한 헬퍼 파일들의 목적과 사용법을 안내합니다.

> ⚠️ **v5.80.0 업데이트 안내**: 관리자 모드 및 `/admin` 페이지가 완전히 제거되었습니다.
> `admin.ts` 헬퍼 파일은 폐기되었으며, 관리자 관련 테스트 함수들은 더 이상 사용되지 않습니다.
> 현재 사용 가능한 인증 방식: **게스트 로그인** (`guest.ts`) 또는 **GitHub OAuth**

---

## 🗂️ 헬퍼 파일 목록

### 1. **config.ts** - 환경 설정 중앙 관리

**목적**: 테스트 환경별 URL 및 환경 감지

**주요 함수**:

- `getTestBaseUrl()` - 테스트 베이스 URL 반환
- `isVercelProduction(url?)` - Vercel 프로덕션 환경 여부
- `isLocalEnvironment(url?)` - 로컬 환경 여부

**사용 예시**:

```typescript
import { getTestBaseUrl } from './helpers/config';

const baseUrl = getTestBaseUrl();
await page.goto(baseUrl + '/dashboard');
```

---

### 2. **timeouts.ts** - 타임아웃 상수 중앙 관리

**목적**: 테스트 타임아웃 값을 의미있는 이름으로 통일

**주요 상수**:

- `TIMEOUTS.API_RESPONSE` - 5초 (빠른 API 응답)
- `TIMEOUTS.MODAL_DISPLAY` - 10초 (모달/컴포넌트 표시)
- `TIMEOUTS.FORM_SUBMIT` - 15초 (폼 제출)
- `TIMEOUTS.NETWORK_REQUEST` - 30초 (네트워크 요청)
- `TIMEOUTS.E2E_TEST` - 60초 (전체 E2E 테스트)

**사용 예시**:

```typescript
import { TIMEOUTS } from './helpers/timeouts';

await page.waitForURL('**/login', { timeout: TIMEOUTS.API_RESPONSE });
await expect(button).toBeVisible({ timeout: TIMEOUTS.MODAL_DISPLAY });
```

---

### 3. **guest.ts** - 게스트 인증 헬퍼 (권장)

**목적**: 게스트 로그인 및 기본 테스트 플로우 지원

**핵심 특징**:

- ✅ **게스트 로그인**: 세션 기반 게스트 인증
- ✅ **AI 사이드바 열기**: `openAiSidebar()` 함수
- ✅ **시스템 시작**: 데모 데이터 로딩 플로우

**주요 함수**:

```typescript
import { guestLogin, openAiSidebar } from './helpers/guest';

// 게스트 로그인
await guestLogin(page, { landingPath: '/' });

// 대시보드 대기
await page.waitForURL('**/dashboard', { timeout: 40000 });

// AI 사이드바 열기
await openAiSidebar(page);
```

**예시 테스트**:

```typescript
import { guestLogin, openAiSidebar } from './helpers/guest';

test('게스트 로그인 후 AI 사이드바 사용', async ({ page }) => {
  await guestLogin(page, { landingPath: '/' });
  await page.waitForURL('**/dashboard');

  await openAiSidebar(page);
  expect(page.locator('[data-testid="ai-sidebar"]')).toBeVisible();
});
```

---

### 4. ~~**admin.ts**~~ - ❌ 폐기됨 (v5.80.0)

> ⚠️ **폐기됨**: 관리자 모드가 v5.80.0에서 완전히 제거되어 이 헬퍼 파일은 삭제되었습니다.
> 게스트 로그인은 `guest.ts` 헬퍼를 사용하세요.

**대체 방법**:

```typescript
// ❌ 기존 (폐기됨)
// import { activateAdminMode } from './helpers/admin';

// ✅ 현재
import { guestLogin } from './helpers/guest';

test('기본 테스트', async ({ page }) => {
  await guestLogin(page, { landingPath: '/' });
  await page.waitForURL('**/dashboard');
});
```

---

### 5. **vercel-test-auth.ts** - AI 자동화 편의성 극대화

**목적**: AI 에이전트가 원-콜로 테스트 모드 활성화

**핵심 특징**:

- ✅ **원-콜 솔루션**: `enableVercelTestMode()` 한 번으로 모든 설정
- ✅ **자동 네비게이션**: `aiNavigate()` - 자동 테스트 모드 + 페이지 이동
- ✅ **헤더 자동 주입**: 모든 요청에 테스트 헤더 자동 추가
- ✅ **AI 친화적**: 최소한의 코드로 최대 효과

**주요 함수**:

```typescript
// 🤖 AI가 가장 쉽게 사용하는 방법

// 1. 한 번에 모든 설정
await enableVercelTestMode(page);

// 2. 자동 네비게이션 (테스트 모드 자동 체크)
await aiNavigate(page, '/dashboard');
await aiNavigate(page, '/mcp-chat');

// 3. 상태 확인
const status = await getVercelTestStatus(page);

// 4. 정리
await cleanupVercelTestMode(page);
```

**사용 대상**:

- AI 자동화 (Playwright AI, Claude Code)
- 빠른 프로토타입 테스트
- 복잡한 설정 없이 즉시 시작

**예시 테스트**:

```typescript
import { enableVercelTestMode, aiNavigate } from './helpers/vercel-test-auth';

test('AI 친화적 대시보드 접근', async ({ page }) => {
  // 한 줄로 완료
  await enableVercelTestMode(page);

  // 자동 네비게이션
  await aiNavigate(page, '/dashboard');
  await aiNavigate(page, '/mcp-chat');
});
```

---

## 🎯 **선택 가이드**

### **언제 `guest.ts`를 사용하나요?**

- ✅ 게스트 로그인 테스트
- ✅ 대시보드 접근 테스트
- ✅ 기본 E2E 테스트 (권장)

**예시 시나리오**:

- 게스트 모드 로그인 플로우 검증
- 대시보드 UI 컴포넌트 테스트
- AI 사이드바 기본 동작 테스트

---

### **언제 `vercel-test-auth.ts`를 사용하나요?**

- ✅ AI 자동화 테스트
- ✅ 빠른 프로토타입 테스트
- ✅ 복잡한 설정 없이 즉시 시작
- ✅ 여러 페이지를 빠르게 이동하는 테스트

**예시 시나리오**:

- AI가 자동으로 생성하는 테스트
- 빠른 스모크 테스트
- 프로덕션 접근이 필요한 E2E 테스트

---

## 📊 **비교표**

| 항목                | guest.ts            | vercel-test-auth.ts |
| ------------------- | ------------------- | ------------------- |
| **철학**            | 게스트 인증 표준화  | AI 편의성 극대화    |
| **주요 함수**       | `guestLogin()`      | `aiNavigate()`      |
| **호출 횟수**       | 1회                 | 1-2회 (원-콜)       |
| **자동 네비게이션** | ❌ 수동             | ✅ `aiNavigate()`   |
| **헤더 자동 주입**  | ❌ 없음             | ✅ 자동             |
| **사용 난이도**     | 초급                | 초급                |
| **AI 친화적**       | 보통                | ✅ 최적화됨         |

---

## 🔄 **마이그레이션 가이드**

### 레거시 `admin.ts` → 현재 `guest.ts`

> ⚠️ v5.80.0에서 관리자 모드가 완전히 제거되었습니다.

**기존 코드** (❌ 더 이상 작동 안함):

```typescript
// ❌ 폐기된 코드
await ensureGuestLogin(page);
await activateAdminMode(page, { method: 'bypass' });
await navigateToAdminDashboard(page, false);
```

**새 코드** (✅ 현재 권장):

```typescript
import { guestLogin, openAiSidebar } from './helpers/guest';

await guestLogin(page, { landingPath: '/' });
await page.waitForURL('**/dashboard');
await openAiSidebar(page); // AI 기능 접근
```

---

## 🚀 **Best Practices**

1. **테스트 시작 패턴**:

   ```typescript
   // 게스트 로그인 (권장)
   import { guestLogin } from './helpers/guest';
   await guestLogin(page, { landingPath: '/' });

   // AI 자동화
   import { enableVercelTestMode, aiNavigate } from './helpers/vercel-test-auth';
   await enableVercelTestMode(page);
   await aiNavigate(page, '/dashboard');
   ```

2. **AI 사이드바 테스트**:

   ```typescript
   import { openAiSidebar } from './helpers/guest';
   import { submitAiMessage } from './helpers/ai-interaction';

   await openAiSidebar(page);
   const response = await submitAiMessage(page, '서버 상태를 알려줘');
   expect(response.responseText).toBeTruthy();
   ```

3. **정리 패턴**:
   ```typescript
   test.afterEach(async ({ page }) => {
     await cleanupVercelTestMode(page);
   });
   ```

---

## 📚 **추가 참고 자료**

- **E2E 테스트 전략**: `/docs/claude/testing/vercel-first-strategy.md`
- **CLAUDE.md 프로젝트 가이드**: `/CLAUDE.md`
- **Playwright 공식 문서**: https://playwright.dev/

---

## 6. **ai-interaction.ts** - AI 사이드바 인터랙션 헬퍼

**목적**: AI 사이드바 테스트의 공통 동작을 재사용 가능한 함수로 추상화

**핵심 특징**:

- ✅ **MCP 통합**: Playwright MCP 로깅 지원
- ✅ **SSE 스트리밍 감지**: AI 응답 완료 자동 감지
- ✅ **응답 시간 측정**: 성능 메트릭 자동 수집
- ✅ **다중 닫기 방법**: ESC 키, 버튼, 오버레이 클릭

**주요 함수**:

```typescript
// AI 메시지 제출 및 응답 대기
const response = await submitAiMessage(page, '서버 상태를 알려주세요', {
  waitForResponse: true, // AI 응답 대기 (기본값: true)
  responseTimeout: 60000, // 응답 대기 timeout (기본값: 120초)
  detectStreamingEnd: true, // SSE 스트리밍 완료 감지 (기본값: true)
  enableMcpLogging: true, // MCP 콘솔 로깅 활성화 (기본값: true)
});

// 반환 타입
interface AiMessageResponse {
  responseText: string; // AI 응답 텍스트
  responseTime: number; // 응답 시간 (ms)
  sseEventCount?: number; // SSE 이벤트 수
  consoleLogs?: string[]; // MCP 콘솔 로그
}

// AI 기능 전환
await switchAiFunction(page, 'intelligent-monitoring', {
  waitForUiUpdate: true, // UI 업데이트 대기 (기본값: true)
  uiUpdateTimeout: 3000, // UI 업데이트 대기 timeout (기본값: 3초)
});

// 사이드바 닫기 (3가지 방법)
await closeAiSidebar(page, { method: 'esc' }); // ESC 키
await closeAiSidebar(page, { method: 'button' }); // 닫기 버튼
await closeAiSidebar(page, { method: 'overlay' }); // 오버레이 클릭
```

**사용 예시**:

```typescript
import {
  submitAiMessage,
  switchAiFunction,
  closeAiSidebar,
} from './helpers/ai-interaction';
import { guestLogin, openAiSidebar } from './helpers/guest';

test('AI 사이드바 기본 플로우', async ({ page }) => {
  await guestLogin(page);
  await page.locator('button:has-text("🚀 시스템 시작")').click();
  await page.waitForURL('**/dashboard', { timeout: 40000 });

  await openAiSidebar(page);

  const response = await submitAiMessage(page, '안녕하세요', {
    waitForResponse: true,
    enableMcpLogging: true,
  });

  expect(response.responseText).toBeTruthy();

  await closeAiSidebar(page, { method: 'esc' });
});
```

---

## 7. **network-monitor.ts** - 네트워크 모니터링 & SSE 헬퍼

**목적**: Playwright MCP 통합을 통한 네트워크 활동 모니터링

**핵심 특징**:

- ✅ **SSE 스트리밍 모니터링**: EventSource 및 Fetch API 추적
- ✅ **네트워크 요청 캡처**: URL 패턴 및 메서드 필터링
- ✅ **스냅샷 비교**: pixelmatch를 사용한 픽셀 단위 비교
- ✅ **MCP 통합**: Playwright MCP browser_snapshot 활용

**주요 함수**:

```typescript
// SSE 스트리밍 모니터링
const events = await monitorSSEStream(page, '/api/ai/supervisor', {
  timeout: 60000, // 모니터링 최대 시간 (기본값: 120초)
  doneMarker: '[DONE]', // 스트리밍 완료 감지 문자열 (기본값: '[DONE]')
  eventFilter: (event) => event.type === 'data', // 이벤트 필터 (optional)
});

// 반환 타입
interface SSEEvent {
  type: string; // 이벤트 타입 ('message', 'data', 'error')
  data: string; // 이벤트 데이터
  timestamp: number; // 타임스탬프 (ms)
  id?: string; // 이벤트 ID (optional)
}

// 네트워크 요청 캡처
const { requests, responses } = await captureNetworkRequests(
  page,
  async () => {
    await page.click('button[type="submit"]');
  },
  {
    urlPattern: /\/api\/ai\//, // URL 필터 패턴
    methods: ['GET', 'POST'], // 캡처할 메서드
    includeResponseBody: true, // 응답 바디 포함
  }
);

// 스냅샷 비교 (pixelmatch 사용)
const diff = await compareSnapshots(page, 'ai-sidebar-open', {
  threshold: 0.05, // 픽셀 차이 임계값 (기본값: 0.1 = 10%)
  snapshotPath: 'tests/e2e/screenshots', // 스냅샷 저장 경로
  fullPage: true, // 전체 페이지 스냅샷
});

// 반환 타입
interface SnapshotComparison {
  diffPercentage: number; // 픽셀 차이율 (0-1)
  passed: boolean; // 비교 통과 여부
  diffImagePath?: string; // 차이 이미지 경로 (optional)
}
```

**사용 예시**:

```typescript
import {
  monitorSSEStream,
  captureNetworkRequests,
  compareSnapshots,
} from './helpers/network-monitor';

test('SSE 스트리밍 및 네트워크 모니터링', async ({ page }) => {
  // SSE 모니터링
  const events = await monitorSSEStream(page, '/api/ai/supervisor', {
    timeout: 30000,
    doneMarker: '[DONE]',
  });

  expect(events.length).toBeGreaterThan(0);

  // 네트워크 요청 캡처
  const { requests, responses } = await captureNetworkRequests(
    page,
    async () => {
      await page.click('button[type="submit"]');
    },
    { urlPattern: /\/api\/ai\/query/ }
  );

  expect(requests.length).toBeGreaterThan(0);
  expect(responses.every((r) => r.status === 200)).toBe(true);

  // 스냅샷 비교
  const diff = await compareSnapshots(page, 'ai-sidebar', { threshold: 0.05 });
  expect(diff.passed).toBe(true);
});
```

---

## 🧪 **샘플 테스트 파일 (로컬 전용)**

**파일**: `tests/e2e/helpers/ai-interaction.sample.spec.ts`

**목적**: 헬퍼 함수의 실제 동작 확인 (Vercel 부하 방지)

**특징**:

- ✅ **로컬 전용**: `*.sample.spec.ts` 네이밍으로 CI/CD 제외
- ✅ **6개 테스트**: submitAiMessage, switchAiFunction, closeAiSidebar 전체 검증
- ✅ **MCP 로깅**: 콘솔 로그 수집 및 검증
- ✅ **Vercel 부하 = 0**: localhost:3000만 사용

**실행 방법**:

```bash
# 1. 로컬 개발 서버 시작
npm run dev

# 2. 샘플 테스트 실행 (1회만)
npx playwright test tests/e2e/helpers/ai-interaction.sample.spec.ts --headed
```

**⚠️ 주의사항**:

- CI/CD에서 자동 실행되지 않음 (의도적)
- Vercel 프로덕션 URL 사용 금지
- 필요 시 수동으로 1회만 실행

---

## 🚀 **Vercel E2E 검증 테스트**

**파일**: `tests/e2e/ai-sidebar-vercel-validation.spec.ts`

**목적**: Vercel 프로덕션 환경에서 AI 사이드바 핵심 기능 검증 (하루 2-3회 수동 실행 권장)

**특징**:

- ✅ **Vercel 프로덕션 전용**: 실제 배포 환경 검증
- ✅ **6개 핵심 테스트**: 응답, MCP 로깅, SSE 스트리밍, 기능 전환, 사이드바 닫기, 전체 플로우
- ✅ **최소 Vercel 요청**: 총 6-8회 (매우 적음)
- ✅ **헬퍼 함수 활용**: ai-interaction.ts, network-monitor.ts 재사용

**실행 방법**:

```bash
# Vercel 프로덕션 환경에서 검증 (하루 2-3회 권장)
npx playwright test tests/e2e/ai-sidebar-vercel-validation.spec.ts --project=chromium
```

**테스트 시나리오**:

1. **기본 AI 응답 검증** - 응답 시간 측정
2. **MCP 로깅 검증** - 콘솔 로그 수집 확인
3. **SSE 스트리밍 검증** - 실시간 스트리밍 동작 확인
4. **AI 기능 전환 검증** - intelligent-monitoring 전환 테스트
5. **사이드바 닫기 검증** - ESC 키 동작 확인
6. **전체 플로우 검증** - 열기 → 질문 → 응답 → 닫기

**Vercel 부하 분석**:

- 테스트 수: 6개
- AI 쿼리: 6개 (각 1개)
- 예상 요청: 총 6-8회
- 실행 시간: ~3-5분
- **권장 빈도**: 하루 2-3회 수동 실행

**⚠️ 주의사항**:

- Vercel 무료 티어 고려하여 하루 2-3회 이상 실행 금지
- 실행 전 최근 배포 확인 권장
- 테스트 실패 시 로컬 환경에서 샘플 테스트로 재현 권장

---

**마지막 업데이트**: 2025-12-20 (v5.83.7 - 관리자 모드 폐기 반영)
**작성자**: OpenManager AI Team
