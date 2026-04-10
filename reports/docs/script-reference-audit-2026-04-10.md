# Script Reference Audit (2026-04-10)

> Owner: dev-experience
> Status: Active
> Doc type: Report
> Last reviewed: 2026-04-10
> Canonical: reports/docs/script-reference-audit-2026-04-10.md
> Tags: scripts,artifacts,hygiene,audit

## Summary

최신 `npm run artifacts:scripts:audit` 기준으로 `scripts/` 아래 파일 `103`개를 점검했습니다.

- runtime referenced: `103`
- docs-only: `0`
- test-only: `0`
- unreferenced: `0`

이 리포트의 목적은 파일 존재 자체가 아니라 실제 실행/호출 표면에 연결되어 있는지 확인하고, 잘못된 위치의 개발 산출물을 정리하기 위한 근거를 남기는 것입니다.

## Method

검사 기준은 다음과 같습니다.

1. runtime surface
- `package.json`
- `.gitlab-ci.yml`
- `.github/**`
- `.husky/**`
- `.codex/**`, `.mcp.json`, `.claude/**`
- `cloud-run/**`
- `scripts/**` 내부의 상대 import/require

1. docs/test surface
- `docs/**`, `reports/docs/**`, `reports/planning/**`, `reports/history/**`
- `tests/**`

1. ignored noise
- `.bak`, `.tmp`, `.orig` 류 백업 파일은 reference source에서 제외
- `scripts/**/*.md`는 실행 스크립트 inventory에서 제외

## Findings

### 1. Active automation is mostly healthy

대부분의 스크립트는 `package.json`, hook, CI, MCP 설정, 또는 스크립트 간 상대 import로 실제 연결되어 있습니다. `scripts/` 전체가 무질서하게 쌓인 상태는 아니며, 현재 문제는 일부 manual/legacy 파일이 active tree 안에 섞여 있다는 점입니다.

### 2. First cleanup batch executed

다음 high-confidence legacy/manual 파일 5개는 실제 제거했습니다.

```text
scripts/setup/.bashrc_claude_additions
scripts/test/diagnose-login-error.cjs
scripts/test/supabase-token-setup.cjs
scripts/test/verify-oauth-config.cjs
scripts/validation/create-summary.sh
```

제거 근거는 다음과 같습니다.

- runtime/test/docs surface 어디에도 연결되지 않음
- 수동 가이드 또는 레거시 로컬 helper에 가까움
- 일부는 하드코딩된 경로/암호화 키/root 로그 경로를 사용함

### 3. Second cleanup batch executed

다음 manual SQL/asset/WSL 파일 7개는 runtime tree 밖의 archive로 이동했습니다.

```text
scripts/data/check_server_tables.sql
scripts/data/create-ai-logs-table.sql
scripts/data/create_server_metrics_simple.sql
scripts/data/pgvector_functions.sql
scripts/grafana/dashboard.json
scripts/supabase/cleanup-unused-tables.sql
scripts/wsl/fix-wsl-config.ps1
```

archive destination:

```text
reports/history/legacy-scripts/2026-04-10/
```

### 4. Third cleanup batch executed

다음 코드 helper 3개는 실제 호출점이 없고, 모두 존재하지 않는 `./types`를 import하고 있어 제거했습니다.

```text
scripts/data/pipeline-helpers.ts
scripts/data/otel/otel-log-processor.ts
scripts/data/otel/otel-resource-builder.ts
```

제거 근거는 다음과 같습니다.

- `otel-fix.ts`, `otel-verify.ts` 등 활성 엔트리포인트에서 import되지 않음
- script reference audit 기준 호출점 미발견
- `./types` import가 깨져 있어 독립 유지 가치가 낮음

### 5. Current state

현재 기준에서 runtime/test/docs surface 밖에 남은 스크립트는 없습니다.

### 6. Best-practice interpretation

현재 운영 원칙은 다음과 같이 정리하는 것이 맞습니다.

- active automation: `scripts/`
- durable evidence/report: `reports/`
- temporary or reproducible local output: `tmp/`
- operator guidance/manual snippets: `docs/`

따라서 unreferenced 파일 중에서도 특히 아래 유형은 `scripts/`에 두는 것이 부적절합니다.

- 수동 가이드성 `.cjs` 파일
- one-off SQL 조각
- 로컬 셸 dotfile 조각
- 사용자 머신 복구용 PowerShell
- 정적 dashboard JSON asset

## Candidate Assessment

### Executed cleanup batch

| Path | Reason removed |
|---|---|
| `scripts/setup/.bashrc_claude_additions` | 구 프로젝트 경로를 하드코딩한 로컬 셸 조각 |
| `scripts/test/diagnose-login-error.cjs` | 실행형 스크립트가 아니라 수동 진단 가이드 출력 |
| `scripts/test/supabase-token-setup.cjs` | 하드코딩된 암호화 키와 레거시 파일 경로 사용 |
| `scripts/test/verify-oauth-config.cjs` | 수동 체크리스트와 production HTTP 호출 혼합 |
| `scripts/validation/create-summary.sh` | `logs/validation`에 산출물을 쓰는 legacy 요약 스크립트 |

### Manual SQL candidates

이 항목들은 자동 마이그레이션 체계에 묶여 있지 않은 SQL 조각이었고, 이번 배치에서 archive로 이동했습니다.

| Path | Assessment | Recommended action |
|---|---|---|
| `scripts/data/check_server_tables.sql` | 수동 점검 SQL | archive 완료 |
| `scripts/data/create-ai-logs-table.sql` | schema 생성 SQL이지만 migration 체계 미편입 | archive 완료 |
| `scripts/data/create_server_metrics_simple.sql` | 테스트 데이터 주입 SQL | archive 완료 |
| `scripts/data/pgvector_functions.sql` | DB 함수 정의 SQL, runtime/migration 미편입 | archive 완료 |
| `scripts/supabase/cleanup-unused-tables.sql` | 운영용 수동 정리 SQL | archive 완료 |

### Code/asset candidates needing a keep-or-remove decision

| Path | Assessment | Recommended action |
|---|---|---|
| `scripts/data/pipeline-helpers.ts` | 호출점 부재 + `./types` import 깨짐 | 제거 완료 |
| `scripts/data/otel/otel-log-processor.ts` | 호출점 부재 + `./types` import 깨짐 | 제거 완료 |
| `scripts/data/otel/otel-resource-builder.ts` | 호출점 부재 + `./types` import 깨짐 | 제거 완료 |
| `scripts/grafana/dashboard.json` | 정적 Grafana asset, script가 아님 | archive 완료 |
| `scripts/wsl/fix-wsl-config.ps1` | 사용자 머신 복구용 수동 스크립트 | archive 완료 |

## Changes Applied In This Step

1. `scripts/grafana/otlp-export.ts` 기본 출력 경로를 `tmp/grafana/otlp-export`로 이미 이동했습니다.
2. `scripts/dev/audit-script-references.js`를 추가해 reference source 기반 분석이 가능하도록 했습니다.
3. `scripts/README.md`에 script liveness 원칙과 manual/legacy 성격을 명시했습니다.
4. high-confidence manual/legacy 파일 5개를 실제 제거했습니다.
5. manual SQL/asset/WSL 파일 7개를 `reports/history/legacy-scripts/2026-04-10/`로 archive했습니다.
6. 남은 dead code helper 3개를 제거해 `scripts/` audit unreferenced `0` 상태를 만들었습니다.

## Commit Readiness

현재는 broad worktree 상태이므로 이 결과만으로 커밋하는 것은 권장하지 않습니다.

- commit now: `No`
- reason: 기존 QA/artifact/dev-env 변경과 이번 audit tooling이 한 worktree에 섞여 있음
- preferred next step: cleanup 범위를 commit unit으로 분리

## Next Recommended Batch

가장 안전한 다음 배치는 아래 3개입니다.

1. 이번 cleanup 범위만 별도 commit unit으로 분리
2. 이후 unrelated artifact/dev-env 변경과 섞이지 않게 검증 후 staging
3. 필요 시 `scripts/` cleanup 정책을 pre-push report에 연결
