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

## Vibe coding escalation rule
- This project is developed solo via vibe coding (AI-generated code only).
- All Security and Correctness findings are automatically escalated one level higher.
  - P3 Security/Correctness → P2
  - P2 Security/Correctness → P1
  - P1 Security/Correctness → P0
- Rationale: AI-generated code carries ~2.7× higher XSS risk and ~1.75× higher logic error rate vs. human-written code (empirical).
