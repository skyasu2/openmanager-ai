---
Owner: project
Status: Draft
Doc type: Plan
Last reviewed: 2026-04-22
Tags: ci,line-guard,refactor
---

# Line Guard Hotspots Refactor Plan

> `npm run ci:local:docker` 실행 시 `line-guard` 단계 fail(800+ lines)로 CI가 중단되는 구조적 이슈를 추적/정리한다.

## 배경

- 2026-04-22 로컬 CI 결과에서 아래 3개 파일이 line-count fail threshold(`800`)를 초과함.
  - `src/components/ai/AnalysisBasisBadge.tsx` (1359 lines)
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts` (897 lines)
  - `src/hooks/ai/utils/message-helpers.ts` (820 lines)
- 현재 변경과 무관한 기존 누적 이슈지만, CI green 안정성 확보를 위해 분할 리팩터링이 필요함.

## 목표

- fail threshold 초과 파일을 단계적으로 분리하여 `line-guard`를 통과 가능한 상태로 복구.
- 기능 회귀 없이 테스트/타입 체크와 함께 CI 게이트를 유지.

## 범위

- 포함:
  - 3개 fail 파일의 모듈 분리(유틸/도메인 단위 추출)
  - 관련 테스트 보강 및 회귀 확인
  - line-guard 경고/실패 수치 개선 확인
- 제외:
  - AI 품질 로직 자체 변경(알고리즘 변경)
  - 대규모 기능 추가

## Contract (초안)

### 변경 대상(예상)
- `src/components/ai/AnalysisBasisBadge.tsx`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `src/hooks/ai/utils/message-helpers.ts`
- 각 파일에서 추출되는 신규 helper/module 파일

### 완료 기준
- [ ] `npm run line-guard` fail 0건
- [ ] `npm run type-check` pass
- [ ] `npm run test:quick` pass
- [ ] ai-engine 영향 구간은 `cd cloud-run/ai-engine && npm run type-check && npm run test` pass

## Task 목록 (초안)

- [ ] Task 1: AnalysisBasisBadge 표시/상태/유틸 섹션 분리
- [ ] Task 2: orchestrator-execution 실행 단계별 모듈 분리
- [ ] Task 3: message-helpers 포맷/파싱/검증 유틸 분리
- [ ] Task 4: 회귀 테스트 보강 및 CI 재검증
