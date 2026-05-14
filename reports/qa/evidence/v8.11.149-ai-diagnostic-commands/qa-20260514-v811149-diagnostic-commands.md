# QA Evidence - v8.11.149 AI Diagnostic Commands

- Target: https://openmanager-ai.vercel.app
- Version API: 8.11.149
- Commit: 487a8376802b61374d4c00a58eba97abaf4df8db
- Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2524461816
- Method: Vercel production, Playwright MCP browser automation
- Time: 2026-05-14 15:58 KST

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Landing/version API | PASS | `/api/version` returned `8.11.149`, release tag `v8.11.149` |
| Dashboard data | PASS | 18 servers loaded, 17 normal, 1 warning; `cache-redis-dc1-01` warning present |
| AI sidebar readiness | PASS | AI sidebar opened and chat input available |
| Fleet summary | PASS | `현재 모든 서버의 상태를 요약해줘` returned 18 total, 17 normal, 1 warning |
| CPU ranking | PASS | `CPU 사용률이 높은 서버 TOP3를 알려줘` returned top 3 list via metric ranking |
| Fleet summary + commands | PASS | `현재 상태 정상인지 요약해줘. 확인할 명령어도 같이 알려줘` returned read-only diagnostic commands |
| Warning server detail + commands | PASS | `cache-redis-dc1-01 서버 상태를 자세히 알려줘` returned read-only memory diagnostics |
| Action-needed + commands | PASS | `지금 당장 조치가 필요한 서버가 있어?` returned caution server and read-only diagnostics |
| Mutating command exclusion | PASS | No `service restart`, `systemctl restart`, `clear cache`, `apt-get clean`, `journalctl --vacuum`, `rm -rf`, or `kill -9` in checked answers |

## Diagnostic Commands Observed

```bash
# cache-redis-dc1-01 메모리
free -h
ps aux --sort=-%mem | head -10
vmstat 1 5
```

## Usage Check

`npm run check:usage:vercel` passed:

- effective: 8.7525 USD
- billed: 0.0000 USD
- chargeCount: 7917
