# Vitest, Storybook & Bundle Budget 활용 최적화 계획

> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-16

---

## 배경

2026-05-15 분석 결과, Vitest(v4.1.2)와 Storybook(v10.2.10) 모두 설치 및 활용 중이나
설정 파편화, 테스트 커버리지 공백, 번들 크기 회귀 감지 공백 등 비효율이 확인됨.

추가 테스트 도구 도입 평가는 `bundlemon`만 즉시 계획 범위에 포함한다.
Chromatic, Lighthouse CI, Codecov, Happy DOM 전면 전환은 현재 기본 게이트와 중복되거나 정책상 우선순위가 낮아 이 계획의 구현 범위에서 제외한다.

---

## 분석 결과 요약

### Vitest — 확인된 비효율

| 항목 | 현황 | 문제 |
|------|------|------|
| config 파일 수 | 12개 | 파편화 — `vitest.config.dev.ts` 등 package.json/CI 미사용 파일 존재 |
| `test:quick` (minimal config) | 하드코딩된 ~15개 파일 경로 | 새 파일 추가 시 자동 포함 안 됨, 유지보수 부담 |
| 커버리지 임계값 | 없음 (`enabled: false`) | 수집은 가능하지만 실패 게이트 없음 |
| CI validate gate | `test:quick` + `test:contract` | `test:dom` (jsdom 컴포넌트 테스트) CI에서 실행 안 됨 |

### Storybook — 확인된 비효율

| 항목 | 현황 | 문제 |
|------|------|------|
| `play:` 함수 | 공통 UI/로그인/부팅 일부 존재, 대시보드/AI 핵심 스토리는 부족 | 운영 핵심 상호작용 회귀 감지가 약함 |
| `autodocs` 태그 | **0개** | 자동 컴포넌트 문서 생성 안 됨 |
| `addon-vitest` | 설치됨, `test:storybook:experimental`에만 | CI 파이프라인 비연동 |
| `validate_storybook_smoke` CI | `.storybook/**`, `src/**/*.stories.*`, `src/components/**`, `src/app/**` 변경 시 트리거 | 기존 계획의 "스토리 변경 미트리거" 진단은 현재 `.gitlab-ci.yml` 기준으로 해소됨 |
| `addon-mcp` | `OPENMANAGER_STORYBOOK_MCP_MODE=on` 수동 필요 | 기본 비활성 |

### Bundle budget — 확인된 공백

| 항목 | 현황 | 문제 |
|------|------|------|
| 번들 분석 | `npm run bundle:analyze` 존재 | 수동 분석 중심, CI 회귀 게이트 아님 |
| 번들 크기 회귀 | 자동 감지 없음 | AI가 새 dependency/import를 추가해도 `type-check`, `lint`, 기능 테스트는 통과 가능 |
| 도입 후보 | `bundlemon` | 무료/오픈소스 CLI로 max size, base branch 대비 증가율, CI 실패/경고 구성 가능 |

---

## 개선 범위 및 Tasks

### P0: bundlemon 번들 크기 회귀 감지 도입 (High)

- [x] `bundlemon` dev dependency와 `bundle:budget` 스크립트 추가
- [x] Next.js build 산출물 기준 설정 추가
  - 후보: `.next/static/chunks/**/*.js`, `.next/static/css/**/*.css`
  - 초기 압축 기준: gzip
  - chunk hash 파일명은 glob group 규칙으로 집계
- [x] GitLab CI에 frontend/package 변경 시 실행되는 non-blocking `warn-first` job 추가
  - `validate_bundle_budget` job은 `allow_failure: true`로 운영
  - 기준선 안정화 전 production deploy 차단 금지
- [x] 초기 기준선 기록
  - `npm run bundle:budget` PASS
  - gzip 기준 JS chunks group: `1.37MB < 2MB`
  - gzip 기준 CSS chunks group: `34.82KB < 250KB`
  - 최대 단일 JS chunk: `142.84KB < 300KB`
  - 최대 단일 CSS chunk: `29.64KB < 120KB`
- [x] 첫 관측 기록 (2026-05-16 KST)
  - `npm run bundle:budget` PASS
  - gzip 기준 JS chunks group: `1.37MB < 2MB`
  - gzip 기준 CSS chunks group: `34.94KB < 250KB`
  - 최대 단일 JS chunk: `142.84KB < 300KB`
  - 최대 단일 CSS chunk: `29.75KB < 120KB`
- [x] 조기 관측 및 follow-up 수정 기록 (2026-05-18 KST)
  - `Noto_Sans_KR`를 다중 static weight(`300/400/500/700/800`)로 self-host하면 단일 CSS chunk가 `125.94KB > 120KB`로 예산을 초과함을 확인
  - 예산 상향 대신 `next/font`의 `weight: 'variable'`로 전환해 self-host와 runtime 외부 폰트 요청 차단을 유지
  - 수정 후 `npm run bundle:budget` PASS
  - gzip 기준 JS chunks group: `1.38MB < 2MB`
  - gzip 기준 CSS chunks group: `61.94KB < 250KB`
  - 최대 단일 JS chunk: `143.29KB < 300KB`
  - 최대 단일 CSS chunk: `30.89KB < 120KB`
- [ ] 2026-05-30 전후 1~2주 관측 후 `maxSize` 또는 `maxPercentIncrease`를 blocking gate로 승격할지 결정

**초기 도입 완료 기준**: `npm run bundle:budget` 실행 가능, GitLab CI에서 non-blocking 번들 크기 회귀 리포트가 남음, 기준선/승격 조건이 plan 또는 TODO에 기록됨
**후속 완료 기준**: 최소 1~2주 관측 후 false-positive/runner time 영향이 허용 범위면 blocking 전환 여부를 결정한다.

### P1: Vitest config 정리 (Medium)

- [x] `vitest.config.dev.ts` 사용 여부 확인
  - `scripts/dev/vitest-node-wrapper.js`가 `tests/unit/dev/`, `tests/unit/qa/`, `tests/unit/playwright/` 타깃에서 `config/testing/vitest.config.dev.ts`를 선택함
  - `scripts/hooks/pre-push-file-classifier.js`의 node infra smoke 대상에도 포함됨
  - 결론: 사용 중이므로 삭제하지 않음
- [x] `vitest.config.minimal.ts`의 하드코딩 파일 목록을 패턴 중심으로 교체
  - 기존 dead include `src/utils/type-guards.test.ts` 제거
  - 목표: quick node-only 범위를 유지하는 brace/glob 패턴으로 정리
  - 주의: `pool: 'vmThreads'`, `isolate: false` 유지 (속도 최우선)
- [x] 12개 config 중 dead 파일 목록 확정
  - 삭제 대상 없음: `package.json`, wrapper script, CI, pre-push classifier에서 전부 직접/간접 참조 확인

**완료 기준**: `npm run test:quick`이 패턴 기반으로 실행되고 통과, dead include 제거, 삭제 대상 config 없음 기록

---

### P2: CI validate gate에 jsdom 테스트 포함 여부 결정 (Low)

- [x] `test:dom` 수행 시간 측정 (로컬 기준 `time npm run test:dom`)
  - 1차 측정: `elapsed=2:37.47`, 2개 stale clarification test 실패
  - 수정 후 재측정: `elapsed=1:51.14`, 155 files / 1071 tests PASS
  - 실패 원인: `sendQuery`가 clarification 생성 후 `/api/ai/nlq/extract-entities` 결과로 재평가하는 현재 계약을 테스트 mock이 반영하지 못함
- [x] 30초 이내면 CI validate에 추가, 초과하면 별도 `test:ci:full` 스크립트로 분리
  - 결정: 30초 초과이므로 default GitLab `validate` gate에는 미포함
  - `test:ci:full`을 opt-in full smoke로 추가: type-check → lint:ci → test:quick → test:contract → test:dom
- [x] 결정 후 `.gitlab-ci.yml` validate job 업데이트
  - 결정: `.gitlab-ci.yml`의 default `validate` job은 변경하지 않음
  - 이유: `test:dom` 단독 1분 51초로 기본 validate SLA 대비 과하고, 기존 `test:quick` + `test:contract`가 배포 전 deterministic gate 역할을 유지

**완료 기준**: 의사결정 완료 + CI 반영 또는 "30초 초과, 별도 job 유지" 결정 기록

---

### P3: Storybook `play:` 함수 도입 — 핵심 컴포넌트 우선 (Medium)

- [x] 우선순위 컴포넌트 선정 (인터랙션이 있는 핵심 3~5개)
  - 선정: `DashboardSummary`, `ImprovedServerCard`, `ChatInputArea`, `ClarificationDialog`, `AIAssistantButton`
- [x] 선정 컴포넌트에 `play:` 함수 추가 (click, fill, 상태 전환 확인)
  - `DashboardSummary`: 상태 필터, 알림 보기, 로그 검색
  - `ImprovedServerCard`: 서버 상세 열기, progressive disclosure 펼침
  - `ChatInputArea`: 메시지 전송, 도구 메뉴 Web 검색 모드 전환
  - `ClarificationDialog`: 추천 옵션 선택, 직접 입력 제출
  - `AIAssistantButton`: 활성 상태 토글 클릭
- [x] `@storybook/addon-vitest` targeted runner bootstrap 안정화
  - sandbox 내부: browser/server local bind 제한으로 `listen EPERM 127.0.0.1`
  - 원인: Vitest 4.1.2가 browser session timeout을 project config가 아닌 root `test.browser.connectTimeout`에서 조회
  - 조치: root `test.browser.connectTimeout=180_000`, Storybook project `fileParallelism=false`
  - 조치: 상호작용 검증 스토리는 `interaction-test` tag opt-in으로 축소
  - 검증: `npm run test:storybook:experimental -- src/components/dashboard/AIAssistantButton.stories.tsx` PASS (1 file / 1 test, duration 246.19s)
- [x] 전체 opt-in Storybook Vitest suite setup 비용 안정화
  - `npm run test:storybook:experimental` 전체 실행은 setup 구간이 과도하게 길어 기본 CI gate에는 부적합
  - 별도 bounded script 확정: `npm run test:storybook:interaction`
  - 자동 실행 대상: `DashboardSummary`, `ImprovedServerCard`, `ClarificationDialog`, `AIAssistantButton`
  - 검증: `npm run test:storybook:interaction` PASS (4 files / 5 tests, duration 207.51s)
  - `ChatInputArea`는 browser runner에서 장시간 hang/CPU spin이 재현되어 `interaction-test` tag 대상에서 제외하고, 기존 DOM 테스트와 수동 Storybook `play:` 함수로 보완

**완료 기준**: 선정 컴포넌트 스토리에 `play:` 함수 존재, 대표 tagged Storybook Vitest smoke 통과, 전체 opt-in suite를 CI에 넣을 수 있을 정도로 setup 비용 안정화 또는 별도 targeted/sharded script 확정

---

### P4: `validate_storybook_smoke` CI 트리거 확인 (Low)

- [x] `.gitlab-ci.yml`의 `validate_storybook_smoke` changes 규칙이 현재 아래 경로를 포함함:
  - `.storybook/**/*`
  - `scripts/storybook/**/*`
  - `config/testing/vitest.config.storybook.ts`
  - `src/**/*.stories.ts`
  - `src/**/*.stories.tsx`
  - `src/components/**/*`
  - `src/app/**/*`
  - `package.json`, `package-lock.json`, `.gitlab-ci.yml`
- [x] 스모크 빌드 시간 측정 후 타임아웃 적절성 확인
  - `npm run storybook:smoke` PASS
  - 로컬 측정: `elapsed=0:52.89`
  - sandbox 내부에서는 localhost bind 제한으로 `EPERM` 실패하므로, 실제 측정은 sandbox 밖에서 수행
  - 결론: GitLab CI `timeout: 8 minutes` 유지

**완료 기준**: 현재 changes 규칙 유지, 스모크 빌드 시간 측정 후 8분 timeout 적절성 확인

---

### P5 (부수): DashboardClientRuntime anonymous 버그 수정 (P2)

2026-05-15 Production QA 중 발견. 계획서 범위와 별개이나 동시 진행 권장.

- [x] `src/app/dashboard/DashboardClientRuntime.tsx:104-118` 수정
  - `permissions.userType === 'anonymous'` 케이스가 `setAuthLoading(false)` 없이 통과 → 무한 로딩
  - 수정: 리다이렉트 조건에 `|| permissions.userType === 'anonymous'` 추가
- [x] 수정 후 release `v8.11.156` 배포 확인

**완료 근거**: `490846d7c fix(dashboard): redirect anonymous access checks`, `ac42ad481 chore(release): 8.11.156`

**완료 기준**: 비인증 사용자가 `/dashboard` 접근 시 로딩 스피너가 아닌 `/` 리다이렉트 발생

---

## 우선순위 권장 순서

```
P0 (bundlemon warn-first) → P1 (config 정리) → P4 (Storybook smoke timeout 확인) → P2 (jsdom gate 결정) → P3 (play: 함수)
```

P5/P0/P1/P2/P3/P4는 완료됨. P3는 full Storybook Vitest 전체 실행 대신 bounded interaction runner로 확정했다. P0은 신규 런타임 계약 변경이 아니라 CI 품질 게이트 추가이므로 warn-first로 시작하고, blocking 승격은 2026-05-30 전후 관측 결과로 별도 판단한다. 현재 상태는 구현 대기가 아니라 tracking 상태다.
2026-05-18 조기 관측에서 budget이 self-host Korean font static weight 중복을 잡아냈고, variable font 전환으로 threshold 상향 없이 회복했다.
P1~P4는 각각 독립 PR로 처리 가능.

---

## 비고

- `autodocs` 태그 추가(P3 확장)는 `play:` 함수 도입 이후 2차 검토
- `ChatInputArea` browser-run hang 원인 분석은 필요 시 별도 follow-up으로 진행한다. 현재 자동 회귀는 DOM 테스트를 우선 신뢰한다.
- `addon-mcp` 기본 활성화는 현재 `OPENMANAGER_STORYBOOK_MCP_MODE` 정책 유지
- Vitest 커버리지 임계값 설정은 이 계획 범위에서 제외 — 커버리지 수치 목표 없음 정책(`testing.md`) 유지
- Chromatic/LHCI/Codecov/Happy DOM 전면 전환은 제외. 필요 시 P0 관측 이후 별도 평가한다.
