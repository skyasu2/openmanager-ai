---
name: playwright-triage
description: Triage and diagnose Playwright E2E test failures. Use when E2E tests fail or need debugging.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# Playwright E2E Test Triage

## Purpose

Systematically triage Playwright E2E test failures, categorize root causes, and provide actionable fix recommendations.

## Trigger Keywords

- "/playwright-triage"
- "E2E test failed"
- "playwright debug"
- "E2E 실패 분류"
- "test triage"

## Context

- **Project**: OpenManager AI v8.0.0
- **Test Framework**: Playwright
- **Test Location**: `tests/e2e/*.spec.ts`
- **Config**: `playwright.config.ts`
- **Critical Tests**: smoke, guest access, a11y

## Workflow

### 1. Identify Failures

```bash
# Run critical E2E tests
npm run test:e2e:critical 2>&1 | tail -40
```

**If targeting specific test**:
```bash
npx playwright test tests/e2e/<test-name>.spec.ts --reporter=list 2>&1
```

### 2. Collect Failure Details

```bash
# Check test results
ls -la test-results/ 2>/dev/null

# Check for screenshots/traces
find test-results/ -name "*.png" -o -name "*.zip" 2>/dev/null | head -10
```

### 3. Categorize Failure Type

| Category | Symptoms | Common Fix |
|----------|----------|------------|
| **Timeout** | "Timeout 30000ms exceeded" | Increase timeout, check server startup |
| **Selector** | "locator resolved to 0 elements" | Update selector, check component rendering |
| **Network** | "net::ERR_CONNECTION_REFUSED" | Ensure dev server running, check port |
| **Auth** | "Unauthorized", redirect to login | Check test auth setup, session mock |
| **Flaky** | Passes sometimes, fails sometimes | Add waitFor, stabilize async operations |

### 4. Server Status Check

```bash
# Is dev server running?
curl -s http://localhost:3000/api/health 2>&1 | head -5

# Check if port is in use
lsof -i :3000 2>/dev/null | head -5
```

### 5. Trace Analysis (if available)

```bash
# Open trace viewer for failed test
npx playwright show-trace test-results/<test-folder>/trace.zip 2>/dev/null
```

### 6. Report Summary

```
Playwright Triage Results
- Total Tests: N
- Passed: N
- Failed: N
- Skipped: N
- Failure Categories:
  - Timeout: N
  - Selector: N
  - Network: N
  - Auth: N
  - Other: N
- Recommended Actions:
  1. [action]
  2. [action]
```

## Edge Cases

**Case 1: All tests timeout**
- Check: Dev server not running
- Action: `npm run dev` in separate terminal, then re-run

**Case 2: WSL-specific failures**
- Check: Display server for headed mode
- Action: Use `--headed=false` (default) in WSL

**Case 3: Port conflict**
- Check: Another process on port 3000
- Action: Kill process or use `--base-url=http://localhost:3001`

## Success Criteria

- All critical E2E tests pass (smoke, guest, a11y)
- Failure root causes identified and categorized
- Actionable fix recommendations provided
- Flaky tests identified and marked

## Related Skills

- `lint-smoke` - Pre-commit quality check
- `next-router-bottleneck` - Performance issues affecting E2E

## Changelog

- 2026-02-12: v1.0.0 - Initial implementation
