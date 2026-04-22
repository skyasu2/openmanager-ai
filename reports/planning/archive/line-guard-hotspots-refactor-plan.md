---
Owner: project
Status: Completed
Doc type: Plan
Last reviewed: 2026-04-22
Tags: ci,line-guard,refactor
---

# Line Guard Hotspots Refactor Plan

> `npm run ci:local:docker` 실행 시 `line-guard` 단계 fail(800+ lines)로 CI가 중단되던 구조적 hotspot 3건을 단계적으로 분리해 CI 게이트를 복구한다.

## 결과 (2026-04-22)

- [x] Phase 1: `src/hooks/ai/utils/message-helpers.ts` `820 -> 335 lines`
  - `src/hooks/ai/utils/message-transform-internals.ts` 신규 추출 (`518 lines`)
  - failed tool summary 회귀 테스트 추가
- [x] Phase 2: `src/components/ai/AnalysisBasisBadge.tsx` `1359 -> 316 lines`
  - `src/components/ai/analysis-basis/shared.ts` (`565 lines`)
  - `src/components/ai/analysis-basis/AnalysisBasisProcessPanel.tsx` (`249 lines`)
  - `src/components/ai/analysis-basis/AnalysisBasisDetailPanel.tsx` (`361 lines`)
  - `src/components/ai/analysis-basis/AnalysisBasisMetadata.tsx` (`137 lines`)
- [x] Phase 3: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts` `897 -> 739 lines`
  - trace/finalize/vision-fallback helper를 `orchestrator-execution-helpers.ts`로 이동 (`297 lines`)
  - timeout contract test mock을 partial mock으로 정리
- [x] 최종 상태: `npm run line-guard` 기준 fail `3 -> 0`

## 검증

- [x] `npx vitest run src/hooks/ai/utils/message-helpers.test.ts` pass (`21 tests`)
- [x] `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx` pass (`20 tests`)
- [x] `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts` pass (`4 tests`)
- [x] `npm run type-check` pass
- [x] `npm run lint` pass (info only: `reports/qa/qa-tracker.json` size)
- [x] `npm run test:quick` pass
- [x] `npm run line-guard` pass (warn `25`, fail `0`)
- [x] `cd cloud-run/ai-engine && npm run type-check` pass
- [x] `cd cloud-run/ai-engine && npm test` pass (`76 files`, `820 tests`)

## 배경

- 2026-04-22 기준 로컬 CI에서 아래 3개 파일이 fail threshold(`800`)를 초과해 `line-guard` 단계가 중단됐다.
  - `src/hooks/ai/utils/message-helpers.ts`
  - `src/components/ai/AnalysisBasisBadge.tsx`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- 목표는 로직 변경이 아니라 책임 분리로 fail threshold만 해소하고 기존 검증을 green으로 복구하는 것이었다.

## 범위

- 포함:
  - hotspot 3건의 helper/subcomponent 추출
  - 관련 회귀 테스트 유지 또는 보강
  - root app + ai-engine 검증 재실행
- 제외:
  - AI 품질 알고리즘 변경
  - 신규 기능 추가

## 완료 기준

- [x] fail threshold 초과 파일 3건 모두 800 lines 미만으로 축소
- [x] `npm run line-guard` 전체 pass
- [x] root app 기본 검증 pass
- [x] ai-engine 기본 검증 pass

## 메모

- warning threshold(`500`) 초과 파일은 여전히 다수 존재하지만, 이번 작업 범위의 release blocker는 fail threshold 복구였다.
- 후속 소형 리팩터링이 필요하면 TODO backlog에서 별도 batch로 다루는 편이 안전하다.
