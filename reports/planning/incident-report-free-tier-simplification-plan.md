> Owner: project
> Status: Completed
> Last reviewed: 2026-05-02

# Incident Report Free Tier Simplification Plan

- 상태: Completed
- 작성일: 2026-05-02
- TODO.md 연결: Active Tasks > 장애 보고서 free-tier 단순화

## 목표

장애 보고서 기능을 포트폴리오/무료 티어 운영 목적에 맞게 "사용자 클릭 시 1회 생성하고 세션 내에서 확인/다운로드"하는 구조로 고정한다. Supabase 영속 저장, 히스토리 조회, 해결 완료 PATCH API는 실제 제품 확장 지점으로 남기되 현재 production surface에서는 제거한다.

## 범위

- 포함:
  - `/api/ai/incident-report`를 POST `generate` 전용으로 정리
  - Cloud Run 보고서 생성 결과를 DB에 저장하지 않음
  - GET 히스토리 조회와 PATCH 상태 변경 route 제거
  - Auto Report 페이지에서 히스토리 탭 제거
  - 해결 완료는 세션 내 UI 상태만 변경
  - free-tier 문서와 요구사항 문서 갱신
- 제외:
  - Cloud Run Reporter agent 제거
  - 장애 보고서 생성 자체 제거
  - Supabase schema/migration 삭제
  - 외부 LLM 호출 추가

## 계약 (Contract)

| 항목 | 계약 |
|------|------|
| Route exports | `POST`만 export, `GET`/`PATCH` 없음 |
| POST body | `action: "generate"`만 허용 |
| Persistence | `incident_reports` INSERT/SELECT/UPDATE 없음 |
| UI history | 별도 히스토리 탭 없음, 세션 내 생성 목록만 표시 |
| Resolve action | API 호출 없이 현재 세션 report state만 `resolved`로 변경 |

## 테스트 시나리오

- [x] route module이 `POST`만 export하고 `GET`/`PATCH`를 export하지 않는다.
- [x] `action: "history"`는 validation 400으로 차단되고 Cloud Run/cache를 호출하지 않는다.
- [x] `action: "generate"`는 기존처럼 Cloud Run 경로와 fallback/retry 계약을 유지한다.
- [x] Auto Report 페이지에 히스토리 탭이 렌더링되지 않는다.
- [x] 해결 완료 클릭은 추가 fetch 없이 세션 상태만 갱신한다.

## Task 목록

- [x] Task 0 — 중단된 dirty 변경 범위 확인
- [x] Task 1 — route/API 계약을 POST generate only로 정렬
- [x] Task 2 — Auto Report UI를 세션 내 보고서 관리로 정리
- [x] Task 3 — 문서 갱신
- [x] Task 4 — 품질 게이트 통과
