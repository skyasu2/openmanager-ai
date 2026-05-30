# 작업 계획서: 라우팅 패턴 파일 리팩토링

**작성일**: 2026-05-29  
**Owner**: project  
**상태**: In Progress (Phase 4A 완료, Phase 4B/C 보류)
**우선순위**: Medium  

---

## 배경 및 목적

### 해결한 문제

| 파일 | 변경 전 | 변경 후 |
|------|:-------:|:-------:|
| `query-routing-signals.ts` | 606줄, 단일 파일 | 55줄 re-export facade + 4개 분리 파일 |
| `SERVER_KEYWORDS` 배열 | 50개 항목 배열 | `SERVER_TOPIC_PATTERN` 정규식 |
| `chat-artifact-intent.ts` | 368줄, 23개 패턴 | 306줄, 20개 패턴 |
| `guidance` artifact 종류 | 존재 (5개 분기, UI prop chain) | 제거 완료 |

### 목표 달성 현황
- ✅ 파일당 200줄 이하 (routing 분할 파일 최대 204줄)
- ✅ 기능 회귀 없음 (GitLab validate pipeline `2561100115` success)
- ⏸ 새 패턴 추가 시 한 곳만 수정 — Phase 4에서 완결

---

## 완료된 단계

### Phase 1 — `query-routing-signals.ts` 파일 분할 ✅ 완료

커밋: `fc7a26b87`

```
routing-keywords.ts       (91줄)  # 패턴 상수 + SERVER_TOPIC_PATTERN
routing-signals-types.ts  (77줄)  # 타입 및 인터페이스
routing-signals-classify.ts (157줄) # 분류 함수
routing-signals-build.ts  (204줄)  # extractQueryRoutingSignals 공개 API
query-routing-signals.ts  (55줄)   # re-export facade (하위 호환 유지)
```

---

### Phase 2 — `SERVER_KEYWORDS` 전환 ✅ 완료 (설계 변경 확정)

커밋: `fc7a26b87`

**설계 결정 (2026-05-29 확정)**:
원안의 `SERVER_CONTEXT_PATTERN` 단일 SSOT 통합 대신 의미 분리 설계를 최종안으로 채택.

| 패턴 | 위치 | 역할 |
|------|------|------|
| `INFRA_CONTEXT_PATTERN` | `routing-keywords.ts` | 인프라 기술어 여부 (`routing-policy.ts`의 웹 검색 강제·범용 쿼리 판별에 독립 사용) |
| `SERVER_TOPIC_PATTERN` | `routing-keywords.ts` | 모니터링 시나리오 주제어 여부 (pre-filter 게이트 전용) |

두 패턴을 병합하면 `routing-policy.ts`의 `shouldForceWebSearch()`·`isBestEffortGeneralQuery()` 의미가 파괴되므로 분리 유지가 올바른 설계.

---

### Phase 3 — `chat-artifact-intent.ts` 역할 축소 (안전한 범위) ✅ 완료

커밋: `fc7a26b87`, `7ed7eb811`

**완료 항목:**
- `guidance` 종류 제거 → how-to 질문은 Cloud Run 자연어 응답으로 처리
- `isHowToRequest()` guard 추가 — action 경로 및 implicit 경로 모두 적용
- UI prop chain (`guidanceCta`, `handleArtifactGuidanceCta`) 10개 파일에서 제거
- intent eval 코퍼스 갱신 (guidance → none, 전 카테고리 accuracy 1.00)

**미완료 → Phase 4로 이관:**
- `server-monitoring-analysis` / `server-snapshot` / `ops-procedure` 프론트 분류 제거
  - 이유: Cloud Run 응답의 `artifactKind` 를 받아 아티팩트를 사후 트리거하는 메커니즘이
    프론트에 없음. Phase 4에서 stream handler 수정과 함께 처리 필요.

---

## 착수 단계

### Phase 4A — post-decision artifact bridge

**목표:**
- Cloud Run/BFF 응답의 `routeDecision`/`assistantPlan`/`assistantResult`에 포함된 `artifactKind`를 프론트에서 사후 수신한다.
- 사후 수신한 `artifactKind`가 `client-artifact` 실행 경로일 때만 기존 `startChatArtifactGeneration()`으로 연결한다.
- 기존 프론트 pre-send 분류는 fallback으로 유지한다. Phase 4A에서는 `chat-artifact-intent.ts` 삭제나 패턴 제거를 하지 않는다.

#### 계약 (Contract)

**변경 대상 파일**
- `src/hooks/ai/core/asyncQuerySSE.ts` 또는 SSE result 소비 계층
- `src/hooks/ai/core/chat-artifact-guidance.ts`
- `src/hooks/ai/core/chat-artifact-execution.ts`
- `src/hooks/ai/useAIChatCore.ts`
- 관련 테스트 파일

**입력 후보 우선순위**

| 후보 | 조건 | 결과 |
|------|------|------|
| `assistantResult.artifactKind` | `executionPath === 'client-artifact'` | `ChatArtifactIntent` 변환 |
| `assistantPlan.artifactKind` | `executionPath === 'client-artifact'` | `ChatArtifactIntent` 변환 |
| `assistantPlan.routeDecision.artifactKind` | `executionPath === 'client-artifact'` | `ChatArtifactIntent` 변환 |
| `routeDecision.artifactKind` | `executionPath === 'client-artifact'` | `ChatArtifactIntent` 변환 |

**출력 계약**

| 함수/경로 | 입력 | 출력 | 예외/무시 조건 |
|----------|------|------|----------------|
| post-decision intent resolver | async job result metadata + 원본 query | `ChatArtifactIntent \| null` | `artifactKind` 없음, 미지원 kind, `executionPath !== 'client-artifact'` |
| post-result handler | resolver 결과 + 현재 artifact 상태 | `startChatArtifactGeneration()` 0~1회 호출 | 이미 artifact 생성 중/완료, pre-send 처리 완료, unsupported kind |

**지원 kind**
- `incident-report`
- `monitoring-analysis`
- `server-monitoring-analysis`
- `server-snapshot`
- `ops-procedure`

**중복 실행 방지**
- 같은 사용자 query에서 pre-send artifact generation이 이미 실행됐으면 post-decision handler는 실행하지 않는다.
- post-decision metadata 후보가 여러 개 있어도 한 번만 실행한다.

#### 테스트 시나리오 (구현 전 확정)

- [ ] `assistantPlan.routeDecision.artifactKind=server-snapshot` + `executionPath=client-artifact` → `server-snapshot` intent로 변환한다.
- [ ] `routeDecision.artifactKind=server-monitoring-analysis`가 `client-artifact` 경로로 들어오면 query에서 serverId를 재해석해 intent에 포함한다.
- [ ] `executionPath=job` 또는 `artifactKind` 없는 일반 응답은 artifact generation을 호출하지 않는다.
- [ ] pre-send 분류로 이미 artifact generation을 시작한 경우 post-decision handler가 중복 호출하지 않는다.
- [ ] async job SSE metadata가 `assistantPlan`/`routeDecision.artifactKind`를 클라이언트 결과까지 보존한다.

#### Task 목록

- [x] Task 0 — failing test 커밋: 위 테스트 시나리오를 계약 테스트로 추가 (`91e69e24c`)
- [x] Task 1 — post-decision resolver 추가
- [x] Task 2 — async result 수신 후 `startChatArtifactGeneration()` 연결
- [x] Task 3 — targeted test/type-check 실행

#### Phase 4A 완료 기준

- [x] 테스트 시나리오 전체 통과
- [x] `npm run type-check` 통과
- [x] `npm run test:quick` 및 targeted test 통과
- [x] 프론트 pre-send 분류 fallback 유지 확인

---

## 보류 단계

### Phase 4B/C — artifact intent BFF 완전 이관

**선행 조건:**
1. Phase 4A 완료: stream/job result post-decision 메커니즘 추가
2. Phase 3 나머지 3종 제거 검증 (아티팩트 패널 회귀 테스트)
3. `MISTRAL_SCALE_PLAN_CONFIRMED` 환경변수 설정 또는 Mistral 대체 결정
4. `/api/ai/artifact-intent` latency 측정 (목표: p95 < 300ms)

**완료 시 효과:**
- `chat-artifact-intent.ts` 패턴 수 20개 → 0개 (파일 삭제)
- 프론트에서 라우팅 패턴 로직 완전 제거
- 새 artifact 종류 추가 시 BFF 1곳만 수정

**체크리스트:**
- [ ] Phase 4A post-decision bridge 완료
- [ ] `server-monitoring-analysis` 프론트 분류 제거 + 회귀 테스트
- [ ] `server-snapshot` 프론트 분류 제거 + 회귀 테스트
- [ ] `ops-procedure` 프론트 분류 제거 + 회귀 테스트
- [ ] `artifact-intent` BFF에 패턴 로직 이식
- [ ] 프론트 `classifyChatArtifactIntent()` 호출 제거
- [ ] `chat-artifact-intent.ts` 파일 삭제

---

## scope out

- `routing-patterns.ts` 5개 SSOT 패턴 내용 변경 — 잘 동작 중
- `llm-intent-classifier.ts` 변경 — 별도 주제
- Cloud Run 에이전트 로직 변경 — 이 리팩토링 범위 밖
