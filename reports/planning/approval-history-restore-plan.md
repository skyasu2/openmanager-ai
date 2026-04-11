# Approval History Restore Plan

- 상태: 완료
- 작성일: 2026-04-11
- 목표: remote Supabase에서 누락된 `public.approval_history` 테이블을 최소 범위로 복구해 AI approval audit/runtime error를 제거한다.

## 배경

- `cloud-run/ai-engine/src/services/approval/approval-store-supabase.ts`는 `approval_history` 테이블에 직접 `insert/update/select`를 수행한다.
- `get_approval_history`, `get_approval_stats`, `approval_action_type`, `approval_status`는 remote DB에 존재한다.
- 하지만 `public.approval_history`는 remote DB에 존재하지 않는다.
- 결과적으로 approval persistence와 approval stats/history 조회가 runtime에서 실패하고, 일부 경로는 catch/fallback에 묻힌다.

## 확인된 사실

- remote DB:
  - `to_regclass('public.approval_history') = null`
  - `get_approval_history()` / `get_approval_stats()` 존재
  - `incident_reports`, `ai_feedback`, `ai_user_feedback` 존재
- repo 정본:
  - `supabase/migrations/20251225232745_create_approval_history.sql`에 원래 테이블/인덱스/트리거/함수/RLS 정의가 있다.
- 현재 문제 성격:
  - migration ledger drift가 아니라 runtime schema drift
  - broad schema repair가 아니라 단일 테이블 복구 작업

## 범위

### 포함
- `approval_history` 테이블 복구
- 필요한 인덱스/트리거/RLS policy 복구
- remote DB 적용 및 함수 정상 호출 재검증

### 제외
- orphan function 대청소
- `ai_user_feedback` 정리
- `command_vectors` HNSW 추가
- approval dashboard/read policy 확장

## 실행 원칙

1. 기존 `get_approval_history` / `get_approval_stats` 함수 시그니처를 깨지 않는다.
2. remote DB에 이미 존재하는 enum/function은 재정의하지 않는다.
3. 최소 복구 migration만 추가한다.
4. 현재 runtime 사용 경로 기준으로 `service_role` 전용 쓰기/읽기 정책을 유지한다.

## 실행 단계

1. 기존 repo migration과 runtime 사용 컬럼을 기준으로 최소 스키마를 확정한다.
2. 새 migration `restore_approval_history_table_minimal`을 추가한다.
3. remote DB에 migration을 적용한다.
4. 아래를 검증한다.
   - `approval_history` 테이블 존재
   - 인덱스/트리거/RLS policy 존재
   - `get_approval_history()` / `get_approval_stats()` 호출 성공

## 성공 기준

- `public.approval_history` 존재
- `approval-store-supabase.ts`의 insert/update/query 경로가 더 이상 relation missing 에러를 내지 않음
- `incident-rag-injector`의 approval_history preferred path가 fallback 없이 조회 가능

## 리스크 메모

- 현재 원격 DB에 남아 있는 함수는 테이블 부재 상태를 전제하지 않으므로, 이번 복구는 함수 정의와 충돌하지 않아야 한다.
- user-facing read policy는 현재 요구사항이 아니므로 이번 턴에서 열지 않는다.

## 완료 결과

- remote DB에 `restore_approval_history_table_minimal` migration 적용 완료
- `public.approval_history` 테이블 / trigger / RLS policy 복구 확인
- smoke insert + `get_approval_history()` + `get_approval_stats()` 호출 성공 확인
- smoke row 삭제 완료
- `supabase migration list` local=remote 정렬 확인
- `supabase db push --dry-run --linked` 결과 `Remote database is up to date.`
