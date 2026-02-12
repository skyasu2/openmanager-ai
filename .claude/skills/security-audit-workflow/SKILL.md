---
name: security-audit-workflow
description: OWASP Top 10 security audit for the project. Use when reviewing security posture, before deployment, or after major changes.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# Security Audit Workflow

## Purpose

Perform an OWASP Top 10 security audit across the codebase, identifying vulnerabilities in authentication, input validation, API security, and dependency management.

## Trigger Keywords

- "/security-audit-workflow"
- "security audit"
- "OWASP check"
- "security review"

## Context

- **Project**: OpenManager AI v8.0.0
- **Stack**: Next.js 16.1, React 19.2, Supabase Auth, Vercel AI SDK v6
- **Auth**: GitHub OAuth via Supabase
- **API**: REST + Server Actions
- **Relevant Config**: `src/app/api/`, `src/middleware.ts`, `next.config.mjs`

## Workflow

### 1. Dependency Vulnerability Scan

```bash
npm audit --production 2>&1 | tail -20
```

**Expected**:
- 0 critical vulnerabilities
- 0 high vulnerabilities
- Low/moderate: document and assess

### 2. Authentication & Authorization Review

```bash
# Check auth middleware coverage
grep -r "getServerSession\|createClient\|auth()" src/app/api/ --include="*.ts" -l

# Check unprotected API routes
grep -rL "getServerSession\|createClient\|auth()\|middleware" src/app/api/ --include="route.ts"
```

**Check**:
- All mutation endpoints require authentication
- Public endpoints are intentionally public (health, version)
- CSRF protection enabled

### 3. Input Validation Audit

```bash
# Check for unvalidated inputs
grep -rn "req.body\|request.json()\|searchParams.get" src/app/api/ --include="*.ts" | head -20

# Check for Zod/schema validation usage
grep -r "z\.object\|zodSchema\|parse(\|safeParse(" src/app/api/ --include="*.ts" -l
```

**Expected**:
- All user inputs validated with Zod schemas
- No raw `req.body` usage without validation

### 4. Injection Prevention

```bash
# SQL injection vectors (should use parameterized queries)
grep -rn "sql\`\|\.raw(\|execute(" src/ --include="*.ts" | grep -v node_modules | head -10

# XSS vectors (unsafe HTML rendering)
grep -rn "dangerouslySet\|innerHTML" src/ --include="*.tsx" | head -10
```

**Expected**:
- Parameterized queries only (Supabase client handles this)
- No unsafe HTML rendering without sanitization

### 5. Secrets & Configuration

```bash
# Hardcoded secrets check
grep -rn "password\|secret\|api_key\|apikey\|token" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env\|import\|type\|interface\|//" | head -10

# Environment variable exposure
grep -rn "NEXT_PUBLIC_" .env.local 2>/dev/null | head -10
```

**Expected**:
- All secrets via `process.env`
- Only safe values in `NEXT_PUBLIC_` vars

### 6. Security Headers

```bash
# Check next.config headers
grep -A 20 "headers" next.config.mjs | head -30

# Check CSP, CORS settings
grep -rn "Content-Security-Policy\|Access-Control" src/ --include="*.ts" | head -10
```

### 7. Report Summary

```
Security Audit Results
- Dependencies: Pass/Warn/Fail (critical: N, high: N)
- Auth Coverage: Pass/Fail (N/M routes protected)
- Input Validation: Pass/Fail (N unvalidated endpoints)
- Injection Prevention: Pass/Fail (SQL: N, XSS: N)
- Secrets Management: Pass/Fail (N hardcoded found)
- Security Headers: Pass/Fail (CSP, CORS, HSTS)
- Overall: Pass / Review / Critical
```

## Edge Cases

**Case 1: npm audit fails**
- Check: Network connectivity
- Action: Try `npm audit --registry=https://registry.npmjs.org`

**Case 2: False positives in secret detection**
- Type definitions and comments may match
- Action: Manually verify each finding

## Success Criteria

- 0 critical/high vulnerabilities in dependencies
- All mutation API routes require authentication
- All user inputs validated with schemas
- No hardcoded secrets in source code
- Security headers configured

## Related Skills

- `lint-smoke` - Code quality baseline check
- `observability-check` - Monitoring and error tracking

## Changelog

- 2026-02-12: v1.0.0 - Initial implementation
