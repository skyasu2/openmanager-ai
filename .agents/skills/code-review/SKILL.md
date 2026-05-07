---
name: code-review
description: Perform OpenManager code reviews with evidence-based findings, regression risk checks, and clear go/no-go reporting. Use formal severity-first review for merge/release readiness, and pragmatic review when the user asks for plain engineering judgment.
---

# OpenManager Code Review

> Common baseline: before editing this skill, review `docs/guides/ai/skill-standards.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Run practical code reviews from 7 perspectives that surface real defects and release risks.

## Review Mode Selection

- **Formal gate review**: Use the full severity-first format when the user asks for merge readiness, release readiness, commit approval, security review, regression hunting, or explicit go/no-go judgment.
- **Pragmatic/plain review**: When the user asks for "just your review", "스킬 영향 없이", "느낌", or practical engineering judgment, lead with the concise conclusion and the highest-impact risks. Keep the tone direct and less template-heavy.
- In every mode, surface P0/P1 blockers, missing evidence, and security/correctness risks. Do not hide material risk to make a plain review feel smoother.
- Only analyze or disclose skill influence when the user explicitly asks for it.

## Review Perspectives (7-관점)

| # | Perspective | Key Checks |
|---|------------|------------|
| 1 | **Correctness** | Requirements met, logic flaws, regression, state races, missing null/error paths |
| 2 | **Readability** | Naming, structure, misleading abstractions, why-comments present |
| 3 | **Complexity** | Understandable in 60s, no AI-generated unnecessary layers, no function >40 lines without reason, no nesting >3 levels |
| 4 | **Design** | SRP, DRY, appropriate abstraction level, hidden coupling |
| 5 | **Performance** | Time/space complexity, unnecessary computation, payload bloat, expensive defaults |
| 6 | **Security** | OWASP Top 10, auth gaps, privilege scope, secret leakage, unsafe trust boundaries |
| 7 | **Test Quality** | Risk/Pareto focus, contract fidelity, mock integrity, pesticide-paradox risk, critical branches without high-signal tests |

## Testing methodology checks

- Use `docs/guides/testing/test-strategy.md` as the testing methodology SSOT.
- Flag mock-only or inline-fetch tests that can pass without exercising the real route/schema/handler boundary.
- Prefer risk-focused representative tests over broad test count growth. Coverage percentage is not a release argument.
- Check pesticide-paradox risk: repeated hardcoded happy-path mocks should be rotated, strengthened with shared schema/normalizer guards, or removed.
- Treat live LLM/cloud/network tests as opt-in QA evidence, not a requirement for default merge readiness.

## Execute this workflow

1. Confirm review scope first.
- `git status --short`
- `git diff --name-only`
- If scope is large, focus on files touched in this task and any directly coupled files.

1. Collect execution evidence.
- Run targeted tests for changed area first.
- If core behavior changed and no targeted tests exist, run at least one broader safety check (`npm run test:quick` or equivalent).
- Do not claim "safe" without command evidence or a clear reason why tests could not run.

1. Apply scope-adaptive perspectives.
- **Code changes**: apply all 7 perspectives.
- **Config/doc changes**: focus on Correctness + Readability + Design; apply Security/Performance only when relevant.
- Record each finding with its perspective label.

1. Assign severity for each finding.
- `P0` Release blocker: exploitable security issue, data loss/corruption, hard outage.
- `P1` High risk: likely user-facing breakage/regression in normal use.
- `P2` Medium risk: edge-case failure, degraded UX, operational friction.
- `P3` Low risk: clarity/test debt/non-blocking improvements.
- Escalation rule: if impact uncertain but blast radius broad, classify one level higher.
- **Vibe coding rule**: Security and Correctness findings are auto-escalated one level higher (AI-generated code carries ~2.7× XSS risk and ~1.75× logic error rate).

1. Report findings first, with proof.
- For each finding include: severity, perspective, file path + line, user impact, and minimal fix direction.
- If no findings, state that explicitly and list residual risks/test gaps.

1. Decide release readiness.
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
- Complexity: <count> findings
- Design: <count> findings
- Performance: <count> findings
- Security: <count> findings
- Test Quality: <count> findings

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
