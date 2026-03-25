---
name: qa-ops
description: Final QA workflow for OpenManager with Vercel+Playwright MCP default, local-dev fallback for non-AI checks, and mandatory cumulative logging to reports/qa.
version: v1.2.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
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

## Workflow

1. 기준선 확인.
- `reports/qa/production-qa-2026-02-25.md`
- `reports/qa/qa-tracker.json`
- `reports/qa/QA_STATUS.md`

2. 환경 선택.
- 기본: **Vercel + Playwright MCP**
- AI 기능 검증 불필요 시: 로컬 dev 서버 QA 허용

3. 시나리오 실행.
- 공통: landing/login/dashboard/modal
- AI 필수: AI assistant/chat/분석 응답 경로
- 비AI: UI/카피/레이아웃/기본 인증 동선 중심
- **Data Parity (AI 검증 시)**: 현재 QA target의 base URL에서 `GET /api/health?service=parity`를 호출해 `slot.globalSlotIndex`를 기록하고, AI 응답 tool call의 `dataSlot.slotIndex`와 ±1 이내인지 확인
  - production: `https://openmanager-ai.vercel.app`
  - preview: 현재 preview deployment URL
  - local-dev: `http://localhost:<port>`
- run 입력에는 `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`를 기록합니다.

4. 결과 기록(필수).
- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- `npm run qa:record -- --input /tmp/qa-run-input.json`
- `npm run qa:status`
- Vercel production의 `broad`/`release-gate` run 또는 `releaseFacing=true` run은 `expertAssessments`와 `usageChecks`를 포함합니다.

5. 결과 보고.
- 항상: target, run id, scope, checks, release decision
- 관련 있을 때만: covered/skipped surfaces, usage, expert gaps, completed/pending, next priority

## Output Format

```text
QA Summary
- result: go | conditional | no-go
- target: vercel|local-dev
- run id: QA-YYYYMMDD-XXXX
- scope: smoke|targeted|broad|release-gate
- checks: <total> (pass <n> / fail <n>)

Optional when relevant:
- covered surfaces: <list>
- skipped surfaces: <list|none>
- usage: <collection/result summary>
- completed: <count>
- pending: <count>
- expert gaps: <count>
- next priority: <item id>

End with one short operator note for the highest remaining risk or `none in tested scope`.
```

## Changelog

- 2026-02-26: v1.0.0 - 최종 QA 운영/누적 추적 스킬 신설
- 2026-03-25: v1.2.0 - Data Parity Contract 검증 단계 추가 (±1 슬롯 기준)
- 2026-03-14: v1.1.0 - `state-triage`, `env-sync` 선행 규칙 추가
