---
name: observability-check
description: Check AI monitoring and observability stack (Langfuse, Sentry, OTel). Use when verifying monitoring health or diagnosing observability gaps.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# Observability Check

## Purpose

Verify the health and completeness of the AI monitoring stack including Langfuse traces, Sentry error tracking, and OpenTelemetry instrumentation.

## Trigger Keywords

- "/observability-check"
- "monitoring check"
- "observability status"
- "Langfuse check"
- "Sentry check"
- "모니터링 상태"

## Context

- **Project**: OpenManager AI v8.0.0
- **OTel SDK**: `src/lib/otel/otel-sdk.ts`
- **Service Name**: `openmanager-ai`
- **Sentry**: Error tracking + performance monitoring
- **Langfuse**: LLM trace observability
- **OTel Data**: `src/data/otel-processed/`

## Workflow

### 1. OTel Configuration Check

```bash
# Verify OTel SDK setup
grep -n "serviceName\|OTEL_\|instrumentationScope" src/lib/otel/otel-sdk.ts | head -10

# Check OTel environment variables
grep "OTEL_\|LANGFUSE_\|SENTRY_" .env.local 2>/dev/null | sed 's/=.*/=***/'
```

**Expected**:
- `serviceName: 'openmanager-ai'`
- OTEL exporter configured
- Environment variables present (values masked)

### 2. Sentry Integration Check

```bash
# Check Sentry config files
ls -la sentry.*.config.ts 2>/dev/null

# Check Sentry initialization
grep -rn "Sentry.init\|@sentry" src/ --include="*.ts" --include="*.tsx" | head -10

# Check Sentry DSN configured
grep "SENTRY_DSN\|NEXT_PUBLIC_SENTRY" .env.local 2>/dev/null | sed 's/=.*/=***/'
```

**Expected**:
- `sentry.client.config.ts` and `sentry.server.config.ts` present
- Sentry DSN configured in environment

### 3. Langfuse Integration Check

```bash
# Check Langfuse usage
grep -rn "langfuse\|Langfuse\|LANGFUSE" src/ --include="*.ts" --include="*.tsx" | head -10

# Check AI trace instrumentation
grep -rn "trace\|span\|generation" src/lib/ai/ --include="*.ts" | grep -i "langfuse\|observe" | head -10
```

**Expected**:
- Langfuse client initialized
- AI calls instrumented with traces

### 4. Error Boundary Coverage

```bash
# Check error boundaries in React components
grep -rn "ErrorBoundary\|error\.tsx\|error\.ts" src/app/ --include="*.tsx" --include="*.ts" -l

# Check API error handling
grep -rn "catch\|captureException\|reportError" src/app/api/ --include="*.ts" | head -10
```

**Expected**:
- Error boundaries at key layout levels
- API routes with proper error handling

### 5. OTel Data Integrity

```bash
# Verify OTel processed data exists
ls -la src/data/otel-processed/ | head -5

# Check resource catalog
grep "service.name" src/data/otel-processed/resource-catalog.json | head -3

# Verify hourly data count
ls src/data/otel-processed/hourly/ | wc -l
```

**Expected**:
- `resource-catalog.json` with `service.name: openmanager-ai`
- 24 hourly JSON files

### 6. Report Summary

```
Observability Check Results
- OTel SDK: Configured/Missing (service: openmanager-ai)
- Sentry: Active/Inactive (DSN: configured/missing)
- Langfuse: Active/Inactive (traces: N instrumented)
- Error Boundaries: N/M layouts covered
- OTel Data: N hourly files, catalog valid/invalid
- Overall: Healthy / Gaps Found / Critical
```

## Edge Cases

**Case 1: Missing environment variables**
- Check: `.env.local` may not have all keys
- Action: Compare with `.env.example` or Vercel dashboard

**Case 2: OTel data stale**
- Check: `resource-catalog.json` modification date
- Action: Run `npm run data:otel` to regenerate

**Case 3: Sentry over quota**
- Check: Sentry dashboard for rate limits
- Action: Review sample rate in `sentry.*.config.ts`

## Success Criteria

- OTel SDK properly configured with correct service name
- Sentry DSN configured and error boundaries in place
- Langfuse traces covering AI API calls
- OTel processed data valid and up-to-date
- No observability gaps in critical paths

## Related Skills

- `security-audit-workflow` - Security posture review
- `lint-smoke` - Code quality baseline

## Changelog

- 2026-02-12: v1.0.0 - Initial implementation
