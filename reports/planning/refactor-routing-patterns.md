# 작업 계획서: 라우팅 패턴 파일 리팩토링

**작성일**: 2026-05-29  
**Owner**: project  
**상태**: Phase 1~3 완료 (Phase 4 보류)  
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

## 보류 단계

### Phase 4 — artifact intent BFF 이관 (중장기)

**선행 조건:**
1. stream handler에 `artifactKind` 수신 → `startChatArtifactGeneration` 트리거 로직 추가
2. Phase 3 나머지 3종 제거 검증 (아티팩트 패널 회귀 테스트)
3. `MISTRAL_SCALE_PLAN_CONFIRMED` 환경변수 설정 또는 Mistral 대체 결정
4. `/api/ai/artifact-intent` latency 측정 (목표: p95 < 300ms)

**완료 시 효과:**
- `chat-artifact-intent.ts` 패턴 수 20개 → 0개 (파일 삭제)
- 프론트에서 라우팅 패턴 로직 완전 제거
- 새 artifact 종류 추가 시 BFF 1곳만 수정

**체크리스트:**
- [ ] stream response handler에 `artifactKind` 처리 추가
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
