> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-26
> Tags: dashboard,ux,frontend

# Dashboard UX Phase 6 Plan

- 상태: Completed
- 작성일: 2026-05-26
- TODO.md 연결: Active Tasks > Dashboard UX Phase 6

## 목표

대시보드 overview의 서버 목록 영역을 더 스캔하기 쉽게 개선한다. 기존 카드 그리드와 알림 피드는 유지하면서 선택형 호스트 맵, 조밀한 상태 카드, 안전한 더보기 안내, 경량 View Transition을 추가한다.

## 범위

- 포함: overview/server-list 공용 `ServerDashboard` 표시 모드 개선, `DashboardSummary` 상태 카드 밀도 조정, `ImprovedServerCard` 높이 안정성 조정
- 제외: 신규 API, AI 경로, OTel 데이터 구조, Cloud Run, Supabase, 다크모드, 대시보드 라우팅 구조 변경

## 계약 (Contract)

### 변경 대상 파일

- `src/components/dashboard/ServerDashboard.tsx`
- `src/components/dashboard/DashboardSummary.tsx`
- `src/components/dashboard/ImprovedServerCard.tsx`
- `src/components/dashboard/*.test.tsx`

### 입출력 계약

| 컴포넌트 | 입력 | 출력/동작 | 에러 케이스 |
|----------|------|-----------|-------------|
| `ServerDashboard` | 기존 `servers`, `allServers`, pagination props | 기본 `서버 카드` 탭 유지, `호스트 맵` 탭 선택 시 같은 필터/정렬 결과를 hexagonal host map으로 표시 | 서버 배열이 비어도 기존 empty state 유지 |
| `ServerDashboard` | `document.startViewTransition` 지원 여부 | 표시 탭 전환 시 지원 브라우저에서는 View Transition API로 state update 실행, 미지원/감소 모션에서는 즉시 전환 | API 미지원 시 예외 없이 fallback |
| `ServerDashboard` | 숨겨진 서버 수 | 더보기 가능 시 카드 클리핑 없이 하단 fade divider 표시 | 모든 서버 표시 시 fade 미표시 |
| `DashboardSummary` | `DashboardStats` | 상태 카드 `min-h`와 숫자 크기를 줄여 overview 상단 밀도 개선 | 필터 버튼 접근성/aria 계약 유지 |
| `ImprovedServerCard` | `variant` | fixed height 대신 variant별 `min-h`를 사용해 텍스트와 메트릭 확장 여지를 둠 | 카드 click/log action 계약 유지 |

### 테스트 시나리오

- [ ] T-6-A/D: `호스트 맵` 탭 선택 시 hexagonal host map이 렌더링되고 node 클릭은 서버 상세 route로 이동한다.
- [ ] T-6-F: View Transition API가 있으면 표시 탭 전환이 `document.startViewTransition`을 통해 실행된다.
- [ ] T-6-C: 숨겨진 서버가 있으면 더보기 전 하단 fade divider를 표시하고, 모든 서버가 표시되면 제거한다.
- [ ] T-6-B: 서버 카드 root는 fixed height class 대신 variant별 `min-h` class를 가진다.
- [ ] T-6-E: 상태 카드 모바일 layout은 유지하되 `min-h-[72px]`와 `text-2xl` 숫자 밀도를 사용한다.

## Task 목록

- [x] Task 0 — failing test 커밋
- [x] Task 1 — `ServerDashboard` 표시 탭, hexagonal host map, View Transition, fade divider 구현
- [x] Task 2 — `ImprovedServerCard` min-height 및 `DashboardSummary` 상태 카드 축소 구현
- [x] Task 3 — 검증 후 계획서 완료/아카이브

## 검증 결과

- `npm run test:dom -- src/components/dashboard/ServerDashboard.test.tsx src/components/dashboard/ImprovedServerCard.test.tsx src/components/dashboard/DashboardSummary.test.tsx` — PASS (3 files / 92 tests)
- `npm run type-check` — PASS
- `npm run lint` — PASS
- `npm run test:quick` — PASS

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 최종 push에 포함 | No | No |
| Task 1~2 | `feat:` | Yes | No | GitLab tag deploy 때 |
| Task 3 | `docs:` | Yes | No | No |

## 완료 기준

- [x] targeted DOM tests 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] TODO.md에서 Phase 6 Active 제거
