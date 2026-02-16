---
description: Run 6-perspective severity-first code review (delegates to code-review skill)
---

`code-review` 스킬을 실행하여 6-관점 severity 기반 리뷰를 수행합니다.

## Workflow

### Step 1: Scope & Evidence

- `git status --short`
- `git diff --name-only`
- 변경 영역 대상 테스트 실행 (없으면 `npm run test:quick`)

### Step 2: 6-Perspective Review

| # | 관점 | 핵심 |
|---|------|------|
| 1 | Correctness | 로직 결함, 회귀 |
| 2 | Readability | 네이밍, 불필요 복잡도 |
| 3 | Design | SRP, DRY, 추상화 수준 |
| 4 | Performance | 복잡도, 불필요 연산 |
| 5 | Security | OWASP Top 10, 인증/인가 |
| 6 | Test Coverage | 커버리지 갭, 엣지케이스 |

### Step 3: Scope-Adaptive Depth

- **코드 변경**: 6-관점 전체 적용
- **설정/문서 변경**: Correctness + Readability + Design 중심, Security/Performance는 해당 시만

### Step 4: Severity & Output

- `P0`: release blocker | `P1`: high | `P2`: medium | `P3`: low
- Escalation: 영향 불확실하지만 blast radius가 넓으면 한 단계 상향

```text
Code Review Findings

Perspective Summary
- Correctness/Readability/Design/Performance/Security/Test Coverage: <count> each

Findings
- [P1][Security] <title>
  file: <path:line>
  impact: <description>
  fix: <direction>

Validation Evidence
- <command>: pass|fail|not run

Release Decision
- go | conditional | no-go
- rationale: <one sentence>
```
