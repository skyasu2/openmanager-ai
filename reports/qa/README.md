# QA Reports

서버 모니터링 AI 어시스턴트의 QA 결과를 누적 저장하고, 개선 완료/추가 개선 필요 상태를 추적합니다.

## Directory Layout

```text
reports/qa/
├── QA_STATUS.md                    # 자동 생성 대시보드
├── qa-tracker.json                 # 누적 메타/요약/상태 SSOT
├── production-qa-2026-02-25.md     # 레거시 기준 리포트(참고)
├── evidence/                       # run JSON artifacts에 연결된 durable evidence만 보관
├── repro/
│   └── YYYY/                       # post-mortem / 실패 재현용 보조 증거 아카이브
├── templates/
│   └── qa-run-input.example.json   # 신규 QA 입력 템플릿
└── runs/
    └── YYYY/
        └── qa-run-QA-YYYYMMDD-XXXX.json
```

## Workflow

1. 템플릿 복사 후 입력값 작성
- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- `scope`, `releaseFacing`, `coveragePacks`, `coveredSurfaces`, `skippedSurfaces`를 현재 QA 범위에 맞게 채운다.
- Playwright/CI 증거가 있으면 `artifacts`에 `trace/report/screenshot/video`를 구조화해 남긴다.
- `reports/qa/**/*.md` 변경은 `npm run docs:lint:changed` 검증 범위에 포함된다. QA 운영 문서를 바꿨다면 push 전에 함께 확인한다.
- 증거 분류 기준:
  - `reports/qa/evidence/...`: run JSON `artifacts[].path`에 직접 연결되는 durable evidence만 둔다.
  - `reports/qa/repro/YYYY/...`: post-mortem, 실패 재현, 원인 분석 보조 증거를 둔다.
  - scratch/local capture는 `.playwright-mcp/screenshots`, `test-results`, `/tmp` 같은 비추적 경로에 둔다.
- `source`가 `playwright`, `playwright-cli`, `playwright-mcp` 계열이면 `qa:record`는 최근 Playwright artifact를 자동 수집한다.
- 기본 디렉토리나 시간 창을 바꾸려면 `playwrightArtifacts.reportDir/resultsDir/screenshotsDir/recentMinutes/pathIncludes`를 입력 JSON에 명시한다.
- 수동 MCP QA는 shared `.playwright-mcp/screenshots`를 쓰므로, run별 파일 prefix를 붙이고 `pathIncludes`로 함께 좁혀 fresh artifact only 원칙을 지킨다.
- `releaseFacing: true` 또는 `countsTowardSummary: true` run은 durable artifact만 허용한다. `playwright-report/`, `test-results/`, `.playwright-mcp/screenshots/`, `artifacts/`, root `qa*.png` 같은 로컬 임시 경로는 금지하고, URL 또는 `reports/qa/evidence/...` 추적 경로만 사용한다.
- release-facing/counting run에서 로컬 Playwright 결과를 증거로 남길 때는 먼저 `reports/qa/evidence/...`로 복사하거나 CI/Vercel URL로 전환한 뒤 기록한다.
- release-facing/counting run의 로컬 evidence 파일명은 `qa-YYYYMMDD-<slug>.<ext>` 형식을 사용한다. 예: `reports/qa/evidence/qa-20260406-dashboard-landing.png`
- release-facing/counting run에서는 이전 run에서 이미 기록한 동일 `artifact.path`를 재사용하지 않는다. 같은 surface를 다시 검증해도 새 slug 파일로 복사해 run별 증거를 분리한다.
- 커밋 기준:
  - `countsTowardSummary=true` 또는 `releaseFacing=true` run의 evidence는 run JSON `artifacts`에 연결된 파일만 커밋한다.
  - non-counting supporting evidence도 커밋하려면 run JSON 또는 repro 문서에서 참조되어야 한다.
  - 참조되지 않는 파일은 `reports/qa/evidence/`에 두지 않는다.
- GitHub Actions `workflow_dispatch`로 실행한 `E2E Critical`은 성공해도 `playwright-report-${run_id}`, `playwright-results-${run_id}` artifact를 3일간 보존하므로, CI 기반 QA 증거 링크로 재사용할 수 있다.
- 로컬 Playwright browser launch가 막히는 환경에서는 GitHub Actions `workflow_dispatch`의 `run_manual_feedback_trace_status=true`를 사용해 production feedback trace QA를 원격에서 실행하고, `manual-feedback-trace-report-${run_id}` / `manual-feedback-trace-results-${run_id}` artifact를 증거로 재사용한다.
- CI 근거를 재사용할 때는 `ciEvidence`에 `workflowName`, `runId`, `artifacts[]`를 넣어 `GitHub Actions run/artifact` 링크를 표준 라벨로 자동 생성한다.
- feedback observability QA에서는 `/api/ai/feedback` 응답의 `traceUrlStatus`를 1차 runtime contract로 기록한다.
- `traceUrlStatus=available`이면 `traceUrl`을 direct Langfuse UI 증거로 함께 남기고, `traceUrlStatus=unavailable`이면 `traceApiUrl`/`monitoringLookupUrl`를 운영 증거로 남긴다.
- 같은 run에서 `/monitoring/traces?q=<traceId>` 검색 결과가 비어 있어도, sampling 특성상 non-blocking일 수 있으므로 `traceUrlStatus`/direct link 증거와 분리해 해석한다.
- observability pack에서 `/monitoring` / `/monitoring/traces`를 확인할 때는 `https://openmanager-ai.vercel.app/...`가 아니라 `CLOUD_RUN_AI_URL`의 direct `run.app` host를 사용한다.
- Cloud Run admin observability endpoint는 `X-API-Key: $CLOUD_RUN_API_SECRET` 인증이 필요하므로, Vercel surface QA와 같은 기준으로 404를 해석하면 안 된다.
- mode audit를 확인한 run이면 `notes`에 최소 1줄 이상 요약을 남긴다.
  - 권장 형식: `mode audit: requested-mode-auto dominant, auto-resolved-single 70%, auto-resolved-multi 30%, single_disallowed_upgrade 0`
  - 비율을 바로 산출하기 어렵다면 `resolved-mode-multi spike 없음`, `single_disallowed_upgrade 0 확인`처럼 정성 요약만 남겨도 된다.
- Langfuse score 기반 운영 증거는 새 스키마를 만들지 않고 기존 `links`에 남긴다.
  - trace 상세 링크는 `langfuse-trace`
  - dashboard/custom dashboard/filter URL은 `general`
  - Cloud Run `/monitoring` 조회 URL은 `monitoring`
- dashboard/AI parity QA에서는 최소 1개 서버를 잡아 `dashboard raw metric`과 `AI getServerMetrics`를 같은 run에 같이 기록한다.
- parity run covered surface 권장 형식:
  - `dashboard raw metric (storage-nfs-dc1-01 DISK 82% Warning)`
  - `dashboard dataSlotInfo label (Synthetic OTel snapshot · 23:50 KST slot 143/143)`
  - `dashboard dataSourceInfo label (Dataset v1.0.0 · catalog 2026-02-15 03:56Z)`
  - `AI getServerMetrics dataSlot field ({ slotIndex: 143, minuteOfDay: 1430, timeLabel: 23:50 KST })`
  - `AI getServerMetrics dataSource field ({ scopeName: openmanager-ai-otel-pipeline, scopeVersion: 1.0.0, catalogGeneratedAt: 2026-02-15T03:56:41.821Z, hour: 23 })`
- parity 판정은 raw 숫자와 AI의 전체 요약 문장을 1:1로 비교하지 않고, 같은 슬롯/같은 데이터 묶음인지부터 먼저 확인한다.
- Vercel production의 `broad`/`release-gate` 또는 `releaseFacing: true` run이면 `environment.deploymentId`, `environment.commitSha`를 함께 기록한다.
- `qa:record`는 누락 시 현재 Git의 `branch`/`HEAD SHA`를 자동 보강하고, `VERCEL_*` system env가 있으면 `deploymentId`/`deploymentUrl`/`url`도 함께 보강한다.

1. QA 결과 기록
- `npm run qa:record -- --input /tmp/qa-run-input.json`
- 기본값은 `reports/qa/*` 리포트만 갱신한다. public snapshot(`public/data/qa/validation-evidence.json`)은 자동 갱신하지 않는다.
- public snapshot이 정말 필요할 때만:
  - `npm run qa:status -- --write --sync-public`
  - 또는 `npm run qa:evidence:build`

1. 요약 확인
- `npm run qa:status`
- `npm run qa:status -- --write`
- `npm run qa:evidence:audit`
- public snapshot까지 같이 반영하려면 `npm run qa:status -- --write --sync-public`
- `reports/qa/QA_STATUS.md` 확인
- `qa:status -- --write`는 `QA_STATUS.md`와 trend artifacts만 재생성한다.
- `npm run qa:status -- --write --sync-public`는 `QA_STATUS.md`와 `public/data/qa/validation-evidence.json`을 명시적으로 함께 재생성한다.
  - 단, proof/public evidence 계약이 아직 없으면 `qa:status`는 실패하지 않고 public evidence 갱신을 skip 로그로 남긴다.
  - 이 경우 stale `public/data/qa/validation-evidence.json`이 남아 있으면 자동으로 제거해 tracker/public evidence drift를 방지한다.

1. Vercel 실환경 QA/배포 뒤 사용량 확인
- `npm run check:usage` 또는 `npm run check:usage:vercel`
- CLI 확인이 불가하면 Vercel Usage 대시보드를 수동 확인
- 확인 결과는 QA 입력 JSON의 `usageChecks`에 기록
- `usageChecks.status`는 **수집 상태**(`checked` | `skipped` | `failed`)를 의미한다.
- `usageChecks.result`는 **해석 결과**(`normal` | `concern` | `unknown`)를 의미한다.

## Tracking Rules

- `qa-tracker.json`이 상태 추적 SSOT입니다.
- 개선 항목은 `id` 기준으로 누적됩니다.
- `usageChecks`는 실환경 QA/배포 후 사용량 확인 근거를 남기는 필드입니다.
  - Vercel Production의 `broad`/`release-gate` 또는 `releaseFacing: true` run이면 `platform: "vercel"` 항목이 최소 1건 필수
  - `status`는 수집 상태를 의미합니다: `checked` | `skipped` | `failed`
  - `result`는 비용/사용량 판정 결과를 의미합니다: `normal` | `concern` | `unknown`
- `scope`는 QA 범위를 의미합니다: `smoke` | `targeted` | `broad` | `release-gate`
- `releaseFacing`은 이 run이 실제 릴리즈 게이트 성격인지 명시합니다.
- `coveragePacks`는 표준화된 커버 묶음입니다.
  - 허용 값: `core-routes-smoke`, `dashboard-core`, `ai-core`, `ai-advanced-surface`, `modal-detail-pack`, `security-pack`, `observability-pack`
  - Vercel production의 `broad`/`release-gate` run이면 최소 `core-routes-smoke`, `dashboard-core`, `ai-core`가 필요합니다.
- `artifacts`는 Playwright/CI 증거를 위한 구조화 필드입니다.
  - 허용 값: `playwright-trace`, `playwright-report`, `playwright-screenshot`, `playwright-video`, `playwright-console`, `playwright-network`
  - 각 항목은 `type`, `label`, `url|path`를 가집니다.
  - `path`를 쓸 때는 기록 시점에 실제 파일이 존재해야 합니다.
  - `releaseFacing: true` 또는 `countsTowardSummary: true` run에서는 `path`가 `reports/qa/evidence/...` 아래의 Git tracked durable path여야 합니다. `playwright-report/`, `test-results/`, `.playwright-mcp/screenshots/`, `artifacts/`, root `qa*.png`, 기타 임의 tracked 경로는 허용되지 않습니다.
  - 같은 run의 로컬 evidence 파일명은 `qa-YYYYMMDD-<slug>.<ext>` 형식이어야 합니다. 날짜는 KST 기준 run 실행일을 사용합니다.
  - release-facing/counting run에서는 과거 run에 이미 기록된 동일 `artifact.path`를 재사용할 수 없습니다. evidence 파일은 run별로 고유해야 합니다.
  - `playwright-trace`에 `url`이 있으면 `qa:record`가 `trace.playwright.dev` viewer URL을 자동 생성합니다.
- `artifactDebt`는 과거 counted/release-facing run에 contemporaneous durable evidence가 남아 있지 않을 때만 쓰는 예외 필드입니다.
  - 허용 값: `status: "acknowledged"`
  - 필수: `kind`, `reason`
  - 권장: `recordedAt`, `recordedBy`
  - 새 run의 artifact requirement를 우회하는 용도가 아니라, historical truth를 보존하면서 audit가 "미정리 오류"와 "인정된 과거 부채"를 구분하도록 만드는 용도입니다.
- `links`는 사람이 보는 관련 링크 필드입니다.
  - 허용 값: `general`, `vercel-deployment`, `github-actions-run`, `github-actions-artifact`, `monitoring`, `langfuse-trace`
  - `qa:record`는 `ciEvidence`가 있으면 `links`에 GitHub Actions run/artifact 링크를 자동 병합합니다.
  - feedback trace QA에서는 `traceUrlStatus`를 notes나 covered surface에 함께 남깁니다.
  - `traceUrlStatus=available`이면 `traceUrl`을 `langfuse-trace`로 우선 기록합니다.
  - `traceUrlStatus=unavailable`이면 `traceApiUrl`를 `langfuse-trace`, `monitoringLookupUrl`를 `monitoring`으로 기록하는 방식을 우선합니다.
  - mode audit dashboard URL은 `general`로 기록하고, label에 `Langfuse mode audit`를 포함해 사람이 구분 가능하게 남깁니다.
- `ciEvidence`는 GitHub Actions 기반 QA 증거를 표준화하는 필드입니다.
  - 현재 지원 provider: `github-actions`
  - 필수: `runId`
  - 선택: `workflowName`, `owner`, `repo`, `runUrl`, `branch`, `commitSha`, `artifacts[]`
  - `owner`/`repo`를 비우면 `GITHUB_REPOSITORY` 또는 `git origin`에서 추론합니다.
  - artifact URL이 없으면 workflow run URL로 연결하고, note에 artifact 이름을 남깁니다.
- `playwrightArtifacts`는 로컬 Playwright 산출물을 자동 수집하는 옵션입니다.
  - 기본값: `reportDir=playwright-report`, `resultsDir=test-results`, `screenshotsDir=.playwright-mcp/screenshots`, `recentMinutes=180`, `pathIncludes=[]`
  - `source`가 `playwright`, `playwright-cli`, `playwright-mcp` 계열이면 옵션이 없어도 기본값으로 자동 수집을 시도합니다.
  - `playwright-mcp`는 MCP server `--output-dir .playwright-mcp/screenshots`에 저장된 최신 screenshot을 `playwright-screenshot`으로 자동 연결합니다.
  - 최근 수정된 파일만 수집하므로 오래된 실패 산출물은 기본적으로 제외됩니다.
  - `pathIncludes`를 주면 `test-results`와 `.playwright-mcp/screenshots`에서 경로에 해당 문자열이 포함된 artifact만 수집합니다.
  - 이 자동 수집 경로는 verification/targeted evidence에는 적합하지만, release-facing/counting run에서는 그대로 사용할 수 없습니다. 필요한 파일은 durable repo path로 옮기거나 URL로 바꿔 기록합니다.
- `coveredSurfaces` / `skippedSurfaces`는 사용자 보고 텍스트가 아니라 run SSOT에도 저장해야 합니다.
- `observability-pack`은 Vercel dashboard observability와 Cloud Run admin observability를 혼동하지 않도록 기록합니다.
  - Vercel-side 예: dashboard server-status summary, system resource panel, resource alert top5, notification badge, `/api/health`
  - Cloud Run-side 예: `CLOUD_RUN_AI_URL/monitoring`, `CLOUD_RUN_AI_URL/monitoring/traces`
  - Vercel-side만 확인한 런이면 Cloud Run admin surface를 `skippedSurfaces`에 명시합니다.
- `environment.deploymentId` / `environment.commitSha`는 release-facing 실환경 QA의 배포 증거 필드입니다.
  - Vercel production의 `broad`/`release-gate` 또는 `releaseFacing: true` run이면 둘 다 기록합니다.
  - 누락 시 `qa:record`는 현재 Git/`VERCEL_*` 환경에서 자동 보강을 시도하지만, 해석 불가능한 경우에는 계속 오류로 막습니다.
- 전문가 영역 평가는 `expertAssessments`에 기록합니다.
  - Vercel Production의 `broad`/`release-gate` 또는 `releaseFacing: true` run이면 최소 1건 필수
  - 핵심 필드: `domainId`, `fit`, `improvementNeeded`, `nextAction`
  - 권장 6개 도메인:
    - `ai-quality-assurance`
    - `observability-monitoring`
    - `ai-security-reliability`
    - `sre-devops`
    - `test-automation`
    - `data-metrics-quality`
- 동일 `id`가 반복 기록될 때:
  - `completedImprovements`에 있으면 해당 항목 상태를 `completed`로 갱신
  - `pendingImprovements`에 있으면 `record-qa-run.js`가 `isBlocking`/우선순위 정책에 따라 `pending` 또는 `wont-fix`로 정리
  - `dodChecks`에 있는 항목도 동일 규칙으로 병합 (`completed` > `pending` 우선)
- 오버엔지니어링 방지 규칙(미확정 항목 자동 WONT-FIX):
  - `isBlocking` 미지정 시 `P0/P1`은 기본 `true`, `P2`는 기본 `false`
  - `P2` 기본 비차단 항목은 `pending` 전달 시 `wont-fix`로 자동 기록(완료 지표에서 제외)
  - 단, 재현 여부나 제품 의도 판정이 끝나지 않은 조사성 관찰은 추적 손실 방지를 위해 `pendingImprovements`에 `isBlocking: true`로 일시 유지할 수 있음
  - 이 예외를 사용할 때는 `note`에 `release-blocking 아님` 또는 `tracking-only`를 명시해 실제 릴리즈 차단 여부를 분리해 적는다
  - 과도 항목은 템플릿의 `overengineeringScope`에 근거를 남겨 다음 런에서도 의도 추적 가능
  - 예외적으로 개선 우선순위가 높다고 판단되면 `isBlocking: true`로 명시
- `QA_STATUS.md`는 `qa:record` 실행 시 자동 재생성됩니다.
- `qa:status`는 기본적으로 `qa-tracker.json`만 읽는 read-only 요약 명령입니다.
- 대시보드를 수동으로 다시 맞출 때만 `npm run qa:status:sync` 또는 `npm run qa:status -- --write`를 사용합니다.
- validation evidence snapshot은 stale `summary`를 그대로 신뢰하지 않고, `runs/items/experts` 기반으로 파생 필드를 self-heal한 뒤 다시 생성합니다.
- `qa:evidence:audit`는 다음을 점검합니다.
  - `reports/qa/evidence` 아래 고아 durable evidence
  - run JSON이 참조하지만 실제 파일이 없는 artifact path
  - counted run인데 artifacts가 비어 있는 historical debt warning
  - 단, `artifactDebt.status="acknowledged"`가 붙은 run은 별도 acknowledged debt로 분리 집계합니다.

## Reporting Style

- QA run 데이터는 상세하게 저장하되, 사용자 응답은 상황에 맞게 요약합니다.
- 항상 필요한 최소 정보:
  - `target`, `run id`, `scope`, `checks`, 최종 판정
- 다음 항목은 관련 있을 때만 답변에 포함합니다.
  - `deploymentId`, `commitSha`
  - `coveragePacks`
  - `artifacts`
  - `coveredSurfaces`, `skippedSurfaces`
  - `usageChecks`
  - `expertAssessments` / open gaps
  - `next priority`
- smoke/targeted 재검증 결과는 broad release QA와 동일한 무게로 서술하지 않습니다.

## Recommended Evidence Naming

- release/counting run의 로컬 evidence는 `reports/qa/evidence/qa-YYYYMMDD-<surface-slug>.<ext>` 형식을 기본값으로 사용합니다.
- `<surface-slug>`는 확인한 화면/엔드포인트/팩을 그대로 드러내는 `kebab-case`를 사용합니다.
  - 권장: `dashboard-landing`, `login-guest-pin`, `system-boot-redirect`, `ai-sidebar-ready`, `api-version-response`, `reporter-summary`
  - 비권장: `final`, `new`, `step1`, `test`, `capture`
- 같은 run에서 여러 장을 남길 때는 surface를 더 구체화합니다.
  - 예: `qa-20260406-dashboard-alert-top5.png`
  - 예: `qa-20260406-ai-sidebar-cpu-summary.png`
- 확장자는 artifact 타입과 맞춥니다.
  - screenshot: `.png`
  - trace bundle: `.zip`
  - html report: `.html`
  - console/network dump: `.txt` 또는 `.json`
- 기존 파일을 덮어쓰지 말고, 같은 surface를 재검증할 때도 새 slug 파일로 분리합니다.

## AI Timing Header Rule

- Vercel production에서 AI timing 검증 시 운영 SSOT는 `X-AI-Latency-Ms`와 `X-AI-Processing-Ms`입니다.
- `Server-Timing`은 로컬 Next.js dev에서는 확인될 수 있지만, Vercel production의 스트리밍/프록시 응답에서는 제거될 수 있으므로 릴리즈 게이트의 필수 조건으로 사용하지 않습니다.
- `Server-Timing`은 가능하면 함께 기록하되, 값이 비어 있어도 `X-AI-*` 헤더가 있으면 timing observability는 합격으로 판정합니다.

## DoD Closeout Playbook

- 기준선:
  - [Definition of Done](/docs/reference/project/definition-of-done.md)
  - [Production QA Baseline](/reports/qa/production-qa-2026-02-25.md)
- 실행 로드맵:
  - [DoD Closeout Roadmap](/reports/qa/dod-closeout-roadmap.md)
- 기본 원칙:
  - DoD 항목은 `completed`/`pending`/`wont-fix`를 구분하여 추적하고, 해결 시 `completedImprovements`로 전환
  - `wont-fix`는 의도적으로 미개선 처리된 항목으로, 오버엔지니어링 억제 관점의 결정값
- 우선순위:
  - `P0`: 릴리즈 차단 게이트 (예: tsc/lint zero-error)
  - `P1`: 릴리즈 보증 필수 항목 (예: 단위/통합, 보안 회귀, 모니터링 정량화)
  - `P2`: 보강/문서/운영 효율 항목
- 진행 순서:
  - 1. Release DoD 게이트(검증 명령) 기록
  - 1. DoD 미충족 항목을 pending으로 정리
  - 1. 개선 후 같은 `id`를 `completedImprovements`에 반영해 전환
  - 1. `npm run qa:status`로 open 갭 추적

## Recommended Item ID Convention

- 형식: `kebab-case`
- 예시:
  - `modal-backdrop-close`
  - `landing-main-landmark`
  - `login-copy-alignment`
