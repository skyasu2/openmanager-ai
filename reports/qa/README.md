# QA Reports

서버 모니터링 AI 어시스턴트의 QA 결과를 누적 저장하고, 개선 완료/추가 개선 필요 상태를 추적합니다.

## Directory Layout

```text
reports/qa/
├── QA_STATUS.md                    # 자동 생성 대시보드
├── qa-tracker.json                 # 누적 메타/요약/상태 SSOT
├── production-qa-2026-02-25.md     # 레거시 기준 리포트(참고)
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
- `source`가 `playwright` 또는 `playwright-cli`이고 최근 결과 파일이 남아 있으면 `qa:record`는 `playwright-report`와 `test-results`에서 artifact를 자동 수집한다.
- 기본 디렉토리나 시간 창을 바꾸려면 `playwrightArtifacts.reportDir/resultsDir/recentMinutes`를 입력 JSON에 명시한다.
- Vercel production의 `broad`/`release-gate` 또는 `releaseFacing: true` run이면 `environment.deploymentId`, `environment.commitSha`를 함께 기록한다.
- `qa:record`는 누락 시 현재 Git의 `branch`/`HEAD SHA`를 자동 보강하고, `VERCEL_*` system env가 있으면 `deploymentId`/`deploymentUrl`/`url`도 함께 보강한다.

2. QA 결과 기록
- `npm run qa:record -- --input /tmp/qa-run-input.json`

3. 요약 확인
- `npm run qa:status`
- `reports/qa/QA_STATUS.md` 확인

4. Vercel 실환경 QA/배포 뒤 사용량 확인
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
  - `playwright-trace`에 `url`이 있으면 `qa:record`가 `trace.playwright.dev` viewer URL을 자동 생성합니다.
- `playwrightArtifacts`는 로컬 Playwright 산출물을 자동 수집하는 옵션입니다.
  - 기본값: `reportDir=playwright-report`, `resultsDir=test-results`, `recentMinutes=180`
  - `source`가 `playwright` 또는 `playwright-cli`이면 옵션이 없어도 기본값으로 자동 수집을 시도합니다.
  - 최근 수정된 파일만 수집하므로 오래된 실패 산출물은 기본적으로 제외됩니다.
- `coveredSurfaces` / `skippedSurfaces`는 사용자 보고 텍스트가 아니라 run SSOT에도 저장해야 합니다.
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
- `QA_STATUS.md`는 기록 시마다 자동 재생성됩니다.

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
  - 1) Release DoD 게이트(검증 명령) 기록
  - 2) DoD 미충족 항목을 pending으로 정리
  - 3) 개선 후 같은 `id`를 `completedImprovements`에 반영해 전환
  - 4) `npm run qa:status`로 open 갭 추적

## Recommended Item ID Convention

- 형식: `kebab-case`
- 예시:
  - `modal-backdrop-close`
  - `landing-main-landmark`
  - `login-copy-alignment`
