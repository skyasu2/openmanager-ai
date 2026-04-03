# Report Template

```text
Code Review Findings

Perspective Summary
- Correctness: 0 findings
- Readability: 0 findings
- Design: 0 findings
- Performance: 1 finding
- Security: 1 finding
- Test Coverage: 0 findings

Findings
- [P1][Security] Example finding title
  file: src/example.ts:42
  impact: user requests can fail when payload is empty
  fix: add non-empty guard before downstream call

- [P2][Performance] Unnecessary re-fetch on mount
  file: src/hooks/useData.ts:15
  impact: doubled API calls on page load
  fix: add staleTime to query config

Open Questions / Assumptions
- Assumed this route is public in guest mode.

Validation Evidence
- npm run test:quick: pass
- npm run type-check: pass

Release Decision
- conditional
- rationale: no blocker found, but one P1 remains unresolved
```
