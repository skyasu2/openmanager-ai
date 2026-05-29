# 작업 계획서: 라우팅 패턴 파일 리팩토링

**작성일**: 2026-05-29  
**상태**: 계획 수립  
**우선순위**: Medium  
**예상 소요**: 단계별 독립 실행 가능

---

## 배경 및 목적

### 현재 문제

| 파일 | 줄수 | 정규식 수 | 위치 |
|------|:----:|:--------:|------|
| `src/lib/ai/chat-artifacts/chat-artifact-intent.ts` | 368 | 23개 | Vercel (프론트) |
| `cloud-run/.../routing/query-routing-signals.ts` | 606 | 32개 | Cloud Run |
| `cloud-run/.../routing/routing-patterns.ts` | 45 | 5개 | Cloud Run |

- **이중 패턴 레이어**: 프론트와 Cloud Run이 각자 독립적으로 패턴 분류 → 새 쿼리 유형 추가 시 두 곳 동시 수정 필요
- **`query-routing-signals.ts` 비대화**: 패턴 정의 + 신호 감지 + 에이전트 선택 로직이 한 파일에 혼재, 606줄
- **`SERVER_KEYWORDS` 배열과 `INFRA_CONTEXT_PATTERN` 중복**: 동일 목적의 키워드가 두 가지 형태로 존재
- **`FORMATTING_ONLY` 로직 불일치**: 프론트(패턴 1개)와 Cloud Run(패턴 3개)의 구현이 diverge

### 목표
- 파일당 200줄 이하 유지
- 새 패턴 추가 시 한 곳만 수정
- 기능 회귀 없음 (테스트 통과 필수)

---

## 단계별 계획

### Phase 1 — `query-routing-signals.ts` 파일 분할 [리스크 없음]

> 로직 변경 없이 물리적으로 분리. 기존 파일은 re-export 껍데기로 유지.

**대상 파일**: `cloud-run/ai-engine/src/services/ai-sdk/routing/`

```
변경 전:
  query-routing-signals.ts  (606줄, 전부)

변경 후:
  routing-keywords.ts          # SERVER_KEYWORDS, GREETING_PATTERNS, GENERAL_PATTERNS
  routing-signals-classify.ts  # getQueryRoutingScope, getQueryRoutingMetric, getToolIntentCategory 등 분류 함수
  routing-signals-build.ts     # buildPreFilterSignal, getQueryRoutingSignal (핵심 public API)
  query-routing-signals.ts     # 위 3개에서 re-export만 (하위 호환 유지)
```

**체크리스트**:
- [ ] `routing-keywords.ts` 작성 (SERVER_KEYWORDS, GREETING_PATTERNS, GENERAL_PATTERNS, TOOL_ROUTING_PATTERNS)
- [ ] `routing-signals-classify.ts` 작성 (내부 분류 유틸 함수)
- [ ] `routing-signals-build.ts` 작성 (buildPreFilterSignal, getQueryRoutingSignal)
- [ ] `query-routing-signals.ts` → re-export 파일로 축소
- [ ] `npm run type-check` 통과
- [ ] `query-routing-signals.test.ts` 전체 통과

---

### Phase 2 — `SERVER_KEYWORDS` + `INFRA_CONTEXT_PATTERN` 통합 [낮은 리스크]

> 동일 목적의 두 가지 구현을 `routing-patterns.ts` SSOT로 통합.

**현재 상태**:
```typescript
// routing-keywords.ts (Phase 1 분리 후)
const SERVER_KEYWORDS = ['서버', 'cpu', '메모리', ... (33개 배열)];
const hasServerKeyword = SERVER_KEYWORDS.some(k => normalized.includes(k));

// query-routing-signals.ts
export const INFRA_CONTEXT_PATTERN = /서버|서벼|썹|인프라|... (regex)/i;
// → 두 곳이 같은 역할, 키워드 추가 시 둘 다 수정해야 함
```

**변경 방향**:
```typescript
// routing-patterns.ts에 추가
export const SERVER_CONTEXT_PATTERN = /서버|서벼|썹|인프라|...(기존 INFRA_CONTEXT + SERVER_KEYWORDS 병합)/i;

// routing-signals-build.ts에서
const hasServerKeyword = SERVER_CONTEXT_PATTERN.test(normalized);
// INFRA_CONTEXT_PATTERN 참조도 SERVER_CONTEXT_PATTERN으로 통일
```

**체크리스트**:
- [ ] `SERVER_KEYWORDS` 배열 항목과 `INFRA_CONTEXT_PATTERN` 누락 키워드 비교
- [ ] `routing-patterns.ts`에 `SERVER_CONTEXT_PATTERN` 추가 (기존 두 개 병합)
- [ ] `routing-keywords.ts`에서 `SERVER_KEYWORDS` 배열 제거
- [ ] `INFRA_CONTEXT_PATTERN` export 제거 → `SERVER_CONTEXT_PATTERN` re-export
- [ ] `query-routing-signals.test.ts` 전체 통과

---

### Phase 3 — `chat-artifact-intent.ts` 역할 축소 [중간 리스크]

> 프론트 패턴 파일의 책임을 "artifact trigger 판단"으로만 좁힘.

**현재 책임 (6가지 artifact 종류 판별)**:
- `incident-report`
- `monitoring-analysis`
- `server-monitoring-analysis` ← Cloud Run이 판단 가능
- `server-snapshot`            ← Cloud Run이 판단 가능
- `ops-procedure`              ← Cloud Run이 판단 가능
- `guidance`

**변경 후 책임 (3가지)**:
- `incident-report` (프론트에서 판단 필요: 아티팩트 패널 UI 트리거)
- `monitoring-analysis` (프론트에서 판단 필요: 아티팩트 패널 UI 트리거)
- `none`

`server-monitoring-analysis`, `server-snapshot`, `ops-procedure`는 Cloud Run 응답의 `artifactKind` 필드를 통해 사후 결정으로 전환.

**예상 효과**: 23개 패턴 → 약 8개 패턴, 368줄 → 약 150줄

**체크리스트**:
- [ ] `server-monitoring-analysis` 제거 후 Cloud Run `artifactKind` 응답 처리 확인
- [ ] `server-snapshot` 제거 후 동일 확인
- [ ] `ops-procedure` 제거 후 동일 확인
- [ ] `chat-artifact-intent.test.ts` 케이스 정리
- [ ] QA: 아티팩트 패널 열기 시나리오 회귀 테스트

---

### Phase 4 — artifact intent BFF 이관 [설계 변경, 중장기]

> 프론트 패턴 파일 완전 제거. `/api/ai/artifact-intent` 가 모든 판단 담당.

**현재**:
```
프론트 → classifyChatArtifactIntent() [로컬 패턴]
       → /api/ai/artifact-intent [Mistral LLM, 사실상 비활성]
```

**변경 후**:
```
프론트 → POST /api/ai/artifact-intent (항상 호출)
       ← { kind, reason } 반환
프론트는 결과만 받아 UI 렌더링
```

**사전 조건**:
- Phase 3 완료 (프론트 패턴 파일 축소 검증 후)
- `MISTRAL_SCALE_PLAN_CONFIRMED` 환경변수 설정 또는 대체 로직 확정
- `/api/ai/artifact-intent` latency 측정 (목표: p95 < 300ms)

**체크리스트**:
- [ ] `artifact-intent` 엔드포인트에 패턴 로직 이식
- [ ] 프론트에서 로컬 `classifyChatArtifactIntent()` 호출 제거
- [ ] 응답 캐싱 전략 결정 (동일 쿼리 중복 호출 방지)
- [ ] `chat-artifact-intent.ts` 파일 삭제

---

## 의존성 및 제약

- Phase 1 → Phase 2 → Phase 3 순서 권장 (각 단계가 전 단계에 의존)
- Phase 4는 Phase 3 완료 후 독립 판단
- 각 Phase 완료 후 `npm run ci:local:quick` 통과 필수
- QA 필요 항목: 아티팩트 패널 트리거, 에이전트 라우팅 정확도 (기존 QA suite 활용)

---

## 진행 안 하는 것 (scope out)

- `routing-patterns.ts`의 5개 SSOT 패턴 내용 변경 — 잘 동작 중, 건드리지 않음
- `llm-intent-classifier.ts` 변경 — 별도 개선 주제
- Cloud Run 에이전트 로직 변경 — 이 리팩토링의 범위 밖
