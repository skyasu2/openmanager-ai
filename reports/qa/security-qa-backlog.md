# Security QA Backlog

> Owner: codex
> Status: Active
> Last reviewed: 2026-03-15

## Scope

이 문서는 런타임 결함이 아닌 보안 QA 체계/운영 범위 항목을 분리 추적한다.
해당 항목은 제품 결함 트래커의 WONT-FIX에서 분리하여 `Deferred` 백로그로 관리한다.

## Backlog Items

| ID | Title | Priority | Type | Status | Rationale | Next Action |
|---|---|---|---|---|---|---|
| `security-attack-regression-pack` | 보안 공격 시나리오 회귀팩 구축 | P1 | 운영 체계 | Deferred | 실운영형 보안 회귀팩은 데모/포트폴리오 기본 QA 범위를 초과 | 운영 전환 시점에 공격 시나리오 세트(EN/KO prompt injection, jailbreak, data exfiltration)를 정기 스모크에 편입 |
| `ai-code-gate-input-policy` | AI Code Gate: Prompt 패턴 15개 방어 점검 | P2 | 운영 체계 | Deferred | 정책 운영화/자동화 파이프라인은 현재 릴리즈 핵심 경로 밖 | QA 템플릿에 최소 5패턴 샘플을 우선 반영하고, 추후 15패턴 풀세트 자동화 |

## Out of Scope

- 일반 UI 회귀
- 기능 동작 자체의 런타임 결함

## Reference

- `reports/qa/qa-tracker.json`
- `reports/qa/runs/2026/qa-run-QA-20260313-0095.json`
