> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-13
> Tags: ai-engine, routing, cleanup, test, docs-automation

# AI 아키텍처 클린업 계획

## 배경

2026-04-28 ~ 2026-05-13 2주간 아키텍처 분석 결과, 신규 도입된 DomainPack / SemanticIntentFrame / Chat Artifact 시스템에서 실제 버그 및 유지보수 리스크 4건이 확인됨.

**작업 주체**: Codex 실행 → Claude 검토 후 승인

## Codex 분석 결과 (2026-05-13)

현재 AI Assistant 자연어 질의 전단은 단일 LLM planner가 모든 의도를 결정하는 구조가 아니라, 다음처럼 비용/권한 경계별로 분리된 layered router 구조다.

```text
사용자 입력
  ├─ artifact intent classifier
  │   ├─ local deterministic classifier
  │   └─ low-cost LLM classifier (/api/ai/artifact-intent, 제한적 fallback)
  │       → client artifact routeDecision(decidedBy=frontend)
  └─ normal assistant query
      ├─ local query classifier + clarification
      ├─ optional NLQ LLM entity/SemanticIntentFrame extraction
      └─ Cloud Run DomainIntentFrame/evidence provider
          → stream/job routeDecision + semanticQueryTrace
```

평가:
- Chat Artifact intent와 SemanticIntentFrame은 완전 통합보다 분리 유지가 맞다. Artifact intent는 “클라이언트에서 deterministic artifact를 실행할지”를 정하고, SemanticIntentFrame은 “Cloud Run domain evidence/routing에 어떤 슬롯 힌트를 줄지”를 정한다.
- 두 경로는 `routeDecision`, `assistantPlan`, `assistantResult`, `semanticQueryTrace` 같은 관측 메타데이터에서 합류하는 형태가 OpenManager 컨셉에 맞다. 단일 LLM planner로 합치면 Free Tier 비용, latency, artifact 권한 경계가 흐려진다.
- 이번 개선 대상의 핵심은 통합 자체가 아니라 routing signal SSOT 보장이다. `query-routing-signals` 구/신 파일 분열을 해소해 frontend semantic hint → Cloud Run routing/evidence의 관측 기준이 흔들리지 않게 한다.

---

## Task 목록

### P1 · `query-routing-signals` 파일 분열 해소

**실제 위험**: `supervisor-mode.ts`는 구 파일(`services/ai-sdk/query-routing-signals.ts`)을 import하고, `orchestrator-context.ts`는 신 파일(`services/ai-sdk/routing/query-routing-signals.ts`)을 import한다. 동일 쿼리가 서로 다른 신호 집합으로 분류될 수 있다.

**파일 현황**:
- 구 파일: `cloud-run/ai-engine/src/services/ai-sdk/query-routing-signals.ts` (41줄, 패턴 상수 정의)
- 신 파일: `cloud-run/ai-engine/src/services/ai-sdk/routing/query-routing-signals.ts` (551줄, 구 파일을 import해서 사용)

**import 현황** (구 파일 직접 참조 6곳):
```
domains/monitoring/routing-policy.ts
services/ai-sdk/supervisor-mode.ts
services/ai-sdk/supervisor-direct-knowledge-stream.ts
services/ai-sdk/supervisor-stream-messages.ts
services/ai-sdk/agents/orchestrator-context.ts    ← 이미 신 파일도 참조
services/ai-sdk/agents/orchestrator-routing.ts
```

**작업 절차**:
- [x] `test(spec)`: 신 파일 `extractQueryRoutingSignals`가 구 파일 패턴과 동일한 분류 결과를 내는지 회귀 테스트 커밋
- [x] 구 파일을 신 파일의 re-export stub으로 교체 (하위 호환 유지)
  ```typescript
  // query-routing-signals.ts (stub)
  export * from './routing/query-routing-signals';
  ```
- [x] `orchestrator-context.ts`의 중복 import 정리 (신 파일 단일 경로로 통일)
- [x] AI Engine type-check + targeted Vitest 통과 확인

**검증 기준**:
- `npm run type-check` (AI Engine) 통과
- 구 파일을 참조하던 6개 파일 import 경로 정상 동작 확인
- `git diff --check` 통과

---

### P2 · `artifact-workspace-store` 에러 경로 테스트 추가

**실제 위험**: `readArtifactReplayPackExport`가 localStorage에서 손상된 JSON 또는 구버전 스키마 데이터를 읽을 때 크래시할 수 있다. 이미 아티팩트를 저장한 사용자의 브라우저 캐시에서 발생 가능.

**대상 파일**: `src/lib/ai/chat-artifacts/artifact-workspace-store.ts`
**테스트 파일**: `src/lib/ai/chat-artifacts/artifact-workspace-store.test.ts`

**현재 에러 케이스 테스트**: 4개 (전체 11개 describe 중)

**추가할 테스트 시나리오**:
- [x] `test(spec)`: 손상된 JSON 문자열(`"not-json"`) 파싱 시 empty workspace 반환 확인
- [x] `test(spec)`: 구버전 snapshot(storeVersion 필드 없음) 읽기 시 정상 처리 확인
- [x] `test(spec)`: `null` localStorage 값 읽기 시 empty workspace 반환 확인

**작업 절차**:
- [x] 현재 구현이 이미 손상 JSON/import unsupported 경로를 방어함을 확인
- [x] `readArtifactReplayPackExport` 계약은 `{ status: 'rejected' }` 유지. `undefined` 반환으로 바꾸지 않음
- [x] root Vitest targeted 통과 확인

**검증 기준**:
- `npm run test:quick` 통과
- 추가된 3개 테스트 green

---

### P3 · `supervisor-routing.ts` 빈 파일 정리

**현황**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`가 9줄짜리 re-export 파일로만 존재. `domains/monitoring/routing-policy.ts`의 `IntentCategory` 타입을 그대로 재수출.

**작업 절차**:
- [x] `supervisor-routing.ts`를 import하는 파일 목록 확인
  ```bash
  grep -r "supervisor-routing" cloud-run/ai-engine/src --include="*.ts" -l
  ```
- [x] 각 import를 `domains/monitoring/routing-policy` 직접 경로로 교체
- [x] `supervisor-routing.ts` 파일 삭제
- [x] AI Engine type-check 통과 확인

**검증 기준**:
- `npm run type-check` (AI Engine) 통과
- `git diff --check` 통과

> **주의**: SDD 게이트 예외 — 파일 삭제 + import 교체이므로 failing test 선행 없이 직접 수정 허용.

---

### P4 · `guest` Disclosure 권한 의도 문서화

**현황**: `internal-disclosure-mode.ts`에서 `authType === 'guest' && authContext.userId`이면 developer 모드를 부여한다. 테스트 주석에 "server-issued userId"라고 설명되어 있으나 코드 자체에는 근거가 없어 security audit 시 지적 대상.

**대상 파일**: `src/app/api/ai/supervisor/internal-disclosure-mode.ts`

**작업 절차**:
- [x] 조건에 인라인 주석 추가:
  ```typescript
  // PIN 인증 완료된 게스트 세션은 서버가 발급한 userId를 가짐.
  // userId 없는 익명 guest는 developer 모드 부여하지 않음.
  if (authContext.authType === 'guest' && authContext.userId) {
  ```
- [x] `internal-disclosure-mode.test.ts` 테스트 설명이 의도를 충분히 설명하는지 확인
- [x] `git diff --check` 통과

> **주의**: SDD 게이트 예외 — 주석 추가이므로 failing test 선행 없이 직접 수정 허용.

---

---

### P5 · `docs/status.md` 동적 갱신 자동화

**배경**: 현재 `docs/status.md`의 버전 스냅샷, 릴리스 이력, QA 수치는 매번 수동으로 갱신해야 한다. 이미 CHANGELOG.md(릴리스 자동 생성), `qa-tracker.json`(QA 자동 누적), `package.json`(버전 SSOT)에 정보가 있으므로 스크립트로 자동 주입할 수 있다.

**데이터 소스 매핑**:

| status.md 항목 | 소스 파일 | 추출 방법 |
|--------------|---------|---------|
| `스냅샷 기준일` | 실행 시점 | `new Date()` KST |
| `현재 버전 스냅샷` | `package.json` | `.version` 필드 |
| `Last reviewed` (frontmatter) | 실행 시점 | `new Date()` KST |
| 최근 릴리스 목록 | `CHANGELOG.md` | `## [X.Y.Z]` 섹션 파싱 (최근 N개) |
| QA 수치 (선택) | `reports/qa/qa-tracker.json` | `.summary` 필드 |

**구현 방식 — HTML 마커 + ts-node 스크립트**:

`docs/status.md`에 교체 영역 마커를 삽입하고, 스크립트가 마커 사이 내용을 덮어쓴다.

```markdown
<!-- AUTO:version-header -->
**상태 스냅샷 기준일**: 2026-05-13 | **현재 버전 스냅샷**: v8.11.141
<!-- /AUTO:version-header -->
```

```markdown
<!-- AUTO:releases -->
- **v8.11.141** (2026-05-13) — AI response quality regression hardening, line-guard refactor
- **v8.11.140** (2026-05-12) — Routing decision trace hardening
...
<!-- /AUTO:releases -->
```

**스크립트**: `scripts/docs/update-status.ts`
- 기존 `docs:budget` 패턴과 동일하게 ts-node 기반
- `--write` 없으면 dry-run (diff만 출력)
- `--releases N` 플래그로 표시 릴리스 수 조정 (기본 5)
- CHANGELOG.md의 `## [X.Y.Z](url) (YYYY-MM-DD)` 섹션에서 버전·날짜·요약 추출
- QA 수치는 opt-in (`--with-qa` 플래그 시에만 주입)

**npm script 추가**:
```json
"docs:status:update": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON node_modules/ts-node/dist/bin.js scripts/docs/update-status.ts --write"
```

**릴리스 훅 연동**:
`scripts/release/publish.sh` 마지막에 `npm run docs:status:update` 자동 실행 — 릴리스마다 status.md가 자동 갱신됨.

**작업 절차**:
- [ ] `docs/status.md`에 `<!-- AUTO:version-header -->` / `<!-- AUTO:releases -->` 마커 삽입
- [ ] `scripts/docs/update-status.ts` 스크립트 작성
  - `package.json` → 버전 추출
  - `CHANGELOG.md` → 최근 5개 릴리스 파싱 (버전, 날짜, 주요 변경 요약)
  - 마커 사이 내용 교체
  - frontmatter `Last reviewed` + `스냅샷 기준일` 줄 업데이트
- [ ] `package.json`에 `docs:status:update` 스크립트 등록
- [ ] `scripts/release/publish.sh`에 `npm run docs:status:update` 연동
- [ ] dry-run 실행 확인 후 `--write` 실행해 결과 검증

**검증 기준**:
- `npm run docs:status:update` 실행 결과 status.md가 package.json 버전과 일치
- CHANGELOG.md 최신 5개 릴리스가 `<!-- AUTO:releases -->` 영역에 반영됨
- 마커 외부 수동 작성 영역(현재 스냅샷, 운영 규칙 등)은 변경되지 않음
- `npm run docs:lint:historical` 통과 (status.md 대상)

> **주의**: SDD 게이트 예외 — 문서 생성 스크립트이므로 failing test 선행 없이 직접 구현 허용.
> 단, dry-run 출력을 Claude가 확인한 후 `--write` 실행.

---

## 실행 순서

```
P1 (버그) → P2 (테스트) → P3 (정리) → P4 (문서화) → P5 (자동화)
```

P1과 P2는 독립적이므로 병렬 실행 가능. P3·P4는 P1 완료 후 진행 권장 (P3가 supervisor-routing 경로를 참조할 수 있어서). P5는 P1~P4와 완전히 독립적이므로 병렬 진행 가능.

---

## Codex 위임 프롬프트

```bash
bash scripts/ai/agent-bridge.sh --to codex "
reports/planning/ai-architecture-cleanup-plan.md 계획서를 실행해줘.

P1부터 순서대로 진행하고, 각 Task 완료 시 계획서의 체크박스를 업데이트해줘.
SDD 게이트 적용 항목(P1, P2)은 반드시 test(spec): 커밋을 먼저 올린 뒤 구현 커밋을 올려줘.
P3·P4·P5는 SDD 게이트 예외이므로 직접 수정해줘.

P5는 먼저 --write 없이 dry-run 출력을 남겨줘. Claude 확인 후 --write 실행할 예정.

각 Task 완료 후 검증 기준을 실행해서 통과 확인 후 다음 Task로 넘어가줘.
"
```

---

## Claude 검토 체크리스트

Codex 작업 완료 후 Claude가 확인:

- [ ] P1: 구 파일 stub이 신 파일 전체를 re-export하는지, 누락 export 없는지
- [ ] P1: `orchestrator-context.ts`에 중복 import 없는지
- [ ] P2: 추가된 테스트가 실제 production 경로(localStorage parse 실패)를 커버하는지
- [ ] P3: 파일 삭제 후 dead import 없는지 (`npm run type-check` 결과로 확인)
- [ ] P4: 주석이 security audit 기준을 충족하는지
- [ ] P5 dry-run: status.md 버전·날짜·릴리스 5개가 정확히 추출됐는지 확인
- [ ] P5 dry-run: 마커 외부 영역(현재 스냅샷, 운영 규칙)이 변경되지 않는지 확인
- [ ] P5 `--write` 승인 후: `npm run docs:lint:historical` 통과 확인
- [ ] 전체: `npm run validate:all` 최종 통과
