# Commands

## Root smoke checks

```bash
npm run test:quick
npm run type-check
npm run lint
```

## Contract-sensitive checks

```bash
npm run test:contract
```

Run this in addition to root smoke when the change can affect request/response
contracts, auth/session flow, env-driven routing, or deploy-time runtime behavior.

## Optional changed-file checks

```bash
npm run type-check:changed
npm run lint:changed
```

## AI engine checks (only when cloud-run/ai-engine changed)

```bash
cd cloud-run/ai-engine
npm run type-check
npm run test
```
