# Legacy/Dead Code Analysis (2026-02-21)

## Scope
- Target: `src/` (test/spec 제외)
- Query: `@deprecated` or `legacy`
- Purpose: 삭제 가능 코드와 유지해야 할 호환 코드 분리

## Snapshot
- `@deprecated` markers: `10`
- `legacy` markers: `7`
- Total flagged entries: `17`

Top distribution (by sub-tree):
- `src/app/api`: 4
- `src/lib/auth`: 3
- `src/schemas/server-schemas`: 2
- `src/__mocks__/data`: 2
- others: 6

## Decisions

### Keep (compatibility-critical)
1. `src/app/api/servers/[id]/route.ts`
- `format=legacy` 지원이 여전히 존재하고, API consumer 호환을 유지해야 함.

2. `src/schemas/server-schemas/server-details.schema.ts`
- `legacy` format schema가 API route와 짝으로 동작함.

3. `src/hooks/useTimeSeriesMetrics.ts`
- legacy response schema fallback이 런타임 변환 안전망 역할을 수행 중.

4. `src/lib/auth/guest_session` 레거시 키
- `auth_type`, `guest_session_id`는 즉시 삭제 대신 하위호환 읽기 경로를 유지한 채 점진 축소가 필요했음.

### Refactor Later (needs migration first)
1. `src/types/server-metrics.ts`
- deprecated field 주석은 있으나 타입 경로가 넓게 연결되어 있어 점진 제거 필요.

### Delete Candidate (low-risk)
1. `src/types/index.ts`
- 내부 코드베이스에서 `@/types` 또는 `@/types/index` import 사용처 미발견.
- 2026-02-21 삭제 적용 완료.

## Changes Applied in this pass
1. Deprecated alias 제거
- `src/lib/redis/ai-cache.ts`
  - `AIResponse` alias 제거
  - 시그니처를 `CachedAIResponse`로 통일
- `src/lib/redis/index.ts`
  - export 타입을 `CachedAIResponse`로 정리

2. Documentation drift 정리
- `docs/status.md`
  - 과거 `test:vercel:ai` 표기를 현행 전략(`test:contract`) 기준으로 주석 보완

3. Dead barrel 제거
- `src/types/index.ts` 삭제
- 내부 검색 기준 참조 0건 상태에서 제거

4. 런타임 레거시 타입 의존 축소
- `src/validators/validation.ts`의 `ApiError`를 로컬 타입으로 전환
- `@/types/common-replacements` 런타임 import 제거

5. 테스트 전용 타입 유틸 분리
- `src/types/common-replacements.ts` 삭제
- `src/utils/safe-type-utils.ts` 신설 후 테스트 import 이관

6. `supabase-auth` 호출부 마이그레이션
- `src/app/login/LoginClient.tsx`: OAuth 호출을 `signInWithOAuthProvider` 직접 호출로 전환
- `src/components/providers/SupabaseAuthProvider.tsx`: `getSupabase().auth.onAuthStateChange` 직접 구독으로 전환
- `src/app/login/LoginClient.stories.tsx`: 스토리 모킹 대상을 `supabase-auth-oauth`로 전환

7. 레거시 Auth 래퍼 제거
- `src/lib/auth/supabase-auth.ts` 삭제
- 파일 삭제 후 `supabase-auth` 직접 참조 0건 확인

8. Guest 세션 키 단일화 (진행 완료)
- 신규 공통 유틸 추가: `src/lib/auth/guest-session-utils.ts`
  - `auth_session_id` 중심 판별 함수 및 레거시(`guest_session_id`, `auth_type`) 하위호환 파서 제공
- 쓰기 경로 단일화
  - `src/lib/auth/auth-state-manager.ts`, `src/app/login/LoginClient.tsx`, `src/lib/security/secure-cookies.ts`
  - 신규 게스트 세션 생성 시 `auth_type`/`guest_session_id`를 더 이상 쓰지 않고 `auth_session_id`만 기록
- 읽기 경로 하위호환 유지
  - `src/proxy.ts`, `src/hooks/useAuth.ts`, `src/hooks/useAutoLogout.ts`, `src/hooks/useSupabaseSession.ts`
  - `auth_session_id` 우선, legacy 키는 fallback 인식
- 레거시 정리 경로 유지
  - 로그아웃/스토리지 정리 시 `auth_type`, `guest_session_id` 삭제는 계속 수행
- 관련 테스트 갱신
  - `src/lib/security/secure-cookies.test.ts`
  - `src/lib/auth/auth-state-manager.test.ts`
  - `tests/e2e/login.spec.ts`
  - `tests/e2e/helpers/guest.ts`

## Next cleanup order
1. `auth_type` 읽기 fallback 제거 가능 시점 정의 (배포 1~2 사이클 관찰 후 삭제)
2. `auth_type`/`guest_session_id` 삭제를 위한 마이그레이션 공지 및 최종 제거 PR 분리
