> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-21
> Tags: ai,ui,docs,multi-agent

# Multi-Agent Semantics Plan

- 작성일: 2026-04-21
- TODO.md 연결: Active Tasks > `multi-agent` semantics UI/문서 정렬

## 목표

사용자 UI와 아키텍처 문서에서 `resolvedMode=multi`를 단순한 "deep multi-hop"으로 오해하지 않도록, 실제 의미인 `오케스트레이션 + specialist handoff` 중심으로 표현을 정렬한다.

## 범위

- 포함:
  - `AnalysisBasisBadge`의 runtime mode 라벨/설명 문구 조정
  - 관련 회귀 테스트 갱신
  - 아키텍처 문서의 semantics 설명을 UI 표현과 같은 기준으로 정렬
- 제외:
  - backend mode resolver 로직 변경
  - `resolvedMode` enum/contract 변경
  - 새로운 telemetry 필드 추가

## 계약 (Contract)

### 변경 대상 파일

- `src/components/ai/AnalysisBasisBadge.tsx`
- `src/components/ai/AnalysisBasisBadge.test.tsx`
- `docs/reference/architecture/ai/ai-engine-architecture.md`

### 동작 계약

- `resolvedMode="single"`은 단일 응답 경로로 유지한다.
- `resolvedMode="multi"`는 UI에서 `오케스트레이션 협업` 계열 문구로 노출한다.
- 설명 텍스트는 다음 의미를 포함해야 한다.
  - orchestrator가 specialist/tool 경로를 조율한 응답
  - deep multi-hop만을 뜻하지 않음
- 문서와 UI는 같은 의미를 사용하되, 구현 세부 enum 값은 바꾸지 않는다.

### 테스트 시나리오

- [ ] runtime metadata가 있을 때 `multi` 라벨이 협업 의미로 표시된다
- [ ] `single` 라벨은 기존 단일 경로 의미를 유지한다
- [ ] process/detail 탭 회귀 없이 기존 metadata 노출이 유지된다

## Task 목록

- [x] Task 1 — `AnalysisBasisBadge` 라벨/설명 문구 정렬
- [x] Task 2 — 관련 테스트 기대값 갱신
- [x] Task 3 — 아키텍처 문서 semantics 설명 정렬
- [x] Task 4 — root 검증(`type-check`, `lint`, `test:quick`) 수행

## 완료 기준

- [x] `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx` 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] TODO.md Active/Completed 상태 갱신
