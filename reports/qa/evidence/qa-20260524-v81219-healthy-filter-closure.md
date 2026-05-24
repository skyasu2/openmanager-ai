# QA-20260524-0576 Evidence - v8.12.19 Healthy Filter Closure

Recorded by Codex on 2026-05-24 11:45 KST.

## Target

- Vercel UI: https://openmanager-ai.vercel.app
- Version: `8.12.19`
- Commit: `197e762aa1e64d16beda2a1bb77a109ad5b11160`
- GitLab pipeline: `2548694499`
- Cloud Run `/health`: `status=ok`, `service=ai-engine`, `version=8.12.19`
- Vercel usage check: PASS, billed `0.0000 USD`

## Prompt Result

Prompt: `현재 정상 범위인 서버 목록 보여줘`

Result: Pass.

Observed response:

- Returned `📋 정상 범위 서버 목록`
- Included criteria: `상태 online`, `CPU < 80%`, `메모리 < 90%`, `디스크 < 85%`
- Listed `17` normal-range servers at data slot `11:40 KST`
- Included concrete server IDs and metrics, for example:
  - `api-was-dc1-02 (CPU 77%, 메모리 58%, 디스크 33%)`
  - `web-nginx-dc1-03 (CPU 17%, 메모리 38%, 디스크 26%)`
- Did not return the previous generic `서버 현황 요약` / `주의 서버` response.

Validation:

- Playwright CLI production one-prompt spec passed.
- `/api/version` reported `8.12.19`, commit `197e762aa1e64d16beda2a1bb77a109ad5b11160`.
- GitLab tag pipeline `2548694499` succeeded, including frontend deploy, Cloud Run AI Engine deploy, and both post-deploy smoke jobs.
