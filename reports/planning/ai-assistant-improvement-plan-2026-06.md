# AI 어시스턴트 개선 작업 계획서 (2026-06)

> Owner: project
> Status: Draft
> Created: 2026-06-05
> Context: 구조·성능·상업화 분석 결과 (Claude, Playwright MCP + Langfuse REST API 기반)
> Ref: docs/reference/architecture/ai/ai-engine-evaluation.md

---

## 분석 요약

| 평가 축 | 현재 점수 | 목표 |
|--------|:--------:|:----:|
| 상업적 성숙도 (종합) | 6.5/10 | 8.0/10 |
| Harness Engineering | 65% | 80% |
| 코드 실용 재활용률 | 55% | 70% |
| AI 라우팅 정확도 | 7/10 | 8.5/10 |
| Langfuse P95 지연 | 10.4s | 6.0s 이하 |

---

## Task A — 라우팅 품질 개선

### A-1. "왜/원인" RCA 질문 Analyst 라우팅 보강

**현상**: `"db-mysql-dc1-backup 디스크 73% 왜 이렇게 높아?"` → `deterministic / monitoring-metric-current` (현황만 반환)

**원인**: 서버명+메트릭이 명시된 경우 NLQ entity extractor가 신뢰도 0.65 미만으로 semantic frame을 반환해 deterministic 경로가 우선됨.

**작업**:
- [ ] `orchestrator-direct-routing.ts` pre-filter 단계에서 "왜/원인/이유/때문" 패턴을 Analyst 강제 라우팅 조건에 추가
- [ ] 또는 `SEMANTIC_AGENT_CONFIDENCE_THRESHOLD` 를 의도 카테고리별로 분리 (RCA 카테고리는 0.5로 낮춤)
- [ ] 테스트 케이스: `"[서버명] [메트릭] 왜 높아?"` 형태의 5개 질문 Analyst 라우팅 확인

**예상 작업량**: 소규모 (orchestrator-direct-routing.ts 20~30줄)
**SDD 게이트**: test(spec) 선행 커밋 필요
**담당**: Codex 위임 가능

---

### A-2. Analyst P95 production 실측 비교

**현상**: v8.12.82 Analyst 1차 지연 개선(commit a2f4ba9a9) 이후 production before/after 비교 미수행.

**작업**:
- [ ] `npm run langfuse:check -- --limit 100 --q supervisor` 로 Analyst 라우팅된 트레이스 지연 추출
- [ ] 개선 커밋 전(2026-05-29 이전) vs 후 Analyst 경로 평균 비교
- [ ] 결과를 `ai-engine-evaluation.md` Langfuse 집계 기준선 섹션에 추가

**예상 작업량**: 분석 작업 (코딩 없음)
**담당**: Claude 직접 수행 가능

---

## Task B — Harness Engineering 자동 평가 파이프라인

### B-1. 라우팅 회귀 감지 스크립트 (LLM 없이)

현재 QA 658 runs는 전부 수동 판정. 라우팅 경로(provider, agent, 성공/실패)가 expected와 달라지면 자동으로 감지하는 스크립트가 없음.

**작업**:
- [ ] `scripts/qa/routing-regression-check.js` 작성
  - 입력: 기준 라우팅 테이블 (질문 → 예상 provider/agent)
  - 동작: `npm run langfuse:check -- --json` 출력으로 실제 라우팅과 비교
  - 출력: 예상과 다른 케이스 목록 + 이탈률(%)
- [ ] 기준 라우팅 테이블 정의 (오늘 테스트 5개 + 기존 QA pass 케이스 10개)
- [ ] `npm run qa:routing:check` 스크립트 등록

**예상 작업량**: 중간 (스크립트 200~300줄 + 기준 테이블 JSON)
**선행 조건**: Task A-2 완료 후 기준선 확정
**담당**: Codex 위임 적합

---

### B-2. Langfuse Score 활용 (LLM-as-judge 기초)

현재 Langfuse의 `scores` 필드를 운영 루프에서 전혀 활용하지 않음. 자동 품질 판정의 첫 단계로 규칙 기반 scorer 도입.

**작업**:
- [ ] `cloud-run/ai-engine/src/services/observability/langfuse-score.ts` 작성
  - 라우팅 일치 여부 (expected vs actual agent): binary score
  - 응답 완료 여부 (finalAnswer 도달): binary score
  - 지연 티어 (빠름/보통/느림): 3단계 score
- [ ] supervisor-execution trace에 score 자동 기록
- [ ] `npm run langfuse:check` 출력에 score 컬럼 추가

**예상 작업량**: 중간 (langfuse-score.ts 100줄 + trace 기록 연동 50줄)
**담당**: Codex 위임 적합

---

## Task C — 도메인 이식성 개선

### C-1. orchestrator-direct-routing.ts 중간층 상수 분리

**현상**: `orchestrator-direct-routing.ts` 43% 코드가 모니터링 특화 상수. 새 도메인 포팅 시 이 파일 수동 수정 필요.

**작업**:
- [ ] `AssistantDomain` 인터페이스에 `routingOverridePolicy` 선택 필드 추가
  ```typescript
  routingOverridePolicy?: {
    analystOverrideCapabilities: string[];
    analystOverrideIntents: string[];
    defaultDirectRoutingAgent: string;
    semanticConfidenceThreshold: number;
  };
  ```
- [ ] `orchestrator-direct-routing.ts`가 위 필드를 읽도록 리팩터링 (하드코딩 제거)
- [ ] `monitoring/domain-pack.ts`에 현재 값 이전
- [ ] 회귀 테스트: 기존 라우팅 동작 유지 확인

**예상 작업량**: 중간 (인터페이스 수정 + 파일 2개 리팩터링)
**SDD 게이트**: test(spec) 선행 커밋 필요
**담당**: Codex 위임 적합 (인터페이스 계약은 Claude 설계 후 위임)

---

## Task D — 성능 개선

### D-1. Langfuse 주간 자동 집계

`npm run langfuse:check` 는 수동 실행. 주간 P95/분포를 자동 기록하는 CI 작업 부재.

**작업**:
- [ ] `npm run langfuse:weekly` 스크립트: 직전 7일 트레이스 집계 → `reports/qa/langfuse-weekly/YYYY-WW.json`
- [ ] GitLab CI에 주 1회 실행 추가 (docs/reports only 커밋이므로 CI 스킵 예외 처리 필요)

**예상 작업량**: 소규모 (스크립트 100줄 + CI yaml 5줄)
**담당**: Codex 위임 적합

---

### D-2. Analyst maxSteps 하향 검증

Analyst ReAct 루프 현재 maxSteps=5. 1차 개선 이후 step1 제거로 실질 최대 필요 step은 3~4로 줄었을 수 있음.

**작업**:
- [ ] Langfuse trace에서 Analyst 경로 toolsCalled 배열 길이 분포 분석
- [ ] 95th percentile step 수 확인 → maxSteps=4로 하향 가능하면 적용
- [ ] before/after P95 지연 비교

**예상 작업량**: 분석 + 소규모 코드 변경
**선행 조건**: Task A-2 (Analyst 기준선 확보) 완료 후
**담당**: Claude 분석 → Codex 구현

---

## 우선순위 및 순서

```
즉시 (단기, 1~2주)
  A-1  "왜" RCA 라우팅 보강           → 라우팅 정확도 직접 영향
  A-2  Analyst 지연 기준선 실측       → 나머지 D 작업의 데이터 기반

중기 (2~4주)
  B-1  라우팅 회귀 감지 스크립트     → Harness 자동화 첫 단계
  C-1  orchestrator 중간층 분리       → 도메인 이식성 55% → 70%

장기 (1~2개월, 상업화 준비 시)
  B-2  Langfuse Score 자동 기록       → LLM-as-judge 기초
  D-1  주간 자동 집계                 → 장기 트렌드 추적
  D-2  Analyst maxSteps 하향          → P95 6s 목표
```

---

## 작업 외 범위 (이번 계획서 제외)

| 항목 | 이유 |
|------|------|
| 멀티테넌시 (3/10) | 포트폴리오 단계에서 불필요. 상업화 결정 시 별도 계획 |
| Cold start 해소 | Free Tier 구조 제약, Cloud Run min-instance 유료 |
| RAG cosine threshold 조정 | 기존 P2 pending, 독립 작업으로 처리 |
