---
name: lint-smoke
description: Automated lint and test smoke check. Use when verifying code quality before commit or deployment.
version: v1.1.0
user-invocable: true
allowed-tools: Bash, Read, Grep
---

# Lint & Test Smoke Check

**Target Token Efficiency**: 62% (300 tokens → 114 tokens)

## Purpose

Automated lint + test workflow for quick code quality verification without manual commands.

## Trigger Keywords

- "check code quality"
- "quality check"
- "run lint and tests"
- "lint check"
- "smoke check"
- "verify code"
- "validate code"
- "pre-commit check"
- "quality gate"
- "코드 검증"
- "test파일 실행"
- "품질 체크"

## Context

- **Project**: OpenManager AI v8.0.0
- **Test Framework**: Vitest v4.0.18
- **Linter**: Biome v2.3.8 (lint + format)
- **Current Pass Rate**: 100% (206/206 tests)
- **Fast Test Target**: < 25초 (current: ~10초)

## Workflow

### 0. Pre-Check: Biome Configuration

**Verify Biome settings**:

```bash
# Check Biome configuration
cat biome.json | head -30
```

**Expected Configuration**:

- ✅ `linter.enabled`: true
- ✅ `formatter.enabled`: true
- ✅ TypeScript strict mode: enforced via tsconfig.json
- ✅ `noExplicitAny`: via TypeScript compiler

**If Missing**:

```
⚠️ Warning: Biome 설정 누락 감지
권장: biome.json 확인 필요
  - linter.enabled: true
  - formatter.enabled: true
```

### 1. Run Lint Check

```bash
npm run lint
```

**Expected Output**:

- ✅ No Biome errors
- ⚠️ Warnings acceptable if < 5개
- ❌ Errors require immediate fix

**Auto-Fix Detection**:

If errors are detected, check for auto-fixable issues:

```bash
# Attempt auto-fix for common issues
npx biome check --write .

# Re-verify after auto-fix
npm run lint
```

**Common Auto-Fixable Issues**:

- Formatting inconsistencies
- Import order violations
- Trailing whitespace
- Unused imports

**Manual Fix Required**:

- TypeScript type errors (via `npm run type-check`)
- Logic errors in code flow
- Complex refactoring needs

### 2. Run Fast Tests

```bash
npm run test:quick
```

**Expected Metrics**:

- Duration: < 25초 (current: ~10초)
- Pass Rate: ≥ 98% (206/206)
- Failed Tests: < 5개

### 3. Analyze Results

**If All Pass**:

- ✅ Code quality verified
- ✅ Ready for commit
- Action: Proceed with git commit

**If Lint Fails**:

- ❌ Fix Biome errors first
- Run: `npx biome check --write .` (if auto-fixable)
- Re-run lint check

**If Tests Fail**:

- 📊 Check failure count vs baseline (0 failed)
- ⚠️ New failures: Investigate immediately
- ✅ Same failures: Known issues, can proceed

### 4. Report Summary

**Format**:

```
🧪 Smoke Check Results
├─ Lint: ✅ Pass / ❌ Fail (N errors)
├─ Tests: ✅ 206/206 (100%) / ⚠️ X/206 (Y%)
├─ Duration: Xs (target: <25s)
└─ Status: ✅ Ready / ⚠️ Review / ❌ Fix Required
```

## Token Optimization Strategy

**Before (Manual)**:

```
User: "코드 품질 체크해줘"
Assistant: [reads package.json, explains lint, explains test, runs commands, parses output, formats report]
Tokens: ~300
```

**After (Skill)**:

```
User: "check code quality"
Skill: [executes workflow, reports summary]
Tokens: ~114 (62% reduction)
```

**Efficiency Gains**:

- ❌ No need to explain npm scripts
- ❌ No need to read test config
- ✅ Direct command execution
- ✅ Structured output format

## Edge Cases

**Case 1: Timeout**

- If test > 30초: Stop and report timeout
- Likely cause: Environment issue
- Action: Check WSL resources, restart dev server

**Case 2: Zero Tests Run**

- Possible config issue
- Check: `vitest.config.ts`
- Verify: `setupFiles` path correct

**Case 3: All Tests Fail**

- Critical environment issue
- Check: Node.js version (v24.x)
- Check: Dependencies installed (`npm ci`)

## Success Criteria

- Lint: 0 errors (Biome)
- Tests: Pass rate ≥ 98%
- Duration: < 25초
- No manual intervention required

## Related Skills

- `performance/next-router-bottleneck.md` - If performance issues detected
- `playwright/triage.md` - If E2E tests need debugging

## Changelog

- 2025-12-22: v1.2.1 - Version sync with project v5.85.0
- 2025-12-12: v1.2.0 - Tech stack upgrade alignment
  - Vitest 3.2.4 → 4.0.15
  - ESLint → Biome v2.3.8 migration
  - Updated test metrics (98.2% pass rate)
  - Updated auto-fix commands for Biome
- 2025-11-24: v1.1.0 - Enhanced trigger coverage (Phase 1.1 Optimization)
  - Added 2 new trigger keywords: "quality check", "lint check" (10 → 12 total)
  - Improved Skill discoverability and auto-activation
- 2025-11-08: Enhanced with auto-fix detection and ESLint config verification (Phase 1 Optimization)
  - Added 5 new trigger keywords (10 total)
  - Added auto-fix suggestion logic for common issues
  - Added ESLint strict mode configuration verification
- 2025-11-04: v1.0.0 - Initial implementation (Phase 1)
