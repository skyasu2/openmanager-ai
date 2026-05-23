> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-24 (v8.12.17 production targeted QA closure)
> Tags: ai,assistant,routing,evidence,markdown,qa

# AI 어시스턴트 개선 작업 계획서
> 기준: v8.12.16 · 5차 평가 QA-20260524-0572 · 2026-05-24

## 1. 배경 및 제약 조건

### 현재 아키텍처
- **Cloud Run AI Engine**: `orchestrator-direct-routing.ts` deterministic pre-filter → Direct Router → specialist agent
- **Provider Mesh**: NLQ=Groq, Analyst=Mistral, Reporter=Z.AI, Advisor=Mistral, Vision=Gemini, Default=Cerebras gpt-oss-120b
- **Evidence Provider**: `current-metrics-evidence-provider.ts`, `capacity-forecast-evidence-provider.ts`, `server-health-evidence-provider.ts` 등
- **KRL**: `knowledge-retrieval-lite.ts` (BM25+metadata boost, KB 67건)

### 하드 제약
- **Cloud Run**: 1 vCPU, 512Mi, Free Tier — 무거운 LLM 추론 추가 금지
- **Groq RPD 한도**: NLQ entity extraction 비용 절약 필요
- **세션 스토리지**: Supabase Free Tier — 대용량 세션 저장 불가
- **변경 범위**: Cloud Run AI Engine (`cloud-run/ai-engine/src/`) 중심, Frontend는 마크다운 렌더링 수정만

---

## 2. 발견된 문제 우선순위

| 순위 | 문제 | 심각도 | 구현 난이도 |
|:----:|------|:------:|:-----------:|
| **P1** | Advisor "성능 개선 조언" 빈 응답 | 🔴 High | Low |
| **P2** | 역방향 필터 오라우팅 + 마크다운 미렌더링 | 🔴 High | Medium |
| **P3** | 최솟값 쿼리 오라우팅 | 🟡 Medium | Medium |
| **P4** | 세션 컨텍스트 연속성 | 🟡 Medium | High |

---

## 3. P1: Advisor 빈 응답 수정 (난이도: Low, 예상 1~2시간)

### 문제 원인 분석
"api-was-dc1-01 서버 성능 개선 조언" → `서버 실시간 데이터 분석` 오라우팅 후 **빈 응답 반환**.

Cloud Run의 Advisor agent는 `monitoring-capacity-forecast`나 `monitoring-server-health` 분석 후
`advisorRecommendationProvider`가 결과를 synthesize하는 구조로 추정됨.
"성능 개선 조언" 쿼리가 Advisor 경로 keyword pattern에 매핑되지 않아 오라우팅 후 빈 응답 발생.

### 수정 방법
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`

```typescript
// 현재: Advisor 트리거 패턴 부족 추정
// 추가할 패턴
const ADVISOR_PATTERN = /조언|권고|개선|튜닝|최적화|어떻게 해야|어떻게 하면/i;
```

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/advisor-agent.ts` (또는 해당 파일)
- Advisor agent fallback 응답 추가: 서버 현재 메트릭 → 임계값 초과 항목 기반 조언 생성
- 빈 응답 방어 로직: `if (!advisorContent || advisorContent.trim() === '') { /* fallback */ }`

### 검증 방법
```
"api-was-dc1-01 서버 성능 개선 조언 해줘"
→ monitoring-server-health or advisor 경로 진입, 비어있지 않은 응답 반환
```

### 테스트 시나리오
- [x] `query-routing-signals.test`: "api-was-dc1-01 서버 성능 개선 조언"은 Advisor Agent pre-filter로 라우팅된다.
- [x] `query-routing-signals.test`: "db-mysql-dc1-primary 최적화 방법"은 Advisor Agent pre-filter로 라우팅된다.

---

## 4. P2-A: 역방향 필터 evidence path 추가 (난이도: Medium, 예상 2~4시간)

### 문제 원인 분석
`monitoring-metric-current`와 `monitoring-metric-ranking`은 **상위 N개 / 특정 그룹 현황**을 제공하지만,
**"정상 범위인 서버"** 같은 역방향 필터(건강한 서버만) 쿼리를 처리하는 evidence path가 없음.

### 수정 방법
**옵션 A (권장)**: 기존 `monitoring-server-health`의 필터 파라미터 확장

**파일**: `cloud-run/ai-engine/src/services/evidence-providers/server-health-evidence-provider.ts`
```typescript
// 기존: 위험/경고 서버만 필터
// 추가: statusFilter?: 'all' | 'warning-only' | 'healthy-only'
if (params.statusFilter === 'healthy-only') {
  return servers.filter(s => s.status === 'online' && s.cpu < 80 && s.memory < 90 && s.disk < 85);
}
```

**파일**: `orchestrator-direct-routing.ts`
```typescript
// 역방향 필터 패턴 추가
const HEALTHY_FILTER_PATTERN = /정상.*서버|정상 범위|이상 없는|괜찮은 서버|문제 없는/i;
// → monitoring-server-health, statusFilter: 'healthy-only'
```

**옵션 B (간단)**: `monitoring-server-health`에 `includeHealthy: true` 파라미터 추가 후 전체 18대 목록을 상태별로 분류해서 반환.

### 검증 방법
```
"현재 정상 범위인 서버 목록 보여줘"
→ monitoring-server-health (statusFilter: healthy-only), OTel 기반 정상 서버 목록 반환
```

### 테스트 시나리오
- [x] `current-metrics-evidence-provider.test`: "현재 정상 범위인 서버 목록"은 `monitoring-server-health` deterministic evidence로 resolve된다.
- [x] 응답에는 online이면서 CPU/MEM/DISK가 정상 임계값 안에 있는 서버만 포함된다.

---

## 4. P2-B: 마크다운 미렌더링 버그 수정 (난이도: Low, 예상 30분)

### 문제 원인 분석
일반 대화 응답 경로의 LLM 출력에 `##`, `**`, `*` 마크다운이 포함되지만
Frontend ChatMessage 렌더러가 일반 대화 응답에서 마크다운을 렌더링하지 않음.

**실제 출력**: `##정상서버목록###CPU사용률80%미만,메모리사용률90%미만서버1. **api-was-dc1-01**`

### 수정 방법
**파일**: `src/hooks/ai/utils/message-helpers.ts` 또는 ChatMessage 렌더링 컴포넌트

```typescript
// 모든 응답 경로(일반 대화 포함)에서 마크다운 렌더링 활성화
// 현재: 특정 경로만 markdown=true 처리로 추정
// 수정: route 타입과 무관하게 항상 ReactMarkdown 적용
```

**파일**: `src/components/ai/ChatMessage.tsx` (또는 해당 컴포넌트)
- `isMarkdown` 조건을 `routeType === 'monitoring'` → 항상 `true`로 변경, 또는
- 응답 텍스트에 `#`, `**` 포함 시 자동 마크다운 렌더링 활성화

### 검증 방법
```
"현재 정상 범위인 서버 목록 보여줘" (일반 대화 응답 경로)
→ 응답이 마크다운 렌더링되어 헤딩, bold 정상 표시
```

### 테스트 시나리오
- [x] `markdown-parser.test`: 공백 없는 `##정상서버목록` 헤딩도 텍스트로 노출하지 않고 heading element로 렌더링한다.

---

## 5. P3: 최솟값 쿼리 evidence path 추가 (난이도: Medium, 예상 2~3시간)

### 문제 원인 분석
`monitoring-metric-ranking`은 **내림차순 상위 N개** (높은 CPU 순)만 지원.
"부하가 가장 낮은", "여유 있는" 같은 **오름차순/최솟값** 쿼리 처리 불가.

### 수정 방법
**파일**: `cloud-run/ai-engine/src/services/evidence-providers/current-metrics-evidence-provider.ts`

```typescript
// 기존 sortOrder: 'desc' (기본값)
// 추가: sortOrder?: 'asc' | 'desc'
// rankingMetric: 'cpu' | 'memory' | 'disk' | 'composite-load'
// 복합 부하 점수 = cpu * 0.4 + memory * 0.4 + disk * 0.2

function buildMetricRankingAnswer(servers, params) {
  const sorted = params.sortOrder === 'asc'
    ? servers.sort((a, b) => a.compositeLoad - b.compositeLoad)
    : servers.sort((a, b) => b.compositeLoad - a.compositeLoad);
  return formatRankingResponse(sorted, params);
}
```

**파일**: `orchestrator-direct-routing.ts`
```typescript
const MIN_LOAD_PATTERN = /가장 낮은|가장 여유|최저 부하|부하 적은|한가한|여유 있는/i;
// → monitoring-metric-current, sortOrder: 'asc', rankingMetric: 'composite-load'
```

**복합 부하 점수 도입 이유**: "부하"는 CPU 단일이 아닌 CPU+Memory+Disk 통합 지표가 운영상 더 의미있음.

### 검증 방법
```
"지금 부하가 가장 낮은 서버는?"
→ monitoring-metric-current (sortOrder: asc), composite-load 기준 최저 서버 즉시 응답
"여유 있는 서버 TOP 3?"
→ 동일 경로, 하위 3대 반환
```

### 테스트 시나리오
- [x] `current-metrics-evidence-provider.test`: "지금 부하가 가장 낮은 서버"는 복합 부하 하위 deterministic ranking으로 resolve된다.
- [x] `current-metrics-evidence-provider.test`: "여유 있는 서버 TOP 3"는 CPU/MEM/DISK 가중 복합 점수 기준 하위 3대를 반환한다.

---

## 6. P4: 세션 컨텍스트 연속성 (난이도: High, 예상 1~2일)

### 문제 원인 분석
"방금 말한", "이 대화에서" 같은 대화 참조 표현이 오라우팅되는 원인:
1. 현재 supervisorPrompt는 이전 메시지 컨텍스트를 routing decision에 반영 안 함
2. `session-memory.ts` 71줄 — 세션 내 결과 캐싱 없음

### 수정 방법 (Free Tier 제약 내)

**Phase 1 (단기, 1~2시간)**: supervisor prompt 개선
- 직전 AI 응답의 핵심 데이터(서버명, 수치)를 `recentContext`로 추출해 routing prompt에 포함
- `"방금", "앞서", "이전에"` 패턴 감지 시 → 일반 대화가 아닌 세션 컨텍스트 조회 분기

```typescript
// supervisorPrompt 추가
// recentContext: 직전 응답에서 추출한 서버명·수치 요약 (JSON 50자)
// 예: { "lastRoute": "monitoring-capacity-forecast", "topServer": "api-was-dc1-03", "metric": "memory", "value": 41 }
```

**Phase 2 (중기, Supabase Free Tier 활용)**:
- 세션당 마지막 5개 응답 요약을 `session_memory` 테이블에 저장 (행 수 제한)
- 대화 참조 패턴 감지 시 해당 세션 컨텍스트 조회 후 응답 생성

**Free Tier 제약 고려**:
- Supabase Free: 500MB 스토리지, 2GB 대역폭 — 요약만 저장하므로 안전
- 세션 메모리 TTL: 30분 (cloud run 인스턴스 재시작과 정렬)

### 검증 방법
```
Q: "WAS 서버 중 메모리 포화 예측 알려줘"
A: (capacity forecast 응답)
Q: "방금 예측에서 가장 위험한 서버가 어디야?"
→ api-was-dc1-03 정확히 응답 (세션 컨텍스트 활용)
```

---

## 7. 구현 순서 및 일정

```
Day 1 (오늘)
├── P1: Advisor 빈 응답 수정 (1~2h)
│   └── orchestrator pattern + advisor fallback 추가
├── P2-B: 마크다운 미렌더링 버그 (30m)
│   └── ChatMessage 컴포넌트 markdown 항상 활성화
└── 검증 후 GitLab 커밋

Day 2
├── P2-A: 역방향 필터 evidence path (2~4h)
│   └── monitoring-server-health statusFilter 확장
├── P3: 최솟값 쿼리 evidence path (2~3h)
│   └── composite-load asc 정렬 추가
└── 검증 후 GitLab 커밋 + Cloud Run 배포

Day 3~4 (선택)
└── P4: 세션 컨텍스트 연속성
    ├── Phase 1: supervisor prompt recentContext (1~2h)
    └── Phase 2: Supabase session_memory (추가 1일)
```

### 2026-05-24 진행 상태
- [x] SDD failing regression commit: `6c531a744 test(spec): add v8.12.16 assistant QA regressions`
- [x] P1 Advisor routing keyword 확장: `조언/개선/튜닝/최적화` 계열 pre-filter를 Advisor로 정렬
- [x] P2-A healthy-only server evidence: online + CPU/MEM/DISK 정상 임계값 기준 deterministic 응답 추가
- [x] P2-B compact markdown heading: `##정상서버목록`, `###CPU...` 형태를 heading으로 렌더링
- [x] P3 composite-load lowest ranking: CPU 40% + memory 40% + disk 20% 가중 하위 ranking 추가
- [x] 라인 가드 대응: `current-metrics-evidence-answers.ts`로 answer builder를 분리해 fail-threshold 제거
- [x] 검증: targeted tests, root `type-check`/`lint`/`test:quick`/`test:contract`, AI Engine `type-check`/`test`, AI Engine `line-guard`, `git diff --check` PASS
- [x] GitLab main validate 복구: `2548266355` success, release commit main pipeline `2548270161` success
- [x] 배포: `v8.12.17` tag pipeline `2548270166` success, Vercel production `/api/version` `8.12.17`
- [x] Production targeted QA: `QA-20260524-0573` 9/9 PASS
- [ ] P4 세션 컨텍스트 연속성은 고난도 후속 항목으로 이번 P1~P3 closure 범위에서 제외

---

## 8. 테스트 케이스 (수정 후 검증 쿼리)

```
P1 검증:
- "api-was-dc1-01 서버 성능 개선 조언 해줘"          → 비어있지 않은 조언 응답
- "db-mysql-dc1-primary 최적화 방법 알려줘"           → Advisor 경로 진입

P2-A 검증:
- "현재 정상 범위인 서버 목록 보여줘"                 → 18대 중 정상 서버 목록 (OTel 기반)
- "이상 없는 서버만 보여줘"                           → 동일 경로

P2-B 검증:
- 일반 대화 응답에서 마크다운 ## ** * 정상 렌더링

P3 검증:
- "지금 부하가 가장 낮은 서버는?"                    → monitoring-metric-current, 즉각 응답
- "여유 있는 서버 TOP 3 알려줘"                      → composite-load 하위 3대

P4 검증:
- (Q1: WAS 메모리 예측 후) "방금 가장 위험한 서버가 어디야?" → api-was-dc1-03 정확 응답
```

---

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| Advisor agent 실제 코드 위치 불명 | grep `advisor` 후 실제 구현 파일 확인 필수 |
| `orchestrator-direct-routing.ts` 패턴 추가 시 기존 라우팅 회귀 | 기존 passing QA 케이스 regression 확인 |
| composite-load 공식 OTel 기반 검증 필요 | `public/data/otel-data/` 샘플 데이터로 수치 교차 확인 |
| 세션 컨텍스트가 Cloud Run cold start 시 소실 | Phase 1은 in-memory (cold start 소실 수용), Phase 2는 Supabase persistent |

---

_작성: Claude Code · 2026-05-24 · QA-20260524-0572 기반_
