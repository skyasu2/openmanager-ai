> Owner: project
> Status: Completed
> Last reviewed: 2026-05-19

# Vercel Function Budget Plan

- 상태: Completed
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > Vercel function budget 명시화

## 목표
Vercel CLI에서 `api/ai/incident-report`가 60초 함수로 표시되는 이유를 코드 계약에 명확히 남긴다. 이 라우트는 장애보고서 Cloud Run fallback retry 예산 때문에 30초 와일드카드 대상이 아니므로, 운영자가 비용 drift로 오판하지 않도록 명시 예외와 회귀 테스트를 추가한다.

## 범위
- 포함: `vercel.json` function override 명시, `incident-report` route maxDuration과 내부 route budget 상수 정합성 테스트.
- 제외: 실제 Vercel 사용량 API 조회 자동화. Vercel 월별 execution/bandwidth 상세 사용량은 dashboard-only 영역이므로 별도 수동 확인으로 유지한다.

## 계약 (Contract)

| 항목 | 기대값 |
|------|--------|
| `src/app/api/ai/incident-report/route.ts` `maxDuration` | `60` |
| `route-helpers` incident route budget seconds | `60` |
| `vercel.json` function override | `memory=256`, `maxDuration=60` |

## 테스트 시나리오
- [x] route export `maxDuration`과 내부 route budget 상수가 동일해야 한다.
- [x] `vercel.json`에 incident-report explicit function override가 있어야 한다.

## Task 목록
- [x] Task 0 — failing/guard test 추가
- [x] Task 1 — `vercel.json` 명시 예외 추가
- [x] Task 2 — 검증 및 TODO/plan 완료 처리

## 완료 기준
- [x] targeted incident-report route test 통과
- [x] root `type-check` 통과
- [x] root `lint` 통과
- [x] root `test:quick` 통과
- [x] root `test:contract` 통과
- [x] docs checks 통과
- [x] `git diff --check` 통과
