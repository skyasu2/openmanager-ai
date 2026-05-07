# v8.11.112 AI Assistant Scroll and Internal Disclosure Evidence

- Target: `https://openmanager-ai.vercel.app`
- Release: `v8.11.112`
- Commit: `89628b5f2effdf7f246169741022fbcba3e7145e`
- GitLab tag pipeline: `2505951845` success
- Production version smoke: `/`, `/login`, `/api/version` passed after propagation attempt 24/81

## Desktop Layout

Production route: `/dashboard/ai-assistant`

Viewport: `1440x900`

```json
{
  "document": { "scrollHeight": 900, "clientHeight": 900, "overflowY": "auto" },
  "body": { "scrollHeight": 900, "clientHeight": 900, "overflowY": "auto" },
  "main": { "scrollHeight": 900, "clientHeight": 900, "overflowY": "visible" },
  "scrollables": [
    "AI 대화 메시지 internal log panel",
    "System Context internal panel"
  ]
}
```

Result: page-level double scroll was not present. Only intended inner panels scroll.

## Mobile Layout

Viewport: `390x844`

```json
{
  "document": { "scrollHeight": 844, "clientHeight": 844, "overflowY": "auto" },
  "body": { "scrollHeight": 844, "clientHeight": 844, "overflowY": "auto" },
  "main": { "scrollHeight": 844, "clientHeight": 844, "overflowY": "visible" },
  "scrollables": [
    "AI 대화 메시지 internal log panel"
  ]
}
```

Result: mobile page-level double scroll was not present.

## Internal Disclosure Guard

Cloud Run direct supervisor request without `internalDisclosureMode`:

```json
{
  "success": true,
  "toolsCalled": [],
  "metadata": {
    "provider": "deterministic",
    "modelId": "internal-path-policy",
    "stepsExecuted": 0,
    "durationMs": 3
  }
}
```

Returned response refused internal state, implementation file paths, repository structure, and private knowledge-base locations in general user mode.

PIN guest/developer mode was used only to access the production AI Assistant page for layout verification.
