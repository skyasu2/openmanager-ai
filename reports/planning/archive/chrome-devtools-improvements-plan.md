---
Owner: project
Status: Completed
Doc type: How-to
Last reviewed: 2026-04-22
Tags: chrome-devtools,performance,accessibility,mcp
---

# chrome-devtools MCP 실사용 테스트 기반 개선 계획

> 2026-04-21 chrome-devtools MCP 실사용 테스트에서 발견된 개선 항목 3건 + MCP headed 모드 전환 1건

## 진행 현황 (2026-04-22)

- [x] Task 1 구현 반영: `gradient-diagonal`의 `background-position` 애니메이션 제거, 합성 친화적인 opacity pulse로 전환 (`src/app/global-effects.css`)
- [x] Task 2 구현 반영: FeatureCard 버튼에 `aria-label`을 유지하고 설명 문단을 `aria-hidden="true"`로 처리 (`src/components/home/FeatureCardsGrid.tsx`)
- [x] Task 3 구현 반영: `/api/system` 호출 훅에 `enabled` 옵션 추가, 랜딩 start 훅에서 `isAuthenticated` 기반 조건부 호출 적용 (`src/hooks/useSystemStatus.ts`, `src/app/main/hooks/useSystemStart.tsx`)
- [x] Task 4 구현 반영: "GraphRAG (LlamaIndex.TS)" 잔존 텍스트를 커스텀 GraphRAG 브랜딩으로 교체 (`src/data/tech-stacks/ai-assistant.ts`, `src/data/architecture-diagrams/ai-assistant.ts`)
- [x] Task 5 설정 반영: `.mcp.json` `chrome-devtools` args에서 `--headless` 제거 상태 확인
- [x] Lighthouse 로컬 재측정(2026-04-21, `next build` + `next start:3200`)
  - mobile: `performance 55 / accessibility 100 / best-practices 100 / seo 100`, `CLS 0.0367`
  - desktop: `performance 93 / accessibility 100 / best-practices 100 / seo 100`, `CLS 0.1083`
  - `errors-in-console` = pass, `label-content-name-mismatch` = pass
- [x] Task 1 마감(2026-04-22): 랜딩 초기 렌더 경로 안정화 후 desktop/mobile CLS 모두 `< 0.1` 달성
  - desktop: `performance 95 / accessibility 100 / best-practices 100 / seo 100`, `CLS 0.0866`
  - mobile: `performance 68 / accessibility 100 / best-practices 100 / seo 100`, `CLS 0.0193`
  - 관련 리포트: `reports/lighthouse/local-start-desktop-summary.json`, `reports/lighthouse/local-start-mobile-summary.json`
- [x] Trace 재측정 완료(2026-04-22, headed `performance_start_trace`)
  - desktop(1440x900): `LCP 664ms`, `CLS 0.08` (`/tmp/openmanager-trace-desktop-2.json.gz`)
  - mobile(390x844): `LCP 480ms`, `CLS 0.07` (`/tmp/openmanager-trace-mobile-3.json.gz`)
  - `CLSCulprits` 분석: 최대 cluster score `0.0679`, 잠재 root cause 특정 없음
  - `list_console_messages(types: ['error'])`: 에러 0건
- [x] Task 5 headed 실검증(2026-04-22): `new_page("https://openmanager-ai.vercel.app")` + `take_screenshot(fullPage)` 완료
  - 증거: `/tmp/openmanager-vercel-headed-check.png`

## 배경

chrome-devtools MCP 도입(2026-04-21) 후 실사용 테스트(Lighthouse + Performance Trace + 인터랙션)에서 하기 이슈를 발견함.

---

## 개선 항목

### Task 1 — CLS 0.20 수정 (데스크탑) `P2`

**현상**: 데스크탑 기준 `CLS=0.20` (Needs Improvement, 기준 0.1 이하)
**원인**: `gradient-diagonal` CSS 애니메이션이 `background-position-x/y` 사용 → GPU 합성 불가 → 레이아웃 시프트 발생
- 발생 구간: 640ms~1680ms, score 0.2045
- `TARGET_HAS_INVALID_COMPOSITING_STATE`, `UNSUPPORTED_CSS_PROPERTY`
- 모바일(390px)에서는 CLS=0.03 (viewport 비율 차이)

**수정 방향**: `background-position` 기반 애니메이션을 GPU 합성 가능한 방식으로 교체
- Option A: `transform: translate()` 기반 그라디언트 이동 효과로 재구현
- Option B: 애니메이션 대상 요소에 `will-change: transform` + `transform` 사용
- Option C: CSS `@keyframes` 내 `background-size` 변경으로 pulse 효과 대체

**검증**:
- [x] `performance_start_trace` → CLS insight 확인 (< 0.1 목표)
- [x] 데스크탑 + 모바일 양쪽 검증
- [x] `npm run lighthouse:*` 또는 `lighthouse_audit` 점수 확인

---

### Task 2 — label-content-name-mismatch 수정 (WCAG 2.5.3) `P3`

**현상**: Lighthouse Best Practices 감점 원인, FeatureCard 버튼 4개
**원인**: `aria-label`("💬 AI 어시스턴트 상세 정보 보기")이 visible text 전체(제목 + 설명 단락)와 불일치
- WCAG 2.5.3 Label in Name: accessible name은 visible label을 포함해야 함
- 설명 단락이 버튼 내부 자식 요소로 포함돼 있어 Lighthouse가 전체를 visible text로 간주

**해당 컴포넌트**: FeatureCard 버튼 4개 (AI 어시스턴트, 클라우드 플랫폼 활용, 기술 스택, Vibe Coding)

**수정 방향**:
- 설명 단락(`<p>`)을 `aria-hidden="true"` 처리 (accessible name 계산에서 제외)
- 또는 설명 단락을 버튼 외부로 이동 (시각적으로는 동일하게 유지)

**검증**:
- [x] `lighthouse_audit` → `label-content-name-mismatch` 항목 통과 확인
- [x] `take_snapshot` → 버튼 accessible name 확인

---

### Task 3 — `/api/system` 비인증 자동 호출 수정 `P3`

**현상**: 메인 랜딩 페이지에서 비로그인 상태로 `/api/system`을 자동 호출 → 401 × 2
- Lighthouse `errors-in-console` 항목 실패 원인
- Best Practices 감점

**원인**: 랜딩 페이지 컴포넌트가 인증 상태와 무관하게 `/api/system`을 호출

**수정 방향**: 인증 상태 확인 후 조건부 호출
```typescript
// 현재 (추정)
useEffect(() => { fetch('/api/system'); }, []);

// 수정 방향
useEffect(() => {
  if (session) { fetch('/api/system'); }
}, [session]);
```

**검증**:
- [x] 비로그인 상태 랜딩 페이지 진입 시 `/api/system` 호출 없음
- [x] `list_console_messages(types: ['error'])` → 에러 0건 확인
- [x] `lighthouse_audit` → `errors-in-console` 통과

---

### Task 4 — UI 텍스트 "GraphRAG (LlamaIndex.TS)" 갱신 `P3`

**현상**: AI 어시스턴트 모달에 "GraphRAG (LlamaIndex.TS)" 헤딩 잔존
- 2026-04-13 파일 리네임(`llamaindex-rag-*` → `graphrag-*`) 및 LlamaIndex 브랜딩 제거 완료
- 그러나 랜딩 페이지 FeatureCard 모달 UI 텍스트는 미갱신

**해당 파일**: FeatureCard 데이터 파일 (feature-cards.data.ts 또는 유사)

**수정 방향**: "GraphRAG (LlamaIndex.TS)" → "GraphRAG" 또는 "커스텀 GraphRAG"로 교체

**검증**:
- [x] `take_snapshot` → 모달 내 "LlamaIndex" 텍스트 없음 확인
- [x] `npm run type-check && npm run lint`

---

## chrome-devtools MCP headed 모드 전환

### Task 5 — Claude `.mcp.json` headed 모드 지원 추가 `P3`

**현상**: Claude `chrome-devtools` MCP가 `--headless` 모드만 지원
- Codex 설정: `--isolated` (no headless) → 브라우저 창 표시 가능
- Claude 설정: `--isolated --headless` → 헤드리스 전용

**방법 A: --headless 제거 (기본 headed)**
```json
// .mcp.json
"args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
```
- DISPLAY=:0 (X11 WSLg) + Chrome 설치됨 → 브라우저 창 표시 가능
- MCP 재시작 필요

**방법 B: --browser-url (기존 Chrome 세션 재사용)**
```json
// .mcp.json
"args": ["-y", "chrome-devtools-mcp@latest", "--browser-url", "http://127.0.0.1:9222"]
```
```bash
# 먼저 로컬 Chrome 실행 (원하는 세션으로 로그인)
/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-session
```
- 인증된 세션 재사용 가능 (쿠키/스토리지 유지)
- 기존 브라우저 창을 MCP가 제어

**WSL2 환경 전제조건** (이미 충족):
- `DISPLAY=:0` ✅
- X11/WSLg 활성 (`xset q` 응답 확인) ✅
- `/usr/bin/google-chrome` 설치됨 ✅

**검증**:
- [x] `.mcp.json` `--headless` 제거 후 Claude Code 재시작
- [x] `new_page("https://openmanager-ai.vercel.app")` → 브라우저 창 표시 확인
- [x] `take_screenshot` → 스크린샷 정상 캡처

---

## 우선순위 요약

| Task | 우선순위 | 예상 노력 |
|------|--------|---------|
| Task 1 — CLS 0.20 수정 | P2 | 소 (CSS 수정) |
| Task 2 — label-content-name-mismatch | P3 | 소 (aria-hidden 1줄) |
| Task 3 — /api/system 비인증 호출 | P3 | 소 (조건부 fetch) |
| Task 4 — GraphRAG UI 텍스트 | P3 | 극소 (텍스트 교체) |
| Task 5 — headed 모드 전환 | P3 | 극소 (설정 1줄) |
