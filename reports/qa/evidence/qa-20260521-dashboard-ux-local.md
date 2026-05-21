# QA Evidence - Dashboard UX Local Targeted

> Owner: project
> Status: Active
> Doc type: QA Evidence
> Last reviewed: 2026-05-21
> Tags: qa,dashboard,ux,local-dev

## Target

- Environment: local dev
- URL: `http://localhost:3000/dashboard`
- Source: Playwright MCP + Next DevTools MCP
- Scope: dashboard UX targeted verification

## Checks

| Check | Result | Evidence |
|---|---|---|
| Dashboard route renders after dev-server restart | PASS | `page.goto('/dashboard')`, title `Dashboard \| OpenManager AI` |
| Next runtime diagnostics | PASS | `nextjs_call get_errors`: `No errors detected in 1 browser session(s).` |
| Browser console warnings/errors | PASS | Playwright console messages: `Errors: 0, Warnings: 0` |
| Server search by text | PASS | Query `cache` returned `cache-redis-dc1-01/02/03` only |
| Search empty state | PASS | Query `zz-not-found` displayed `검색 결과 없음` and guidance copy |
| Search restore | PASS | Clearing query restored top server cards |
| View mode labels and grid toggle | PASS | `목록/그리드` controls present; grid `aria-pressed=true` after toggle |
| Metric trend delta layout | PASS | Compact cards display value and `↑/↓/—` delta on separate lines without the previous overlap |

## Side Effects Found And Resolved

- Stale Next dev bundle initially failed to see new `design-constants` exports. Restarting the dev server cleared the runtime error, and a fresh session reported no Next errors.
- Compact server cards initially rendered metric delta text on the same line as metric values, causing overlap. `MetricItem` now uses a two-line value/delta layout and smaller sparkline height.
- `DashboardContent` stats propagation produced a dev runtime maximum update depth warning. `DashboardInteractiveShell` now skips state updates when the incoming `DashboardStats` values are unchanged.

## Skipped

- Vercel production QA: skipped because the changes are uncommitted local work.
- Conversational AI QA: skipped because no AI prompt, routing, tool, provider, or response contract changed.
- Cloud Run observability/admin checks: skipped because this was a frontend dashboard UX change.
