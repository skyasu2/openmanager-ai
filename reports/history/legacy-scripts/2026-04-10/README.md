# Legacy Scripts Archive (2026-04-10)

> Owner: dev-experience
> Status: Historical
> Doc type: Archive
> Last reviewed: 2026-04-10
> Canonical: reports/history/legacy-scripts/2026-04-10/README.md
> Tags: scripts,archive,legacy

이 디렉터리는 2026-04-10 스크립트 정리 작업에서 `scripts/` runtime tree 밖으로 이동한 수동/레거시 파일을 보관합니다.

## 이동 기준

- `package.json`, hook, CI, MCP 설정 어디에서도 호출되지 않음
- 팀 공통 자동화가 아니라 one-off SQL, 정적 asset, 개인 머신 복구 도구에 가까움
- `scripts/` 아래에 두면 활성 automation처럼 오인될 수 있음

## 포함 항목

- `scripts/data/*.sql`
- `scripts/grafana/dashboard.json`
- `scripts/supabase/cleanup-unused-tables.sql`
- `scripts/wsl/fix-wsl-config.ps1`

원 경로와 파일명은 provenance 유지를 위해 archive 안에서도 그대로 유지했습니다.
