# 🤖 AI 사이드바 E2E 테스트 가이드

**OpenManager AI v5.80.0** | 최종 업데이트: 2025-11-28

> 이 문서는 AI 사이드바 기능을 검증하는 E2E 테스트 스위트에 대한 종합 가이드입니다.

---

## 📑 목차

1. [빠른 시작](#-빠른-시작)
2. [테스트 파일 구조](#-테스트-파일-구조)
3. [헬퍼 함수](#-헬퍼-함수)
4. [실행 방법](#-실행-방법)
5. [Vercel 최적화](#-vercel-최적화-전략)
6. [트러블슈팅](#-트러블슈팅)

---

## 🚀 빠른 시작

### 전제 조건

- Node.js v22.21.1+
- Playwright 설치 완료
- Vercel 프로덕션 환경 배포 완료
- `TEST_SECRET_KEY` 환경 변수 설정

### 5분 테스트 실행

```bash
# 1. 환경 변수 확인
echo $TEST_SECRET_KEY

# 2. 빠른 검증 (6개 핵심 테스트, ~2-3분)
npx playwright test tests/e2e/ai-sidebar-vercel-validation.spec.ts --project=chromium

# 3. 종합 검증 (34개 전체 테스트, ~8-10분)
npm run test:ai:all
```

---

## 📂 테스트 파일 구조

### 핵심 검증 테스트 (Phase 1-2)

#### 1. `ai-sidebar-vercel-validation.spec.ts` (Phase 1, 6개 테스트)

**목적**: Vercel 프로덕션 환경에서 AI 사이드바 핵심 기능 검증

**테스트 범위**:

- 자연어 질의 응답 (AI 채팅)
- Extended Thinking 시각화
- Preset 질문 (자동 장애 보고서)
- Tool Calling (서버 메트릭 조회)
- SSE 스트리밍 응답
- GCP ML Engine Fallback

**Vercel 부하**: 6개 AI 쿼리 (중간)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-sidebar-vercel-validation.spec.ts --project=chromium
```

#### 2. `ai-fullscreen.spec.ts` (Phase 1.5, 7개 테스트)

**목적**: AI 어시스턴트 전체 화면 페이지(/dashboard/ai-assistant) 기능 검증

**테스트 범위**:
- 풀스크린 페이지 직접 접근 및 네비게이션
- 사이드바에서 풀스크린 전환
- 기능 탭(Chat, Report, Monitoring, Management) 전환
- New Chat 등 주요 버튼 동작 확인
- System Context 패널 토글

**Vercel 부하**: 낮음
**실행 빈도**: 배포 전/후 필수

```bash
npx playwright test tests/e2e/ai-fullscreen.spec.ts --project=chromium
```

#### 3. `ai-input-validation.spec.ts` (Phase 2, 6개 테스트)

**목적**: AI 사이드바 입력 검증 및 에러 핸들링

**테스트 범위**:

- 빈 입력 방지
- 최대 길이 제한 (2000자)
- 특수문자 처리
- XSS 공격 방어
- 연속 메시지 전송 제한
- 입력 필드 상태 관리

**Vercel 부하**: 0-1개 AI 쿼리 (매우 적음)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-input-validation.spec.ts --project=chromium
```

---

### 기능별 검증 테스트 (Phase 3-5)

#### 4. `ai-functions.spec.ts` (Phase 3, 7개 테스트)

**목적**: AI 기능 전환 및 UI 업데이트 검증

**테스트 범위**:

- 기본 기능 (chat) UI 확인
- 자동장애 보고서 기능 전환
- 이상감지/예측 기능 전환 및 메시지 전송
- AI 고급관리 기능 전환
- 무료 티어 모니터 기능 전환
- 기능 전환 후 chat 복귀
- 전체 플로우 (기능 전환 → 메시지 전송 → 응답 확인)

**AI 기능 타입**:

- `chat`: 자연어 질의
- `auto-report`: 자동장애 보고서
- `intelligent-monitoring`: 이상감지/예측
- `advanced-management`: AI 고급관리
- `free-tier-monitor`: 무료 티어 모니터

**Vercel 부하**: 3-4개 AI 쿼리 (적음)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-functions.spec.ts --project=chromium
```

#### 5. `ai-history-persistence.spec.ts` (Phase 4, 4개 테스트)

**목적**: 채팅 히스토리 메모리 유지 검증

**테스트 범위**:

- 채팅 히스토리 메모리 유지 (사이드바 내부)
- 사이드바 닫기 후 다시 열기 (히스토리 초기화 확인)
- 기능 전환 후 히스토리 유지
- 다중 메시지 전송 후 순서 유지

**참고**: 채팅 히스토리는 React 상태로 관리되며, 사이드바 닫기/열기 시 초기화될 수 있습니다.

**Vercel 부하**: 2-3개 AI 쿼리 (적음)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-history-persistence.spec.ts --project=chromium
```

#### 6. `ai-network-recovery.spec.ts` (Phase 4, 5개 테스트)

**목적**: 네트워크 오류 복구 및 에러 핸들링 검증

**테스트 범위**:

- 오프라인 모드 전환 시 UI 응답
- 온라인 복구 후 메시지 재전송
- 느린 네트워크 환경 시뮬레이션
- API 엔드포인트 실패 시 에러 핸들링
- 재시도 메커니즘 확인 (선택적)

**네트워크 시뮬레이션**:

- `context.setOffline(true/false)`: 오프라인/온라인 전환
- `page.route()`: API 응답 모킹 및 에러 주입
- `setTimeout()`: 네트워크 지연 시뮬레이션

**Vercel 부하**: 0-1개 AI 쿼리 (매우 적음, 네트워크 차단)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-network-recovery.spec.ts --project=chromium
```

#### 7. `ai-accessibility.spec.ts` (Phase 5, 6개 테스트)

**목적**: 웹 접근성 (WCAG 2.1) 준수 검증

**테스트 범위**:

- 키보드로 AI 사이드바 열기 (Tab + Enter)
- ESC 키로 사이드바 닫기
- Tab 키로 AI 기능 버튼 순회
- ARIA 속성 확인 (role, aria-label)
- 포커스 트랩 확인 (사이드바 내부 포커스 유지)
- 색상 대비 및 텍스트 가독성 확인

**접근성 기준**:

- 키보드 내비게이션
- ARIA 속성 (role, aria-label, aria-labelledby)
- 폰트 크기 최소 12px 이상
- 색상 대비 (WCAG 2.1 기준 4.5:1)

**Vercel 부하**: 0개 AI 쿼리 (UI만 검증)
**실행 빈도**: 하루 2-3회 권장

```bash
npx playwright test tests/e2e/ai-accessibility.spec.ts --project=chromium
```

---

## 🛠️ 헬퍼 함수

### 위치: `tests/e2e/helpers/`

#### 1. `ai-interaction.ts`

**AI 사이드바 상호작용 전문 헬퍼**

**주요 함수**:

```typescript
// AI 메시지 전송 및 응답 대기
submitAiMessage(page, message, options?: {
  waitForResponse?: boolean;       // 응답 대기 여부 (기본: true)
  responseTimeout?: number;        // 응답 timeout (ms, 기본: 120000)
  collectConsoleLogs?: boolean;    // 콘솔 로그 수집 (기본: false)
  includeThinking?: boolean;       // Extended Thinking 수집 (기본: false)
})

// AI 기능 전환
switchAiFunction(page, functionId: AIAssistantFunction, options?: {
  waitForUiUpdate?: boolean;       // UI 업데이트 대기 (기본: true)
  verifyActive?: boolean;          // 활성 상태 검증 (기본: true)
})

// AI 사이드바 닫기
closeAiSidebar(page, options?: {
  method?: 'button' | 'esc';       // 닫기 방법 (기본: 'button')
  verifyClose?: boolean;           // 닫힘 검증 (기본: true)
})
```

**사용 예시**:

```typescript
// 기본 메시지 전송 (응답 대기)
const response = await submitAiMessage(page, '서버 상태를 알려주세요', {
  waitForResponse: true,
  responseTimeout: 120000,
});
console.log('응답:', response.responseText);

// Extended Thinking 수집
const thinkingResponse = await submitAiMessage(page, '복잡한 분석 요청', {
  includeThinking: true,
});
console.log('Thinking:', thinkingResponse.thinkingSteps);

// AI 기능 전환
await switchAiFunction(page, 'intelligent-monitoring', {
  waitForUiUpdate: true,
});
```

#### 2. `guest.ts`

**게스트 로그인 및 AI 사이드바 열기**

**주요 함수**:

```typescript
// 게스트 로그인
guestLogin(page: Page): Promise<void>

// AI 사이드바 열기 (중복 클릭 방지)
openAiSidebar(page: Page): Promise<void>
```

**특징**:

- `openAiSidebar()`: 이미 열려있으면 버튼 클릭하지 않음 (토글 방지)
- 다양한 selector 시도 (data-testid, aria-label, text)
- 상세한 에러 메시지 (시도한 selector 목록, 페이지 URL)

#### 3. `timeouts.ts`

**중앙화된 timeout 관리**

```typescript
export const TIMEOUTS = {
  DOM_UPDATE: 500, // DOM 업데이트 대기
  AI_RESPONSE: 120000, // AI 응답 대기 (120초)
  DASHBOARD_LOAD: 40000, // 대시보드 로딩 (Vercel Cold Start 대응)
  SSE_STREAM: 150000, // SSE 스트리밍 (150초)
  NETWORK_ERROR: 5000, // 네트워크 에러 대기
};
```

---

## 🚀 실행 방법

### 개별 테스트 파일 실행

```bash
# 1. 핵심 검증 (Phase 1)
npx playwright test tests/e2e/ai-sidebar-vercel-validation.spec.ts --project=chromium

# 2. 입력 검증 (Phase 2)
npx playwright test tests/e2e/ai-input-validation.spec.ts --project=chromium

# 3. 기능 전환 (Phase 3)
npx playwright test tests/e2e/ai-functions.spec.ts --project=chromium

# 4. 히스토리 유지 (Phase 4)
npx playwright test tests/e2e/ai-history-persistence.spec.ts --project=chromium

# 5. 네트워크 복구 (Phase 4)
npx playwright test tests/e2e/ai-network-recovery.spec.ts --project=chromium

# 6. 접근성 (Phase 5)
npx playwright test tests/e2e/ai-accessibility.spec.ts --project=chromium
```

### 전체 테스트 실행

```bash
# 모든 AI 테스트 실행 (~8-10분)
npx playwright test tests/e2e/ai-*.spec.ts --project=chromium

# Headed 모드로 실행 (브라우저 UI 표시)
npx playwright test tests/e2e/ai-*.spec.ts --project=chromium --headed

# 특정 테스트만 실행
npx playwright test tests/e2e/ai-functions.spec.ts:25 --project=chromium
```

### 디버깅 모드

```bash
# Playwright Inspector로 디버깅
npx playwright test tests/e2e/ai-accessibility.spec.ts --project=chromium --debug

# Trace 생성
npx playwright test tests/e2e/ai-functions.spec.ts --project=chromium --trace=on

# Trace 뷰어로 분석
npx playwright show-trace trace.zip
```

---

## ⚡ Vercel 최적화 전략

### Vercel 무료 티어 고려사항

**제약사항**:

- 함수 실행 시간: 10초 제한
- 함수 호출 횟수: 100,000회/월
- 대역폭: 100GB/월
- Cold Start: 2-5초 (최대 40초)

### 테스트별 Vercel 부하

| 테스트 파일                          | AI 쿼리 수  | Vercel 부하 | 실행 빈도 권장 |
| ------------------------------------ | ----------- | ----------- | -------------- |
| ai-sidebar-vercel-validation.spec.ts | 6개         | 중간        | 하루 2-3회     |
| ai-input-validation.spec.ts          | 0-1개       | 매우 적음   | 하루 2-3회     |
| ai-functions.spec.ts                 | 3-4개       | 적음        | 하루 2-3회     |
| ai-history-persistence.spec.ts       | 2-3개       | 적음        | 하루 2-3회     |
| ai-network-recovery.spec.ts          | 0-1개       | 매우 적음   | 하루 2-3회     |
| ai-accessibility.spec.ts             | 0개         | 없음        | 하루 2-3회     |
| **전체 합계**                        | **11-15개** | **낮음**    | **하루 2-3회** |

### 최적화 기법

#### 1. 응답 대기 옵션 제어

```typescript
// ✅ 좋은 예: 응답 불필요한 경우
await submitAiMessage(page, '테스트 메시지', {
  waitForResponse: false, // Vercel 요청 0회
});

// ❌ 나쁜 예: 모든 메시지에서 응답 대기
await submitAiMessage(page, '테스트 메시지', {
  waitForResponse: true, // Vercel 요청 1회
});
```

#### 2. 네트워크 모킹 활용

```typescript
// ✅ 좋은 예: API 응답 모킹 (Vercel 요청 0회)
await page.route('**/api/ai/query', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ response: 'mocked response' }),
  });
});

// ❌ 나쁜 예: 실제 API 호출 (Vercel 요청 1회)
await submitAiMessage(page, 'test', { waitForResponse: true });
```

#### 3. UI 전용 테스트 우선

```typescript
// ✅ 접근성 테스트: UI만 검증 (Vercel 요청 0회)
test('키보드 내비게이션', async ({ page }) => {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const sidebar = page.locator('[data-testid="ai-sidebar"]');
  expect(await sidebar.isVisible()).toBe(true);
});
```

---

## 🐛 트러블슈팅

### 1. Navigation Timeout

**증상**: `page.waitForURL()` 타임아웃 발생

**원인**: 실제 사용자 플로우와 불일치

**해결 방법**:

```typescript
// ❌ 잘못된 방법
await page.click('button:has-text("🚀 시스템 시작")');
await page.waitForURL('**/dashboard');

// ✅ 올바른 방법 (Promise.all + /system-boot 대기)
const startButton = page.locator('button:has-text("🚀 시스템 시작")');
await startButton.click();

// /system-boot 로딩 페이지 대기 (4.7-10초)
await page.waitForURL('**/system-boot', { timeout: 10000 });

// /dashboard로 자동 전환 대기 (Vercel Cold Start 대응)
await page.waitForURL('**/dashboard', {
  timeout: TIMEOUTS.DASHBOARD_LOAD, // 40초
});
```

### 2. AI 사이드바 토글 문제

**증상**: `openAiSidebar()` 호출 시 사이드바가 닫힘

**원인**: 이미 열려있는 사이드바를 다시 클릭하여 토글됨

**해결 방법**: `openAiSidebar()` 헬퍼 함수는 자동으로 상태 확인 (v1.1.0+)

```typescript
// ✅ 자동 처리 (이미 열려있으면 클릭하지 않음)
await openAiSidebar(page);
```

### 3. Selector Not Found

**증상**: `AI 어시스턴트 토글 버튼을 찾을 수 없습니다`

**원인**: data-testid 속성 누락 또는 페이지 미로드

**해결 방법**:

```typescript
// 1. 페이지 로딩 확인
await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.DASHBOARD_LOAD });

// 2. data-testid 확인
const aiButton = page.locator('[data-testid="ai-assistant"]');
expect(await aiButton.isVisible()).toBe(true);

// 3. 에러 메시지 확인 (시도한 selector 목록)
// "AI 어시스턴트 토글 버튼을 찾을 수 없습니다. 시도한 selectors: [data-testid=...]"
```

### 4. Timeout on AI Response

**증상**: `waitForResponse: true` 시 120초 타임아웃

**원인**: Vercel Cold Start 또는 AI 응답 지연

**해결 방법**:

```typescript
// 1. Timeout 늘리기
const response = await submitAiMessage(page, 'complex query', {
  waitForResponse: true,
  responseTimeout: 180000, // 180초
});

// 2. 응답 대기 비활성화 (UI만 검증)
await submitAiMessage(page, 'test', {
  waitForResponse: false,
});
```

### 5. TEST_SECRET_KEY Missing

**증상**: 게스트 로그인 실패

**원인**: 환경 변수 미설정

**해결 방법**:

```bash
# .env.local 파일 확인
echo $TEST_SECRET_KEY

# 환경 변수 설정
export TEST_SECRET_KEY="your-secret-key"
```

---

## 📊 테스트 메트릭

### 실행 시간 (Chromium, MacBook Pro M1)

| 테스트 파일                          | 테스트 수 | 실행 시간 (예상) |
| ------------------------------------ | --------- | ---------------- |
| ai-sidebar-vercel-validation.spec.ts | 6개       | ~3-4분           |
| ai-input-validation.spec.ts          | 6개       | ~1-2분           |
| ai-functions.spec.ts                 | 7개       | ~3-4분           |
| ai-history-persistence.spec.ts       | 4개       | ~2-3분           |
| ai-network-recovery.spec.ts          | 5개       | ~2-3분           |
| ai-accessibility.spec.ts             | 6개       | ~1-2분           |
| **전체 합계**                        | **34개**  | **~12-18분**     |

### 안정성 목표

- **통과율**: 95% 이상
- **플레이크 테스트**: 1% 이하
- **Vercel 부하**: 하루 50회 이하 (무료 티어 100,000회/월의 0.05%)

---

## 📚 관련 문서

- **[CLAUDE.md](../../CLAUDE.md)** - 프로젝트 메인 가이드
- **[Playwright 공식 문서](https://playwright.dev/)** - Playwright API
- **[Vercel 무료 티어 제한](https://vercel.com/docs/limits)** - Vercel 제약사항

---

## 🔄 변경 이력

- **2025-11-28**: Phase 5 완료 (ai-accessibility.spec.ts 추가)
- **2025-11-27**: Phase 4 완료 (ai-history-persistence.spec.ts, ai-network-recovery.spec.ts 추가)
- **2025-11-26**: Phase 3 완료 (ai-functions.spec.ts + data-testid 추가)
- **2025-11-25**: Phase 2 완료 (ai-input-validation.spec.ts 추가)
- **2025-11-24**: Phase 1 완료 (ai-sidebar-vercel-validation.spec.ts + 헬퍼 함수)

---

**💡 팁**: AI 테스트는 Vercel 프로덕션 환경에서 실행되므로 하루 2-3회 수동 실행을 권장합니다. CI/CD 파이프라인에 포함 시 Vercel 무료 티어 제한을 초과할 수 있습니다.
