# Review Checklist

## 6 Perspectives

### 1. Correctness
- Requirements are fully met by the implementation.
- No logic errors or broken contracts.
- State transitions are deterministic (no races).
- Null/undefined/error paths are handled.

### 2. Readability
- Names clearly describe purpose.
- Code structure follows the flow of logic.
- No unnecessary complexity or indirection.
- Comments explain "why", not "what".

### 3. Design
- Single Responsibility Principle respected.
- DRY: no duplicated logic across files.
- Abstraction level is appropriate (not over/under-engineered).
- Coupling is explicit, not hidden.

### 4. Performance
- No O(n^2) or worse in hot paths.
- Payload sizes are reasonable.
- No unnecessary API calls or re-renders.
- Memory is released on all exit paths.

### 5. Security
- Input validation and boundary handling are explicit.
- Auth and rate-limit order is intentional.
- Logging does not expose sensitive values.
- Trust boundaries are clearly defined.

### 6. Test Coverage
- At least one test covers each new branch with business impact.
- Tests assert behavior (not implementation details only).
- Edge cases are covered for critical paths.
- If tests are skipped, reason and risk are documented.

## Domain-specific checks

### Next.js API route checks
- Request schema and normalized payload are both validated.
- Stream/timeout behavior matches client expectations.

### AI/streaming checks
- Resume/stop/abort interactions are deterministic.
- Session/owner binding is stable across reconnect.
- Retry/fallback paths cannot loop indefinitely.
