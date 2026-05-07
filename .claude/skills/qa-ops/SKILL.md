---
name: qa-ops
description: Final QA workflow for OpenManager with Vercel+Playwright MCP default, local-dev fallback for non-AI checks, mandatory cumulative logging to reports/qa, and conversational AI QA for AI-related changes.
version: v1.5.1
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_fill_form, mcp__playwright__browser_evaluate, mcp__playwright__browser_close
disable-model-invocation: true
---

# QA Ops

> Common baseline: before editing this skill, review `docs/guides/ai/skill-standards.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

최종 QA를 표준 절차로 수행하고 결과를 누적 추적합니다.

## Testing Methodology

- 기준 SSOT는 `docs/guides/testing/test-strategy.md` 입니다.
- QA는 테스트 피라미드 최상단입니다. broad matrix를 넓히기보다 risk-based 대표 시나리오를 선택합니다.
- coverage percentage를 맞추기 위해 Vercel/Cloud Run/LLM live QA를 반복하지 않습니다. 수정 후 집중 재검증 1회는 허용하되, 반복 live run은 명확한 사유가 필요합니다.
- 기본 CI/local gate에는 외부 서비스 비용을 만들지 않습니다. production QA evidence는 릴리즈 증거이며, 로컬 계약 테스트를 대체하지 않습니다.

## Use with other skills

- 실패 원인, 무료 티어 적합성, 다음 액션 분석이 먼저 필요하면 `state-triage`를 선행합니다.
- preview/production env drift 가능성이 보이면 `env-sync`를 먼저 실행하고 QA를 재개합니다.

## Trigger Keywords

- "/qa-ops", "/qa"
- "최종 QA", "품질검증", "릴리즈 QA"
- "playwright mcp 검증"

## Scope 선택 기준

| scope | 언제 | 조건 |
|-------|------|------|
| `smoke` | 빠른 sanity check | core-routes만, 5분 이내 |
| `targeted` | 특정 변경사항 검증 | coveredSurfaces 명시 필수 |
| `broad` | 릴리즈 전 전체 검증 | **public snapshot baseline 자격** |
| `release-gate` | 정식 릴리즈 게이트 | **public snapshot baseline 자격** |

> `broad` 또는 `release-gate` run만 `validation-evidence.json` latestRun으로 승격됩니다.
> `targeted + releaseFacing=true`는 게이트를 통과하지만 public snapshot을 교체하지 않습니다.

## Workflow

1. 기준선 확인.
- `npm run qa:status` — 현재 누적 상태 요약
- `cat reports/qa/QA_STATUS.md` — 상세 현황
- `cat public/data/qa/validation-evidence.json | python3 -m json.tool` — public snapshot 확인

2. 환경 선택.
- 기본: **Vercel Production + Playwright MCP** (`https://openmanager-ai.vercel.app`)
- AI 기능 검증 불필요 시: 로컬 dev 서버 QA 허용

3. 시나리오 실행.
- 공통: landing/login/dashboard/modal
- AI 필수: AI assistant/chat/분석 응답 경로
- 비AI: UI/카피/레이아웃/기본 인증 동선 중심
- 변경된 리스크를 덮는 가장 작은 대표 pack을 선택하고, route/device/provider matrix 확장은 구체적 리스크가 있을 때만 수행
- **Data Parity (AI 검증 시)**: `GET /api/health?service=parity`로 `slot.globalSlotIndex` 기록, AI 응답 `dataSlot.slotIndex`와 ±1 이내인지 확인
- run 입력에는 `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`를 기록합니다.

3.5 대화형 AI QA (AI 관련 변경 시 필수 추가 단계).
- AI 프롬프트, 에이전트 라우팅, 지식 베이스, precomputed-state/data source, 응답 파싱, 출력 포맷 동작이 변경될 때 실행
- 표준 5개 질문을 AI 어시스턴트에게 순서대로 질의 (상세: `docs/guides/testing/test-strategy.md` § 1.5)
  1. "현재 서버 전체 상태를 요약해줘"
  2. "web-server-01 상태를 자세히 알려줘"
  3. "지난 24시간 중 가장 부하가 높았던 시간대는 언제야?"
  4. "지금 당장 조치가 필요한 서버가 있어?"
  5. "방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘"
- 판정: Pass(구체적 수치/맥락 있음) / Warn(모호) / Fail(빈 응답/오류)
- Fail/Warn → 프롬프트·라우팅 즉시 수정 후 재질의. 전체 Pass 후에만 기록 단계로 진행.
- 결과는 `coveredSurfaces: ["conversational-ai-qa"]` + `expertAssessments`에 포함.

4. 결과 기록(필수).
- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- JSON 편집 후: `npm run qa:record -- --input /tmp/qa-run-input.json`
- `npm run qa:status`
- `broad`/`release-gate` run은 `expertAssessments`와 `usageChecks` 포함 필수

5. 결과 보고.
- 항상: target, run id, scope, checks, release decision
- 관련 있을 때만: covered/skipped surfaces, usage, expert gaps, completed/pending, next priority

## Playbook — Async Job + SSE Probing on Vercel Production

비동기 AI Job + SSE stream 경로(`POST /api/ai/jobs` → `GET /api/ai/jobs/:id/stream`)를 Playwright MCP로 검증할 때의 정확한 절차. v8.11.53 cloud-tasks dispatch QA에서 확립.

### 1) 진입 동선

1. `mcp__playwright__browser_navigate` → `https://openmanager-ai.vercel.app`
2. `browser_snapshot` 으로 ref 확보 → 게스트 로그인 → "시스템 시작" 클릭 → `/dashboard` 이동까지 약 18초 대기
3. "AI 어시스턴트 열기" 클릭 → `dialog [name="AI 어시스턴트"]` 노출

### 2) Query 전송 (CSRF 우회 금지)

- **반드시 UI fill+click 경로 사용**. `browser_evaluate`로 직접 `fetch('/api/ai/jobs')` 호출하면 **403 Invalid CSRF token**이 정상으로 반환됨 — 이건 보안 동작이지 회피 대상이 아니다.
- thinking + RAG 등 무거운 옵션은 입력창 옆 모드 칩에서 선택. dispatch path를 강제로 타려면 query를 충분히 길게.

### 3) Stream 경과 모니터링

- snapshot은 무겁다. 진행 상태는 `browser_evaluate`로 한 줄로 뽑는 게 빠름:
  ```js
  () => document.querySelector('[role=dialog]')?.innerText?.slice(-2500)
  ```
- UI badge에서 직접 읽을 핵심 지표: `경과 N초`, `N% 완료`, `handoff N회`, 응답 카드 하단의 **`{ms}ms`**, "분석 근거" 행의 **`도구 N개 · 모드: ...`**.

### 4) Network 캡처 — EventSource는 안 잡힌다

- `browser_network_requests`는 **fetch만** 잡고 EventSource(`/api/ai/jobs/:id/stream`)는 누락됨.
- SSE 호출까지 보려면 `browser_evaluate`로 Performance API:
  ```js
  () => performance.getEntriesByType('resource')
    .filter(r => r.name.includes('/api/ai/'))
    .map(r => ({ url: r.name, duration: Math.round(r.duration), transferSize: r.transferSize, initiator: r.initiatorType }))
  ```
- `initiator: 'other'`인 entry가 EventSource. 두 개 이상 잡히면 **maxDuration=60s 도달 후 client backoff reconnect가 정상 동작**한다는 뜻.

### 5) 합격/불합격 판정

| 항목 | 기준 |
|------|------|
| `POST /api/ai/jobs` 응답 시간 | < 3초 (Cloud Tasks dispatch 분리 검증) |
| Stream entry 개수 | 1~3 (3 초과면 reconnect 폭주 의심) |
| 응답 정확도 | UI 카드 수치 ↔ AI 응답 본문 정합 (예: "DISK 70%+ 3대" ↔ Top 5 카드와 일치) |
| Handoff/도구 가시성 | UI에 stage/handoff/tool count 모두 노출 |
| 회귀 신호 | `302 → 404` 패턴, "Job not found", `error: 'Worker request failed'` 없음 |

### 6) 정리

- `browser_take_screenshot` 1장으로 증거 보관 → `.playwright-mcp/<scenario>.png`
- `browser_close`로 브라우저 종료
- 결과를 `qa-run-input.json`에 기록하고 `npm run qa:record` 실행 (Workflow 4단계 그대로)

### 함정 모음

| 함정 | 대응 |
|------|------|
| `browser_network_requests` 가 SSE 누락 | Performance API로 보완 |
| `evaluate(fetch)` 가 403 | UI 동선으로만 검증, CSRF 우회 금지 |
| dialog 깊이가 깊어 snapshot 무거움 | innerText slice로 텍스트만 추출 |
| `/api/health?service=ai` 가 500이지만 query는 정상 | health probe와 실제 동작은 분리 보고. badge "AI 엔진 상태: Error" 단독으로 fail 처리 금지 |
| 첫 stream 60s에서 끊김 | reconnect 1회는 정상. 두 번째 stream entry duration도 함께 보고 |

## Output Format

```text
QA Summary
- result: go | conditional | no-go
- target: vercel-production | local-dev
- run id: QA-YYYYMMDD-XXXX
- scope: smoke | targeted | broad | release-gate
- checks: <total> (pass <n> / fail <n>)

Optional when relevant:
- covered surfaces: <list>
- skipped surfaces: <list | none>
- usage: <collection/result summary>
- completed: <count>
- pending: <count>
- expert gaps: <count>
- next priority: <item id>

End with one short operator note for the highest remaining risk or `none in tested scope`.
```

## Changelog

- 2026-02-26: v1.0.0 - 최종 QA 운영/누적 추적 스킬 신설
- 2026-03-14: v1.1.0 - `state-triage`, `env-sync` 선행 규칙 추가
- 2026-03-25: v1.2.0 - Data Parity Contract 검증 단계 추가 (±1 슬롯 기준)
- 2026-04-03: v1.3.0 - 날짜 박힌 baseline 참조 제거, scope 승격 규칙 명시, Playwright 도구 추가
- 2026-04-28: v1.4.0 - Async Job + SSE Probing Playbook 추가 (EventSource Performance API 우회, CSRF 우회 금지, reconnect 정상 신호, 함정 모음)
- 2026-05-07: v1.5.0 - 대화형 AI QA 단계(3.5) 추가 — AI 관련 변경 시 표준 5개 질의로 유용성 검증
- 2026-05-07: v1.5.1 - risk-based 테스트 방법론, 비용 guardrail, 대표 live-run 제한 기준 반영
