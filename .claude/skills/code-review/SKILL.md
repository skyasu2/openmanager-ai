---
name: code-review
description: Agile 6-perspective severity-first code review with evidence-based findings and release decision.
version: v2.1.0
user-invocable: true
allowed-tools: Bash, Read, Grep
---

# Code Review

6가지 관점에서 기능/리스크 중심 리뷰를 수행하고, 릴리스 가능 여부를 판정합니다.

## Trigger Keywords

- "/review"
- "코드 리뷰"
- "리스크 분석"
- "머지 가능 여부"

## Review Perspectives (6-관점)

| # | 관점 | 핵심 체크 |
|---|------|----------|
| 1 | **Correctness** (정확성) | 요구사항 충족, 로직 결함, 회귀 |
| 2 | **Readability** (가독성) | 네이밍, 구조, 불필요 복잡도 |
| 3 | **Design** (설계) | SRP, DRY, 적절한 추상화 수준 |
| 4 | **Performance** (성능) | 시간/공간 복잡도, 불필요 연산, 메모리 |
| 5 | **Security** (보안) | OWASP Top 10, 입력 검증, 인증/인가 |
| 6 | **Test Coverage** (테스트) | 커버리지 갭, 엣지케이스, 테스트 품질 |

## Workflow

1. 리뷰 범위 확인.
- `git status --short`
- `git diff --name-only`
- 범위가 넓으면 이번 변경 파일 + 직접 연관 파일 우선

2. 실행 증거 수집.
- 변경 영역 대상 테스트 우선 실행
- 대상 테스트가 없으면 최소 `npm run test:quick` 실행
- 테스트 미실행 시 이유와 잔여 리스크를 보고서에 명시

3. Scope-adaptive 관점 적용.
- **코드 변경**: 6-관점 전체 적용
- **설정/문서 변경**: Correctness + Readability + Design 중심, Security/Performance는 해당 시만
- 각 관점에서 발견된 항목을 기록

4. Severity 분류.
- `P0`: 릴리스 차단 (보안 치명/데이터 손상/서비스 중단)
- `P1`: 높은 회귀 위험 (일반 사용자 경로 영향)
- `P2`: 중간 위험 (엣지케이스 실패/운영 마찰)
- `P3`: 낮은 위험 (비차단 개선/테스트 부채)
- Escalation: 영향 불확실하지만 blast radius가 넓으면 한 단계 상향

5. Findings 우선 보고.
- 항목별 필수 포함:
  - severity
  - perspective (어떤 관점에서 발견)
  - file:line
  - impact
  - minimal fix
- 발견 없으면 명시적으로 "no findings" + 잔여 리스크/검증 갭 기술

6. 릴리스 판정.
- `go`: P0/P1 없음 + 핵심 경로 증거 확보
- `conditional`: P2/P3만 존재 + 후속 계획 명확
- `no-go`: P0/P1 미해결 또는 핵심 증거 부족

충분한 증거 기준:
- 코드 변경: 최소 1개 관련 테스트 통과 또는 수동 검증 기록
- 설정 변경: 변경 전후 동작 일관성 확인
- 증거 없이 "go" 판정 금지

## Output Format

```text
Code Review Findings

Perspective Summary
- Correctness: <count> findings
- Readability: <count> findings
- Design: <count> findings
- Performance: <count> findings
- Security: <count> findings
- Test Coverage: <count> findings

Findings
- [P1][Security] <title>
  file: <path:line>
  impact: <user/service impact>
  fix: <minimal fix direction>

- [P2][Performance] <title>
  file: <path:line>
  impact: <user/service impact>
  fix: <minimal fix direction>

Open Questions / Assumptions
- <if any>

Validation Evidence
- <command>: pass|fail|not run

Release Decision
- go | conditional | no-go
- rationale: <one sentence>
```

## Related Skills

- `git-workflow` - 리뷰 후 커밋/푸시
- `lint-smoke` - 사전 품질 검증

## Changelog

- 2026-02-17: v2.1.0 - scope-adaptive 관점, escalation 규칙, 충분한 증거 기준 추가
- 2026-02-17: v2.0.0 - Agile 6-관점(Correctness/Readability/Design/Performance/Security/Test Coverage) 확장
- 2026-02-16: v1.0.0 - 신규 생성 (증거 기반 severity 리뷰 표준)
