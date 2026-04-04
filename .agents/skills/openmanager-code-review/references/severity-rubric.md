# Severity Rubric

Use this rubric consistently across reviews.

## P0 (Release blocker)
- Security exploit path or privilege bypass
- Data loss/corruption risk
- Outage-causing defect with no safe fallback

## P1 (High)
- Common user path regression likely
- Broken API contract affecting callers
- Retry/timeout/abort bug causing stuck or duplicate execution

## P2 (Medium)
- Edge-case functional break
- Performance/cost inefficiency with user-visible impact
- Missing guard for uncommon but realistic input

## P3 (Low)
- Clarity, naming, refactor, test debt
- Non-blocking robustness improvements

## Escalation rule
- If impact is uncertain but blast radius could be broad, classify one level higher.
- If test evidence is missing for critical paths, do not mark `go`.
