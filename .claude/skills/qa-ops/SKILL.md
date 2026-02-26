---
name: qa-ops
description: Final QA workflow for OpenManager with Vercel+Playwright MCP default, local-dev fallback for non-AI checks, and mandatory cumulative logging to reports/qa.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
disable-model-invocation: true
---

# QA Ops

최종 QA를 표준 절차로 수행하고 결과를 누적 추적합니다.

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

4. 결과 기록(필수).
- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- `npm run qa:record -- --input /tmp/qa-run-input.json`
- `npm run qa:status`

5. 결과 보고.
- run id, pass/fail, 완료/미완료 개선항목, 다음 우선순위

## Output Format

```text
QA Ops Summary
- target: vercel|local-dev
- run id: QA-YYYYMMDD-XXXX
- checks: <total> (pass <n> / fail <n>)
- completed: <count>
- pending: <count>
- next priority: <item id>
```

## Changelog

- 2026-02-26: v1.0.0 - 최종 QA 운영/누적 추적 스킬 신설
