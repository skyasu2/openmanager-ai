# Vercel Reporter And Analyst MCP Check

- Date: 2026-04-27 KST
- Target: https://openmanager-ai.vercel.app
- Deployment: dpl_9Ni1cic8moLhSj3YXfhkLrDDkNkp
- Version: 8.11.36
- Source: Playwright MCP browser session

## Reporter

- Opened `자동장애 보고서` from the AI sidebar.
- Empty state and `첫 보고서 생성하기` CTA rendered.
- Generated a fresh incident report through `POST /api/ai/incident-report`.
- Network result: 200.
- Browser-observed duration: about 2984ms.
- Result: `Redis 서버 메모리 과부하 경고`.
- Root-cause summary: `메모리 사용량 증가`, confidence `80%`.
- Impacted server: `cache-redis-dc1-01`.
- Counts shown: 18 total, 17 normal, 1 caution, 0 risk.
- Reporter state was preserved after switching to Analyst and back.

## Analyst

- Opened `이상감지/예측` from the AI sidebar.
- Started full-system analysis for 18 servers.
- Network result: 18 `POST /api/ai/intelligent-monitoring` requests, all 200.
- Browser-observed request durations ranged from about 973ms to 10186ms.
- Result showed full-system state: 17 normal, 1 caution, 0 risk.
- Main issue: `cache-redis-dc1-01` memory `86%`.
- Per-server detail for `cache-redis-dc1-01` rendered current state, one-hour prediction, and AI insight sections.
- Previous `NaN` style regression was not observed.

## Quality Notes

- AI Chat and Reporter quality were acceptable for a targeted QA pass.
- Analyst functionally works, but the trend summary still needs polish:
  - Several trend rows display missing target values as `--`.
  - `storage-nfs-dc1-02 - CPU 24%` appears under main issues, which reads like a low-priority or false-positive issue without enough context.
- Recommendation: keep the release gate green, but track Analyst trend formatting/issue-ranking polish as non-blocking improvement.

## Console And Usage

- Browser console messages: 0 errors, 0 warnings.
- Vercel usage check after the run: effective `17.7346 USD`, billed `0.0000 USD`, chargeCount `15834`.
