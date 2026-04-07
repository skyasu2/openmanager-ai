# [작업 계획서] 타입 시스템 정제 및 인프라 최적화 (Phase 2)

## 1. 개요 (Overview)
- **목표**: `type-check:changed`의 성능 병목을 해결하고, `src/types/` 하위의 파편화된 타입들을 계층화/통합하여 유지보수성을 높인다.
- **배경**: WSL/Windows FS 환경에서 `tsc`의 전체 프로젝트 체크 비용(100s+)이 pre-push 타임아웃(60s)을 유발함. 또한 `server-common.ts` 등 중계 파일이 불필요한 인디렉션을 형성함.
- **현재 판단**: Step 1의 correctness review를 마쳤고, `files: [...]` 기반 scoped mode는 역방향 의존성 false-negative 가능성 때문에 제거했다. 빠른 경로는 `src/types/**` 위임과 tooling-only skip으로 유지한다.

## 2. 작업 범위 (Scope)
- **인프라**: `scripts/dev/typecheck-changed.sh`, `scripts/dev/typecheck-scope.js`, pre-push build validation (changed type-check 범위 정책)
- **타입 정제**: `src/types/server/` (base, core, metrics, entities)
- **공통화**: `src/types/common.ts` (Pagination, LogLevel 등)

## 3. 단계별 실행 계획 (Steps)

### Step 1: 성능 최적화 및 기본 타입 통합 (완료)
- [x] `typecheck-changed.sh`에 `files: [...]` 스코프 체크 도입 (100s → 12s 단축)
- [x] `src/types/server-common.ts`를 `src/types/server/base.ts`로 통합
- [x] `src/types/server/core.ts` 및 `metrics.ts` 의존성 수정
- [x] `typecheck-changed.sh` 공백 처리 버그 수정 (`tr ' ' '\n'`)
- [x] `src/types/**` 단독 변경과 tooling-only script 변경을 quick/delegated path로 분리
- [x] `files: [...]` scoped mode correctness review 완료 → false-negative 위험 때문에 제거, `tsconfig.check.json` full-project fallback으로 환원
- **결과**: 커밋 `709d88954` 이후 correctness fix까지 반영, Step 2 착수 가능 상태

### Step 2: 서버 타입 SSOT 정제 (진행 예정)
- [ ] `src/types/server/entities.ts` 내의 데이터/네트워크 엔티티를 `base.ts`와 정렬
- [ ] `src/types/server/types.ts`의 `ServerRole`, `ServerEnvironment` 표준화
- [ ] `src/types/server/index.ts` 재수출 구조 최적화 (중복 제거)
- [ ] `src/components/dashboard/EnhancedServerModal.types.ts`의 `ServerSpecs` / `ServerHealth`를 `src/types/server/base.ts`와 정렬하거나 의도적으로 분리

### Step 3: 공통 유틸리티 타입 통합 (진행 예정)
- [ ] `PaginationInfo`, `LogLevel` 등을 `common.ts`로 단일화
- [ ] `src/types/README.md`에 타입 정의 원칙(SSOT) 최신화
- [ ] Knip 잔여 미사용 export (P3) 정리 완료

## 4. 검증 계획 (Verification)
- [x] `npm run lint` && `npm run type-check` 통과 확인
- [x] `TYPECHECK_CHANGED_FILES` 시뮬레이션을 통한 스코프 체크 동작 확인
- [x] `tests/unit/dev/typecheck-scope.test.ts` 분류 로직 테스트 추가
- [x] `tests/unit/dev/typecheck-changed.test.ts` standalone changed type-check 위임/skip 테스트 추가
- [x] 실제 `src/types/**` 단독 push에서 delegated path 동작 확인
- [x] scoped mode correctness 정리 완료 (`tsconfig.check.json` full-project fallback 회귀 테스트 추가)

## 5. 일정 및 상태
- **시작일**: 2026-04-07
- **현재 단계**: Step 1 완료 / Step 2 착수 준비 중
- **담당**: AI Agent
