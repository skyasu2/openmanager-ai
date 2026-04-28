> Owner: project
> Status: Completed
> Last reviewed: 2026-04-28

# Supabase Free-Tier Hardening Plan

## 1. 목적

Supabase 사용량은 무료 티어 한도 대비 충분히 낮지만, 현재 DB에는 과거 GraphRAG/vector 경로의 public RPC와 테이블 권한이 남아 있다.
현재 런타임은 Next.js API route와 Cloud Run AI Engine이 service role을 통해 Supabase에 접근하므로, 직접 anon/authenticated DB 접근면을 줄이고 unused vector index를 제거한다.

## 2. 범위

- 포함:
  - Knowledge Retrieval Lite 현재 RPC `search_knowledge_text`는 service role 전용 실행으로 제한
  - 과거 GraphRAG/vector/approval RPC의 anon/authenticated 실행 권한 제거
  - 서버 경유로만 사용하는 public 테이블의 anon/authenticated direct table privilege 제거
  - runtime BM25 인덱스는 유지하고, 사용되지 않는 heavy vector/content index만 제거
  - 원격 Supabase 마이그레이션 적용 후 권한/인덱스/검색 smoke 확인
- 제외:
  - `knowledge_base`, `knowledge_relationships`, `command_vectors` 테이블 drop 또는 row data 삭제
  - `embedding` column 삭제
  - Job Queue 장시간 실행 경로의 Cloud Tasks 분리
  - 인증 정책, OAuth, 로그인 UX 변경

## 3. 계약

| 대상 | 계약 |
|------|------|
| `search_knowledge_text` | service role만 `EXECUTE` 가능. Cloud Run KRL 경로는 service role client를 사용하므로 계속 동작해야 한다. |
| legacy RAG/vector RPC | anon/authenticated 직접 실행 불가. 존재 자체는 호환성과 rollback 여지를 위해 유지한다. |
| public runtime tables | Next.js/Cloud Run server-side 접근은 유지하고, anon/authenticated direct table privilege는 제거한다. |
| index cleanup | `idx_knowledge_base_search_vector`는 유지한다. `idx_knowledge_base_embedding_hnsw`, `idx_knowledge_base_content_trgm`, `idx_command_vectors_embedding_hnsw`는 제거 가능하다. |
| destructive cleanup | 이번 단계에서 `DROP TABLE`, `DROP COLUMN embedding`은 금지한다. |

## 4. 테스트 시나리오

- [ ] migration contract가 RPC revoke/grant 대상 목록을 고정한다.
- [ ] migration contract가 server-only table privilege revoke/grant를 고정한다.
- [ ] migration contract가 drop 대상 index와 보존 대상 BM25 index를 구분한다.
- [ ] 원격 Supabase에서 anon/authenticated function execute privilege가 제거되고 service role은 유지된다.
- [ ] 원격 Supabase에서 제거 대상 index가 없어지고 KRL RPC smoke가 성공한다.

## 5. Task 목록

- [x] Task 0 — failing contract test 커밋
- [x] Task 1 — Supabase hardening migration 작성
- [x] Task 2 — local contract/type smoke 검증
- [x] Task 3 — remote Supabase migration 적용 및 live verification
- [x] Task 4 — 커밋/푸시 및 GitLab pipeline 확인

## 6. 완료 기준

- [x] contract test 통과
- [x] root `npm run test:contract` 통과
- [x] DB migration 원격 적용 완료
- [x] `search_knowledge_text` service role 실행 가능 확인
- [x] anon/authenticated public RPC execute privilege 제거 확인
- [x] 최종 `git status` clean

## 7. 완료 결과

- 원격 Supabase migration `20260428101907_harden_supabase_rag_public_surface` 적용 성공
- `search_knowledge_text` 포함 19개 RAG/vector/approval RPC: `anon=false`, `authenticated=false`, `service_role=true`
- 8개 runtime table과 `vector_documents_stats` view: direct anon/authenticated table privilege 제거, service role 유지
- 제거 대상 vector-era index 3개 삭제 확인, `idx_knowledge_base_search_vector` 유지 확인
- KRL RPC smoke: `search_knowledge_text('redis memory', 10, NULL)` 결과 3건 반환
- 검증:
  - `npx vitest run tests/unit/dev/supabase-security-hardening-contract.test.ts`
  - `npm run test:contract`
  - `supabase db lint` (기존 `match_knowledge_base.match_threshold` unused warning만 유지)
  - `npm run test:quick`
  - `npm run type-check`
  - `npm run lint` (기존 `qa-tracker.json` size info만 유지)
  - `node scripts/test/vercel-post-deploy-smoke.mjs --expected-version=8.11.47 --retries=1 --retry-delay-ms=1000`
