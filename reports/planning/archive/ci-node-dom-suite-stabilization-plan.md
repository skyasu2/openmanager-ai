---
Owner: project
Status: Completed
Doc type: Plan
Last reviewed: 2026-04-22
Tags: ci,test,stability
---

# CI Node/DOM Suite Stabilization Plan

> `line-guard` 복구 이후 남아 있던 root `test:node` / `test:dom` full-suite 불안정 테스트를 정리하고, `npm run ci:local:docker`까지 green으로 복구했다.

## 현재 상태 (2026-04-22)

- [x] `line-guard` fail `3 -> 0` 복구 완료
- [x] `src/proxy.test.ts` CI 환경(`CI=true`)을 고려하도록 계약 보강
- [x] `src/app/dashboard/DashboardInteractiveShell.test.tsx` `waitFor` timeout 완화로 remount flake 1차 완화
- [x] `src/app/api/security/csp-report/route.test.ts` logger mock 누락(`debug`) 보정
- [x] `tests/ai-sidebar/useHybridAIQuery.clarification.test.ts` mock reset 흐름 정리로 full DOM suite 캐시 오염 완화
- [x] `src/hooks/ai/core/useQueryExecution.ts` off-domain 분류를 non-blocking promise chain으로 정리하고 default sendQuery 호출 계약 복구
- [x] `src/hooks/ai/core/useQueryExecution.test.ts` async assertion을 `waitFor` 기반으로 안정화
- [x] `src/components/dashboard/ActiveAlertsModal.test.tsx` 실제 한국어 UI 문구 기준으로 expectation 정렬
- [x] `src/components/shared/AuthLoadingUI.tsx` hidden-copy 경로를 `role="status"` + `aria-label` 계약으로 단순화
- [x] `npm run ci:local:docker` 전체 green 복구

## 최종 결과

- root `test:node`: `211 passed`, `4 skipped`
- root `test:dom`: `133 passed`
- root aggregate tests: `2291 passed`, `39 skipped`
- ai-engine tests: `76 files`, `820 tests` pass
- final gate: `[local-docker-ci] local Docker CI passed`

## 실제 수정 범위

- Node suite 안정화
  - `src/proxy.test.ts`
  - `src/app/dashboard/DashboardInteractiveShell.test.tsx`
  - `src/app/dashboard/DashboardClient.shell.test.tsx`
  - `src/app/auth/success/page.test.tsx`
  - `src/app/dashboard/error.test.tsx`
  - `src/app/global-error.test.tsx`
  - `src/app/error.test.tsx`
  - `src/app/system-boot/components/SmoothLoadingSpinner.test.tsx`
  - `src/app/api/security/csp-report/route.test.ts`
  - `src/test/setup.node.ts`
- DOM/contract stability follow-up
  - `tests/ai-sidebar/useHybridAIQuery.clarification.test.ts`
  - `src/hooks/ai/core/useQueryExecution.ts`
  - `src/hooks/ai/core/useQueryExecution.test.ts`
  - `src/components/dashboard/ActiveAlertsModal.test.tsx`
  - `src/components/shared/AuthLoadingUI.tsx`

## 목표

- root `test:node`와 `ci:local:docker`를 안정적으로 green으로 복구한다.
- UI/auth error-path 테스트를 isolated execution에 덜 의존하도록 고정한다.

## 범위

- 포함:
  - failing suite의 mock/import/cache 안정화
  - 필요 시 dynamic import 패턴으로 전환
  - flaky wait/assertion timeout 조정
  - full-suite 재검증
- 제외:
  - 실제 dashboard/auth/global error UI 리디자인
  - 기능 요구사항 변경

## Contract 초안

### 변경 후보
- `src/app/dashboard/DashboardInteractiveShell.test.tsx`
- `src/app/dashboard/DashboardClient.shell.test.tsx`
- `src/app/auth/success/page.test.tsx`
- `src/app/dashboard/error.test.tsx`
- `src/app/global-error.test.tsx`
- `src/app/error.test.tsx`
- `src/app/system-boot/components/SmoothLoadingSpinner.test.tsx`

### 안정화 원칙
- top-level import에 의존하는 테스트는 `vi.resetModules()` + dynamic import로 전환 검토
- `next/navigation`/`next/dynamic` mock은 테스트 파일 간 캐시 공유를 최소화
- wait timeout은 full-suite 부하 기준으로 재설정
- 구현 변경보다 테스트 격리 강화 우선

## 구현 결과

- node suite는 shared mock/cache 오염, tight timeout, CI 전용 계약 mismatch를 각각 분리 수정해 full-suite 기준으로 고정했다.
- DOM suite는 clarification mock reset, off-domain classifier async timing, loading accessibility contract를 실제 런타임 동작과 맞추는 방향으로 정리했다.
- 기능 요구사항 자체는 바꾸지 않고 테스트와 경계 조건만 안정화했다.

## 검증

- `bash scripts/dev/biome-wrapper.sh check src/hooks/ai/core/useQueryExecution.ts tests/ai-sidebar/useHybridAIQuery.clarification.test.ts src/components/dashboard/ActiveAlertsModal.test.tsx src/components/shared/AuthLoadingUI.tsx`
- `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts tests/ai-sidebar/useHybridAIQuery.clarification.test.ts`
- `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts`
- `npm run ci:local:docker`

## Task 목록

- [x] Task 1: 잔여 failing suite별 실제 assertion/stack trace 수집
- [x] Task 2: auth/dashboard error-path 테스트 mock/cache 격리
- [x] Task 3: spinner/dashboard shell 테스트의 DOM assertion 안정화
- [x] Task 4: `npm run test:node` 재검증
- [x] Task 5: `npm run ci:local:docker` 전체 재검증
