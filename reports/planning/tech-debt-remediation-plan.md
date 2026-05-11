> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-11
> Tags: tech-debt,dependency,testing,refactor,zod,pino,security

# 기술 부채 해소 계획 (2026-05-11)

- **상태**: Approved
- **작성일**: 2026-05-11
- **분석 기반**: `npm audit`, npm registry 직접 비교, 코드 정적 분석 (2026-05-11 수행)
- **TODO.md 연결**: Backlog > "Zod v4 AI Engine migration", "API 라우트 테스트 커버리지", "pino 버전 정렬"
- **선행 작업**: `archive/line-guard-current-hotspots-refactor-plan.md` 완료

---

## 부채 분류 요약

| 등급 | 항목 | 현황 |
|------|------|------|
| P0 (보안, 대기) | Next.js CVE 6건 | upstream 패치 미출시 — Backlog 유지 |
| P1 | Zod v3 ↔ v4 이중화 | 완료 — 루트 v4 / AI Engine v4.4.3 |
| P2 | API 라우트 테스트 미커버 | 일부 핵심 route handler 직접 테스트 미흡 — `/api/metrics` status label 결함 확인 |
| P2 | `useAIChatCore.ts` artifact 로직 혼재 | line-guard 계획과 병행 |
| P3 | pino v9 ↔ v10 이중화 | 루트 v10 / AI Engine v9 |
| P3 | React 19.2.4 → 19.2.6 패치 | 2 patch 뒤처짐 |

> **P0 (Next.js CVE)** 는 이미 `Dependency security audit follow-up` Backlog에서 추적 중이며 이 계획서에서 중복 관리하지 않는다.  
> **파일 크기 부채 (`AIWorkspace.tsx`, `LogExplorerModal.tsx` 등)** 는 `line-guard-current-hotspots-refactor-plan.md`가 담당한다.

---

## Task 1 — Zod v4 AI Engine 마이그레이션 (P1)

**담당**: Codex 위임 권장  
**예상 규모**: 파일 수정 10~15개, 테스트 포함

### 배경

루트 앱은 Zod v4 (`^4.3.6`)를 사용하고, AI Engine은 v3 (`^3.25.76`)를 사용한다.
두 코드베이스가 현재는 독립 런타임으로 격리되어 있어 즉각 충돌은 없으나, v3 ↔ v4 사이의 API 시그니처 차이로 인해 향후 타입 공유 시 전면 수정이 불가피하다. 조기 정렬이 부채 누적을 막는다.

**주요 파괴적 변경 (v3 → v4)**:
- `z.string().email()` → `z.email()` (top-level)
- `z.string().uuid()` → `z.uuid()` (top-level)
- `z.string().url()` → `z.url()` (top-level)
- `z.number().int()` 의 unsafe integer 허용 제거
- Error 커스터마이징 API 통합 (`message` deprecated, `error` 통합)

### 영향 파일 확인

```bash
# AI Engine 내 v3 API 사용 파일
grep -rn "z\.string()\.\(email\|uuid\|url\)" cloud-run/ai-engine/src --include="*.ts"
grep -rn "z\.number()\." cloud-run/ai-engine/src --include="*.ts"
```

현재 확인된 v3 API 사용:
- `cloud-run/ai-engine/src/tools-ai-sdk/vision-url-tool.ts`: `z.string().url()`

### 작업 단계

- [x] **Task 1-0** (SDD): failing test 선행 커밋
  - `cloud-run/ai-engine/src/tools-ai-sdk/vision-url-tool.test.ts` — v4 API 기준 스키마 검증 테스트
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/schemas.test.ts` — v4 호환 회귀 테스트
  - 커밋: `test(spec): zod v4 migration add failing tests before implementation`

- [x] **Task 1-1**: `cloud-run/ai-engine/package.json` zod `^3.24.1` → `^4.4.3`

- [x] **Task 1-2**: AI Engine 소스 v3→v4 API 마이그레이션
  - `vision-url-tool.ts`: `z.string().url()` → `z.url()`
  - `schemas.ts` 전체 v4 호환 확인 (`.object()`, `.enum()`, `.number()` 등)
  - Error 파라미터 패턴 확인

- [x] **Task 1-3**: `npm run type-check` + `vitest run` AI Engine 통과 확인
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - targeted Vitest 4 files / 42 tests 통과
  - `cd cloud-run/ai-engine && npm run test` 110 files / 1091 tests 통과
  - `npm run test:contract` 3 files / 24 tests 통과
  - `cd cloud-run/ai-engine && npm audit --omit=dev`, full `npm audit` 0 vulnerabilities
  - Local deterministic QA `QA-20260511-0471` 기록

- [x] **Task 1-4**: `package-lock.json` 재생성, 커밋
  - 커밋: `feat(ai-engine): migrate zod v3 to v4`

### 완료 기준

```bash
cd cloud-run/ai-engine && npm run test  # 전체 통과
grep -r "z\.string()\.\(email\|url\|uuid\)" src  # 0건
```

### 문서 수정

- `docs/reference/architecture/infrastructure/resilience.md` — 의존성 버전 정렬 정책 섹션에 "AI Engine zod v4 정렬 완료" 기록
- `reports/planning/TODO.md` — 완료 처리

---

## Task 2 — API 라우트 테스트 커버리지 (P2)

**담당**: Codex 위임 권장  
**예상 규모**: 테스트 파일 4~6개 신규 작성

### 배경

소스 파일 645개 대비 테스트 파일 423개로 전체 비율 65%는 양호하나, 일부 핵심 API route handler는 직접 테스트가 부족하다. 기존 "15개 무테스트" 표현은 현재 코드 기준으로 stale/과장 요소가 있다. 예를 들어 `/api/ai/supervisor`는 route handler 직접 테스트는 없지만 security/request/cloud-run/cache/session/stream 하위 테스트가 다수 존재한다. 따라서 이 작업은 숫자형 커버리지 확대가 아니라 실제 route handler 계약 결함을 고정하는 방향으로 축소한다.

**확인된 실제 결함**:
- [x] `src/app/api/metrics/route.ts`는 `openmanager_server_status` metric을 지원하지만, PromQL 결과에 `status` label을 붙이는 조건이 `server_status`로 되어 있어 status label이 누락될 수 있었다. `src/app/api/metrics/route.test.ts` failing test 선행 커밋 후 `openmanager_server_status` 조건으로 수정 완료. Local deterministic QA `QA-20260511-0472` 기록.

**무테스트 라우트 (우선순위 기준)**:

| 파일 | 위험도 | 이유 |
|------|--------|------|
| `src/app/api/ai/supervisor/route.ts` | **높음** | AI 질의 핵심 진입점, 인증·라우팅 분기 |
| `src/app/api/ai/status/route.ts` | 중간 | AI 엔진 상태 반환, 장애 탐지 의존 |
| `src/app/api/ai/wake-up/route.ts` | 중간 | Cold start 워밍 로직 |
| `src/app/api/servers/route.ts` | 중간 | 서버 목록 API, 대시보드 의존 |
| `src/app/api/metrics/route.ts` | 중간 | 메트릭 API, 여러 컴포넌트 의존 |
| `src/app/api/csrf-token/route.ts` | 중간 | 보안 토큰 발급 경로 |

### 작업 단계

- [x] **Task 2-0** (SDD): failing test 파일 선행 커밋
  - `src/app/api/metrics/route.test.ts` — `openmanager_server_status` status label 보존 계약
  - 커밋: `test(spec): api route coverage add failing tests before implementation`

- [ ] **Task 2-1**: `/api/ai/supervisor/route.ts` 테스트 작성 (최우선)
  - `src/app/api/ai/supervisor/route.test.ts`
  - 시나리오:
    - 인증 없는 요청 → 401 반환
    - 인증 있는 GET → status 응답 확인
    - POST 질의 → supervisor 라우팅 트리거 확인 (MSW mock)
    - rate limit 초과 → 429 응답

- [ ] **Task 2-2**: `/api/ai/status/route.ts` + `/api/ai/wake-up/route.ts` 테스트
  - AI Engine healthy 응답 mock → 정상 상태 반환
  - AI Engine timeout mock → fallback 응답 확인

- [ ] **Task 2-3**: `/api/servers/route.ts` + `/api/metrics/route.ts` 테스트
  - OTel 데이터 로더 mock → 서버 목록 형식 검증
  - 필터 파라미터 처리 확인
  - 부분 완료: `/api/metrics` `openmanager_server_status` status label 계약 추가 및 결함 수정

- [ ] **Task 2-4**: `npm run validate:all` 통과 확인, 커밋
  - 커밋: `test: add api route coverage for supervisor and core endpoints`

### 완료 기준

```bash
npm run test:quick  # 기존 178개 + 신규 통과
# supervisor route 테스트 ≥ 4개 scenario
```

### 문서 수정

- `docs/guides/testing/test-strategy.md`
  - "§ API 라우트 커버리지 정책" 섹션 추가 (아래 신설 내용 참조)

---

## Task 3 — pino 버전 정렬 (P3)

**담당**: Codex 위임 권장  
**예상 규모**: 파일 1개 수정, package.json 1개 수정

### 배경

루트 앱 `pino@10.3.1`, AI Engine `pino@9.6.0`. AI Engine의 `logger.ts`는 최근 `@google-cloud/pino-logging-gcp-config` 제거로 전면 재작성됐다. 이 시점에 v10으로 정렬하면 향후 pino v10 API 활용 통일이 가능하다.

**v9 → v10 변경점 확인 필요**:
- `pino.destination()` 시그니처 변화
- transport 옵션 변경 여부

### 작업 단계

- [ ] **Task 3-1**: pino v9 → v10 변경점 확인
  ```bash
  npm view pino@10 peerDependencies
  # CHANGELOG 상 breaking change 확인
  ```

- [ ] **Task 3-2**: `cloud-run/ai-engine/package.json` `pino: "^9.6.0"` → `"^10.3.1"`

- [ ] **Task 3-3**: `logger.ts` v10 호환 확인 (대부분 호환 예상)

- [ ] **Task 3-4**: AI Engine 테스트 통과 확인, 커밋
  - 커밋: `chore(ai-engine): align pino to v10`

### 완료 기준

```bash
cd cloud-run/ai-engine && node -e "require('pino'); console.log('ok')"
```

---

## Task 4 — React 패치 업데이트 (P3)

**담당**: 단독 처리 가능  
**예상 규모**: 단순 버전 업, 10분 작업

### 배경

현재 `react@19.2.4`, 최신 `19.2.6` (2026-05-08 기준). 2 patch 뒤처짐. 보안 이슈는 없으나 버그 수정 포함.

### 작업 단계

- [ ] **Task 4-1**:
  ```bash
  npm install react@^19.2.6 react-dom@^19.2.6
  npm run type-check
  npm run test:quick
  ```

- [ ] **Task 4-2**: 커밋
  - 커밋: `chore: update react to 19.2.6`

---

## 문서 신설 / 수정 계획

아래 문서 작업은 Task 완료 후 진행한다.

### 수정 1: `docs/guides/testing/test-strategy.md`

**목적**: API 라우트 커버리지 정책 명문화  
**추가 섹션 위치**: 기존 "§ Coverage Policy" 다음  
**내용 요약**:

```markdown
## API Route Coverage Policy

API 라우트(`src/app/api/**/**/route.ts`)는 아래 우선순위 기준으로
계약 테스트를 유지한다.

| 등급 | 기준 | 요구 테스트 |
|------|------|-------------|
| Critical | AI 질의 진입점, 인증 게이트 | 인증 실패 / 정상 응답 / rate limit |
| High     | 서버·메트릭 데이터 API       | 응답 형식 / 필터 파라미터 |
| Medium   | 상태·헬스체크 API            | healthy / degraded 분기 |
| Low      | 유틸리티 (version, csrf)     | 최소 smoke |

테스트 없이 머지 가능한 유일한 예외:
- `src/app/api/(auth)/**` — Next-Auth 내부 처리
- `src/app/api/error-report/**` — 단순 로그 포워드
```

### 수정 2: `docs/reference/architecture/infrastructure/resilience.md`

**목적**: 의존성 버전 이중화 관리 정책 추가  
**추가 섹션**: "§ 의존성 버전 정렬 정책"  
**내용 요약**:

```markdown
## 의존성 버전 정렬 정책

루트 앱(Vercel)과 AI Engine(Cloud Run)은 독립 배포되지만,
아래 기준으로 핵심 패키지 버전을 정렬한다.

| 패키지 | 정렬 방식 | 비고 |
|--------|----------|------|
| zod    | 동일 major 유지 | 타입 공유 가능성 대비 |
| pino   | 동일 major 유지 | 로깅 동작 일관성 |
| typescript | 동일 exact 버전 | 타입 호환 필수 |
| @ai-sdk/* | 루트 기준으로 AI Engine 후행 허용 | SDK 계약 변경 대응 |

분기가 발생하면 tech-debt-remediation 계획서에 기록하고
다음 정기 유지보수 사이클에서 정렬한다.
```

### 신설: `docs/reference/architecture/infrastructure/dependency-policy.md`

**조건**: Task 1~3 완료 후 신설 (현재 없음)  
**목적**: 의존성 관리 정책 단일 문서화  
**Doc type**: Reference  
**예상 내용**:
- 버전 정렬 기준표 (루트 ↔ AI Engine)
- npm audit 대응 의사결정 트리 (같은 major 패치 대기 / force downgrade 금지 / 내부 대체 구현)
- Free Tier 가드레일 (배포 비용 영향 패키지 변경 시 체크리스트)
- Zod 마이그레이션 이력 (v3→v4, 2026-05)

> **예산 확인**: 신설 전 `npm run docs:budget`으로 73개 → 74개가 90개 한도 내인지 확인.

---

## 실행 순서 권장

```
Task 1 (Zod v4)     → Task 3 (pino)    → Task 2 (테스트)    → Task 4 (React)
  P1, 단독 AI Engine  P3, 단독 AI Engine  P2, 루트 앱 전용     P3, 단순 버전업

                                           ↓ 완료 후
                                      문서 수정 (test-strategy, resilience)
                                           ↓
                                      문서 신설 (dependency-policy) — 조건부
```

Task 1과 3은 AI Engine만 건드리므로 병렬 실행 가능하다.  
Task 2는 루트 앱 테스트라 Task 1/3과 독립적으로 병렬 진행 가능하다.

---

## SDD 게이트 요약

| Task | 선행 test 커밋 필요 | 예외 |
|------|-------------------|------|
| Task 1 (Zod) | ✅ 필요 | — |
| Task 2 (테스트) | ✅ 필요 (빈 시나리오 먼저) | — |
| Task 3 (pino) | ❌ 불필요 | 소규모 버전 업 |
| Task 4 (React) | ❌ 불필요 | 소규모 버전 업 |

---

## 완료 처리

모든 Task 완료 시:
1. 각 Task 체크박스 `[x]` 완료
2. `TODO.md` Backlog 항목 완료 이력으로 이동
3. 이 계획서 → `reports/planning/archive/tech-debt-remediation-plan.md` 이동
4. 의존성 버전 변경 커밋 메시지에 `[DEPS]` 태그 포함
