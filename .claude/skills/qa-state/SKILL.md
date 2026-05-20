---
name: qa-state
description: Thin wrapper for current-state triage followed by QA ops only when both are needed. Use for combined state diagnosis, QA execution, and tracker reporting.
version: v2.2.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__lighthouse_audit
disable-model-invocation: true
---

# QA State

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

이 스킬은 `state-triage` 후 `qa-ops`를 바로 이어야 할 때만 사용합니다. 상세 진단 규칙은 `state-triage`, QA 실행/기록 규칙은 `qa-ops`에 둡니다.

## Trigger Keywords

- "/qa-state"
- "현재 상태 점검하고 QA까지 실행해줘"
- "배포 후 상태 분석하고 기록해줘"
- "상태 진단 후 필요한 QA를 선택해서 진행해줘"

## Workflow

1. 상태 진단을 먼저 수행.
- `state-triage` 기준으로 QA 상태, 런타임 증거, free-tier 적합성, 다음 액션을 분류
- next action은 `code-fix`, `config-fix`, `deploy-and-qa`, `qa-checklist-fix`, `qa-metadata-fix`, `broader-qa`, `wont-fix` 중 하나로 정리

1. QA 실행 여부를 결정.
- `code-fix` 또는 `config-fix`면 수정 전 broad QA를 실행하지 않음
- `deploy-and-qa`, `broader-qa`, `qa-checklist-fix`, 검증 rerun이면 `qa-ops`로 진행
- accepted debt이면 `wont-fix` 근거를 보고하고 불필요한 QA 기록을 만들지 않음

1. QA가 필요할 때만 `qa-ops`를 실행.
- 환경 선택, surface coverage, Playwright/Chrome DevTools 사용, `qa:record`는 `qa-ops` 기준을 따름
- `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`, `countsTowardSummary`는 `qa-ops` 규칙대로 기록
- tracker semantics를 이 스킬에 중복 작성하지 않음

1. 통합 결과를 보고.
- triage 결과, QA 실행 여부, run id, release decision, next action을 한 번에 보고
- QA를 생략했다면 생략 이유를 명시

## Output Format

```text
QA State Report
- triage: <healthy|degraded|broken> / <next action>
- qa: <run id | skipped>
- scope: <none|smoke|targeted|broad|release-gate>
- decision: go | conditional | no-go | not_applicable
- next: <single best action>
```

## Related Skills

- `state-triage` - 현재 상태/근본 원인/다음 액션 분석
- `qa-ops` - QA 실행과 reports/qa 기록
- `env-sync` - env drift 의심 시 선행

## Changelog

- 2026-04-25: v2.2.0 - `state-triage` + `qa-ops` thin wrapper로 축소해 중복 제거
- 2026-04-25: v2.1.0 - Cloud Run URL 하드코딩 제거
- 2026-04-02: v2.0.0 - `state-triage`와 `qa-ops`를 통합. Next.js MCP 연동 및 데이터 패리티 체크 강화
