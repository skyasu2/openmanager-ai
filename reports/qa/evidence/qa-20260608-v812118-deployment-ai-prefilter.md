# QA Evidence - v8.12.118 Deployment And AI Prefilter Smoke

Recorded: 2026-06-08 KST

## Scope

Targeted production deployment validation for `v8.12.118`, including the AI Engine ambiguous status query prefilter fix.

## Evidence

- GitLab tag pipeline `2584020593` succeeded for `v8.12.118`.
- Release commit: `0486fe674c36026ea40c3e422c22d5797d594f4b`.
- Frontend `/api/version` returned `version=8.12.118`, `releaseTag=v8.12.118`, and the release commit SHA.
- Frontend `/api/health` returned `success=true`, `status=healthy`, and `version=8.12.118`.
- Cloud Run AI Engine `/health` returned `status=ok` and `version=8.12.118`.
- Cloud Run latest ready revision: `ai-engine-00615-znz`.
- Cloud Run free-tier guard passed: maxScale `1`, concurrency `16`, timeout `300`, cpu `1`, memory `512Mi`, cpu throttling `true`.
- Vercel usage check passed: effective `4.5381 USD`, billed `0.0000 USD`.
- Cloud Run `/monitoring` unauthenticated request returned `403`, authenticated request returned `200`.

## AI Prefilter Smoke

Query: `상태 어때?`

```json
{
  "shouldHandoff": false,
  "confidence": 0.9,
  "expectedBehavior": "Direct response (fast path)",
  "directResponseIncludes": "전체 서버 상태 알려줘"
}
```

Query: `전체 서버 상태 어때?`

```json
{
  "shouldHandoff": true,
  "suggestedAgent": "Metrics Query Agent",
  "confidence": 0.86,
  "expectedBehavior": "Forced routing to Metrics Query Agent"
}
```

## Pre-Deploy Local Validation

- `npm run root:artifacts:audit:strict`
- `npm run test:contract`
- `npm run type-check`
- `npm run lint`
- `npm run test:quick`
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`
- `cd cloud-run/ai-engine && SKIP_RUN=true npm run docker:preflight`

## Result

Deployment validation passed. The ambiguous short status query now returns a direct clarification instead of entering the LLM/NLQ timeout path, while specific status queries still route to Metrics Query Agent.
