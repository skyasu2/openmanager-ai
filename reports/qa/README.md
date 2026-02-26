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

2. QA 결과 기록
- `npm run qa:record -- --input /tmp/qa-run-input.json`

3. 요약 확인
- `npm run qa:status`
- `reports/qa/QA_STATUS.md` 확인

## Tracking Rules

- `qa-tracker.json`이 상태 추적 SSOT입니다.
- 개선 항목은 `id` 기준으로 누적됩니다.
- 전문가 영역 평가는 `expertAssessments`에 기록합니다.
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
  - 과도 항목은 템플릿의 `overengineeringScope`에 근거를 남겨 다음 런에서도 의도 추적 가능
  - 예외적으로 개선 우선순위가 높다고 판단되면 `isBlocking: true`로 명시
- `QA_STATUS.md`는 기록 시마다 자동 재생성됩니다.

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
