---
name: qa-ops
description: Final QA workflow for OpenManager with Vercel+Playwright MCP default, local-dev fallback for non-AI checks, and mandatory cumulative logging to reports/qa.
version: v1.3.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_fill_form
disable-model-invocation: true
---

# QA Ops

최종 QA를 표준 절차로 수행하고 결과를 누적 추적합니다.

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
- **Data Parity (AI 검증 시)**: `GET /api/health?service=parity`로 `slot.globalSlotIndex` 기록, AI 응답 `dataSlot.slotIndex`와 ±1 이내인지 확인
- run 입력에는 `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`를 기록합니다.

4. 결과 기록(필수).
- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- JSON 편집 후: `npm run qa:record -- --input /tmp/qa-run-input.json`
- `npm run qa:status`
- `broad`/`release-gate` run은 `expertAssessments`와 `usageChecks` 포함 필수

5. 결과 보고.
- 항상: target, run id, scope, checks, release decision
- 관련 있을 때만: covered/skipped surfaces, usage, expert gaps, completed/pending, next priority

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
