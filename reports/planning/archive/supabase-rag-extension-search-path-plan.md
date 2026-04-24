> Owner: project
> Status: Completed
> Last reviewed: 2026-04-24

# Supabase RAG Extension Search Path Plan

- 상태: Completed
- 작성일: 2026-04-24
- TODO.md 연결: Recent Completed > Supabase RAG extension search_path repair 완료

## 목표

`vector`와 `pg_trgm` 확장이 `extensions` 스키마로 이동된 뒤, 기존 RAG/GraphRAG RPC 함수가 `extensions`를 `search_path`에 포함하지 않아 실패하는 문제를 복구한다.

## 범위

- 포함: Supabase RPC 함수의 `search_path` 보정, local/remote migration ledger version 정렬, 수동 smoke 스크립트 추가
- 제외: RAG 알고리즘 변경, 함수 본문 재작성, 데이터 재색인, AI Engine API 계약 변경

## 현재 증상

- `/api/health`와 `/api/database`는 정상이다.
- `supabase db lint --linked`는 RAG/vector 함수에서 `similarity(text,text)`와 `extensions.vector <=> extensions.vector` 해석 실패를 보고한다.
- production Supabase RPC smoke에서 아래 함수가 `42883`으로 실패한다.
  - `match_knowledge_base`
  - `search_knowledge_base`
  - `match_documents`

## 계약 (Contract)

### 변경 대상 파일

- `supabase/migrations/20260416225546_move_extensions_to_extensions_schema.sql`
- `supabase/migrations/20260424140000_fix_rag_extension_search_path.sql`
- `scripts/test/supabase-rag-rpc-smoke.mjs`
- `package.json`
- `reports/planning/TODO.md`

### 입출력 계약

| 대상 | 입력 | 출력 | 에러 케이스 |
|------|------|------|-------------|
| Supabase RAG RPC | 기존 query text/vector payload | 기존 row shape 유지 | extension operator/function 미해석 시 smoke 실패 |
| `scripts/test/supabase-rag-rpc-smoke.mjs` | `.env.local` 또는 process env Supabase URL/key | `[PASS]`/`[FAIL]` per RPC | env 누락 `exit 2`, RPC 실패 `exit 1` |

### 테스트 시나리오

- [x] 시나리오 1: 구현 전 production RPC smoke가 `42883`으로 실패한다.
- [x] 시나리오 2: migration 적용 후 `match_knowledge_base`, `search_knowledge_base`, `match_documents`, `hybrid_search_with_text`가 실패 없이 반환한다.
- [x] 시나리오 3: `supabase db lint --linked`에서 RAG/vector 함수 typing error가 사라진다.
- [x] 시나리오 4: `supabase migration list`에서 `20260416225546_move_extensions_to_extensions_schema` ledger drift가 정렬된다.

## Task 목록

- [x] Task 0 — failing baseline 확보: production RPC smoke에서 `42883` 재현
- [x] Task 1 — remote-only/local-only ledger 원인 확인: 동일 migration name의 timestamp 불일치 확인
- [x] Task 2 — local migration ledger rename 및 search_path repair migration 추가
- [x] Task 3 — `supabase db push --dry-run`으로 적용 대상 확인
- [x] Task 4 — remote migration 적용
- [x] Task 5 — RPC smoke, `db lint`, migration list 재검증
- [x] Task 6 — 최종 코드리뷰 및 완료 상태 정리

## 검증 결과

- `supabase db push --dry-run`: 적용 대상 `20260424140000_fix_rag_extension_search_path.sql` 1건만 표시
- `supabase db push --yes`: migration 적용 완료
- `npm run supabase:rag:smoke`: 4개 RPC 모두 `[PASS]`
- `supabase db lint --linked`: 기존 `42883` typing error 0건, 잔여 warning 1건(`match_threshold` unused)
- `supabase migration list`: `20260416225546`, `20260424140000` 모두 Local/Remote 정렬
- production `/api/health`: healthy, database/cache/ai connected
- production `/api/database`: healthy, primary online

## 완료 기준

- [x] Supabase RPC smoke 통과
- [x] `supabase db lint --linked` 통과 또는 RAG/vector 관련 typing error 0건
- [x] `supabase migration list`에서 remote-only/local-only drift 해소
- [x] 변경 파일 코드리뷰 완료

## 잔여 고려사항

- `match_knowledge_base.match_threshold` 미사용 lint warning 1건은 남겼다.
- 이를 즉시 수정하면 text fallback recall/threshold semantics가 바뀌므로, 별도 계약 검토 후 처리한다.
