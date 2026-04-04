---
name: openmanager-code-review
description: Perform Agile 6-perspective severity-first code review for OpenManager changes with evidence-based findings, regression risk checks, and clear go/no-go reporting. Use when the user asks for a review, risk analysis, merge readiness, or bug/regression hunting.
version: v1.0.0
user-invocable: true
---

# OpenManager Code Review

Run practical code reviews from 6 perspectives that surface real defects and release risks.

## Review Perspectives (6-관점)

| # | Perspective | Key Checks |
|---|------------|------------|
| 1 | **Correctness** | Requirements met, logic flaws, regression, state races, missing null/error paths |
| 2 | **Readability** | Naming, structure, unnecessary complexity, misleading abstractions |
| 3 | **Design** | SRP, DRY, appropriate abstraction level, hidden coupling |
| 4 | **Performance** | Time/space complexity, unnecessary computation, payload bloat, expensive defaults |
| 5 | **Security** | OWASP Top 10, auth gaps, privilege scope, secret leakage, unsafe trust boundaries |
| 6 | **Test Coverage** | Coverage gaps, edge cases, test quality, critical branches without tests |

## Execute this workflow

1. Confirm review scope first.
- `git status --short`
- `git diff --name-only`
- If scope is large, focus on files touched in this task and any directly coupled files.

2. Collect execution evidence.
- Run targeted tests for changed area first.
- If core behavior changed and no targeted tests exist, run at least one broader safety check (`npm run test:quick` or equivalent).
- Do not claim "safe" without command evidence or a clear reason why tests could not run.

3. Apply scope-adaptive perspectives.
- **Code changes**: apply all 6 perspectives.
- **Config/doc changes**: focus on Correctness + Readability + Design; apply Security/Performance only when relevant.
- Record each finding with its perspective label.

4. Assign severity for each finding.
- `P0` Release blocker: exploitable security issue, data loss/corruption, hard outage.
- `P1` High risk: likely user-facing breakage/regression in normal use.
- `P2` Medium risk: edge-case failure, degraded UX, operational friction.
- `P3` Low risk: clarity/test debt/non-blocking improvements.
- Escalation rule: if impact uncertain but blast radius broad, classify one level higher.

5. Report findings first, with proof.
- For each finding include: severity, perspective, file path + line, user impact, and minimal fix direction.
- If no findings, state that explicitly and list residual risks/test gaps.

6. Decide release readiness.
- `go`: no P0/P1 and no unbounded unknowns.
- `conditional`: only P2/P3 with clear follow-up.
- `no-go`: any P0/P1 unresolved or critical test evidence missing.

Sufficient evidence criteria:
- Code changes: at least 1 related test passing or manual verification recorded.
- Config changes: pre/post behavioral consistency confirmed.
- Never issue "go" without evidence.

## Output format

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
  impact: <what breaks and for whom>
  fix: <minimal actionable direction>

- [P2][Performance] <title>
  file: <path:line>
  impact: <what breaks and for whom>
  fix: <minimal actionable direction>

Open Questions / Assumptions
- <if any>

Validation Evidence
- <command>: pass|fail|not run

Release Decision
- go | conditional | no-go
- rationale: <one sentence>
```

## References

- `references/review-checklist.md`
- `references/severity-rubric.md`
- `references/report-template.md`
