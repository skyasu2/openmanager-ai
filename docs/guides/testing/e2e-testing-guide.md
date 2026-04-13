# OpenManager AI E2E 테스트 가이드

> Playwright 기반 End-to-End 테스트 범위와 실행/운영 가이드
> Owner: documentation
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-04-13
> Canonical: docs/guides/testing/e2e-testing-guide.md
> Tags: testing,e2e,playwright,playwright-mcp,vercel-qa

---

## 개요

현재 E2E는 **로컬 핵심 사용자 플로우 회귀**에 집중합니다.

- 목적: "앱이 실제 브라우저에서 깨지지 않는가"를 빠르게 확인
- 범위: 로그인/게스트/대시보드/접근성/오류 복구
- 원칙: AI 실추론 기반 장시간 시나리오는 자동 E2E에서 제외
- 게스트 restricted 모드에서는 인라인 PIN 입력(`data-testid="guest-pin-input"`) 경로를 기본 검증

### 현재 구성 유지 권고 (변경 최소화)

- 기본 브라우저 프로젝트는 `chromium` 유지, 모바일 회귀는 `test:e2e:mobile` 또는 `PLAYWRIGHT_INCLUDE_MOBILE=1`로 선택 실행
- 개발 서버는 `NEXT_DISABLE_DEVTOOLS=1`로 실행해 테스트 간섭 최소화
- 배포 환경 검증 시 `x-vercel-protection-bypass` 헤더 경로 유지
- `firefox/webkit` 재활성화는 명시적 ROI 근거가 있을 때만 검토

---

## 유지 중인 E2E 스펙

- `tests/e2e/smoke.spec.ts`
- `tests/e2e/guest.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/dashboard-server-cards.spec.ts`
- `tests/e2e/dashboard-ai-sidebar.spec.ts`
- `tests/e2e/dashboard-alerts-logs.spec.ts`
- `tests/e2e/login.spec.ts`
- `tests/e2e/error-boundary.spec.ts`
- `tests/e2e/system-boot.spec.ts`
- `tests/e2e/mobile-responsive.spec.ts` (모바일 프로젝트 전용)

---

## 실행 명령

```bash
# 로컬 핵심 E2E(smoke, 기본)
npm run test:e2e

# 전체 E2E (필요 시)
npm run test:e2e:all

# AI 태그 제외 실행
npm run test:e2e:no-ai

# 외부 의존 시나리오만 분리 실행 (@external)
npm run test:e2e:external

# 핵심 게이트(권장)
npm run test:e2e:critical

# 모바일 반응형 전용 회귀
npm run test:e2e:mobile

# 데스크톱 + 모바일 통합 회귀
npm run test:e2e:responsive

# 개발 서버 포함 1회 실행
npm run test:e2e:with-server
```

> `test:e2e:external`는 `--pass-with-no-tests` 옵션을 사용합니다.
> 현재 `@external` 테스트가 없으면 0건 통과로 종료되는 것이 의도된 동작입니다.

---

## 운영 원칙

### 1) 기본은 로컬

- E2E는 `playwright.config.ts` 기준 로컬 앱 대상으로 실행
- 원격 Vercel URL 직격 테스트는 기본 스크립트에서 제외

### 2) AI 검증은 계약 테스트로 대체

- AI 품질 자동화는 `Vitest + Contract`에서 처리
- E2E에서는 "UI가 동작하는가"만 확인

### 3) 실패 분류

- 셀렉터/렌더 실패: 프론트 회귀
- 네트워크/응답 대기 실패: 테스트 타임아웃 설계 문제 가능성 우선 검토
- 동일 시나리오 flaky 반복 시 E2E에서 제거 후 계약 테스트로 이동

### 4) CI 실행 주기 권장안

- GitLab canonical gate: `test:quick` + `test:contract` + `type-check` + `lint`
- PR/릴리즈 강화 게이트: `test:e2e:critical` 유지
- 정기/수동: `test:e2e:all` 또는 `test:e2e:external` 선택 실행

---

## 새 E2E 추가 기준

아래를 모두 만족할 때만 추가합니다.

1. 브라우저 상호작용이 반드시 필요한가?
2. 단위/계약 테스트로 대체 불가능한가?
3. 30초 내 안정적으로 종료되는가?
4. 외부 유료 API 호출 없이 재현 가능한가?
5. AI 답변 문자열 exact match 없이도 검증 가능한가?

---

## AI 비결정성 대응 규칙

- 텍스트 자체가 아니라 `응답 컨테이너 렌더링`, `스트림 상태 전이`, `에러 핸들링`을 검증
- AI 응답 내용 검증이 필요하면 E2E 대신 `Vitest + MSW` 계약 테스트 사용
- 외부 AI/Cloud 종속 시나리오는 `@external` 태그로 분리해 기본 실행에서 제외

---

## 디버깅 빠른 절차

```bash
# 1) 단일 스펙 재실행
npx playwright test tests/e2e/smoke.spec.ts --project=chromium

# 2) 트레이스 확인
npx playwright show-trace tmp/playwright/e2e/test-results/**/trace.zip

# 3) 콘솔/네트워크 확인
# 필요 시 spec 내부에서 page.on('console'|'requestfailed') 임시 로깅
```

- 수동 Playwright 검증에서 스크린샷/임시 파일이 필요하면 `tests/` 아래에 직접 쓰지 말고 `testInfo.outputPath(...)`를 사용합니다.

---

---

## QA 경로 선택 기준

### CLI Playwright vs Playwright MCP

| 항목 | CLI Playwright (`npm run test:e2e`) | Playwright MCP (`mcp__playwright__*`) |
|------|-----------------------------------|------------------------------------|
| 실행 주체 | 자동화 스크립트 (CI/스케줄) | AI Agent (Claude/Codex, 대화형) |
| 적합 용도 | 회귀 방지, CI 게이트 | 기능 탐색, 신규 화면 검증, 릴리즈 전 수동 QA |
| 코드 필요 | `.spec.ts` 파일 작성 필요 | 불필요 (AI가 즉시 실행) |
| 결과 형식 | JUnit XML, HTML 리포트 | 스크린샷 + 텍스트 스냅샷 |
| 반복 실행 | 빠름 (병렬 처리) | 느림 (순차, 대화형) |
| AI 비결정 응답 | 취약 (exact match 금지 원칙) | 강함 (눈으로 확인 또는 flexible assertion) |
| 접근 대상 | 로컬 dev 서버 또는 Vercel (설정 필요) | 로컬 dev 서버 또는 Vercel URL 직접 |

### 대상 환경 선택

| 조건 | 권장 환경 |
|------|----------|
| UI/레이아웃/일반 흐름 확인 | 로컬 dev 서버 (`http://localhost:3000`) |
| AI 기능 (Cloud Run 연동) 확인 | Vercel Production (`https://openmanager-ai.vercel.app`) |
| 인증 흐름 검증 | 로컬 dev 서버 (Supabase local 또는 staging) |
| 릴리즈 전 전체 검증 | Vercel Production |
| 빠른 회귀 확인 (5분) | 로컬 dev 서버 |

---

## Playwright MCP QA 절차

### A. Vercel Production QA

Vercel Deployment Protection 우회를 위해 `x-vercel-protection-bypass` 헤더가 필요합니다.

**사전 준비**

```bash
# bypass secret 조회 (Vercel 대시보드 → Project Settings → Deployment Protection)
# 또는 .env.local에서 확인
grep VERCEL_AUTOMATION_BYPASS_SECRET .env.local
```

**진행 순서**

1. Claude Code 세션에서 Playwright MCP 도구를 직접 호출합니다.
2. 브라우저를 열고 bypass 헤더를 포함해 접근합니다.

```
# 예시 대화형 흐름
browser_navigate: https://openmanager-ai.vercel.app
  → extraHTTPHeaders: { "x-vercel-protection-bypass": "<secret>" }
browser_snapshot: 초기 화면 상태 캡처
browser_click: 로그인 또는 게스트 버튼
browser_snapshot: 로그인 후 대시보드 상태
browser_navigate: https://openmanager-ai.vercel.app/dashboard
browser_snapshot: 서버 카드 렌더링 확인
```

**smoke 체크 목록 (5분 기준)**

- [ ] `/` 홈 화면 정상 로드
- [ ] 게스트 접근 → 대시보드 진입
- [ ] 서버 카드 15개 렌더링
- [ ] AI 사이드바 열기 (Cloud Run 연결 상태 확인)
- [ ] `/api/health` 200 응답

```bash
# health check는 CLI로도 가능
curl -s https://openmanager-ai.vercel.app/api/health | jq .
```

---

### B. 로컬 Dev 서버 QA (Playwright MCP)

**사전 준비**

```bash
# 네트워크 바인딩 개발 서버 시작 (백그라운드)
npm run dev:network
# 또는
NEXT_DISABLE_DEVTOOLS=1 npx next dev -H 0.0.0.0 -p 3000
```

**진행 순서**

```
browser_navigate: http://localhost:3000
browser_snapshot: 초기 화면 캡처
browser_click: 대상 기능 버튼
browser_snapshot: 상태 변화 확인
```

**로컬 QA 장점**

- Vercel bypass 헤더 불필요
- AI 기능 제외 테스트에 적합 (Cloud Run 없이도 UI 확인 가능)
- Hot reload로 즉각 반영 확인 가능

---

## Scope별 체크리스트

### Smoke (5분, 기본 확인)

CLI: `npm run test:e2e:critical`  
MCP: A 섹션 smoke 목록

- [ ] 홈(`/`) 정상 로드
- [ ] 게스트 모드 접근 → 대시보드 진입
- [ ] 서버 카드 그리드 렌더링
- [ ] `/api/health` 200 응답

### Targeted (변경 영역 집중, ~15분)

변경된 컴포넌트/API에 해당하는 스펙만 선택 실행:

```bash
# 예: AI 사이드바 변경 시
npx playwright test tests/e2e/dashboard-ai-sidebar.spec.ts --project=chromium

# 예: 로그인 흐름 변경 시
npx playwright test tests/e2e/login.spec.ts tests/e2e/guest.spec.ts --project=chromium
```

Playwright MCP로 진행 시: 변경된 화면만 `browser_navigate` → `browser_snapshot` → `browser_click` 순서로 탐색.

### Broad (릴리즈 전, ~30분)

CLI: `npm run test:e2e:all`  
MCP (Vercel Production): 전체 핵심 흐름 순차 탐색

- [ ] smoke 체크리스트 전체
- [ ] 인증: 이메일 로그인 → 세션 유지
- [ ] 대시보드: 서버 카드 클릭 → 상세 모달 열기
- [ ] AI 사이드바: 질문 입력 → 스트리밍 응답 수신
- [ ] 접근성: 키보드 내비게이션, focus trap (모달)
- [ ] 오류 복구: 네트워크 에러 시 UI 정상 표시
- [ ] 모바일: `npm run test:e2e:mobile` 또는 `browser_resize` 375×812

### Release Gate (배포 직전, CI 필수 통과)

```bash
npm run validate:all        # TypeScript + Lint + Unit
npm run test:e2e:critical   # E2E critical gate
```

MCP로 Vercel Production smoke 체크리스트 추가 실행 권장.

---

## Related

- [Test Strategy Guide](./test-strategy.md)
- [Playwright Config](../../../playwright.config.ts)
- [QA Ops Skill](.claude/skills/qa-ops/SKILL.md) — AI agent 내부 QA 워크플로우
