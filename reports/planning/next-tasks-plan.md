> Owner: AI Agent
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-04-15

# [작업 계획서] Advisor Agent 품질·지연 개선 (2026-04-14) — **완료**

## 배경

v8.11.10 기준 AI Engine의 P1 미해결 이슈: topology variant 질의에서 Advisor Agent가
`durationMs 35~86s`의 long-tail 지연과 `MISSING_COMMAND_BLOCK`, `MISSING_PROBLEM_CONTEXT`,
`LATENCY_VERY_SLOW` 품질 플래그를 반복적으로 유발하고 있다.

### 근본 원인 분석 (코드 리뷰 기반)

| 원인 | 위치 | 설명 |
|------|------|------|
| isHeavyAgent 누락 | `response-quality.ts:84-91` | Advisor Agent가 heavy agent 분류 제외 → slow 임계값 18000ms(실제 35~86s)로 과소 평가 |
| quality flag 미연동 재시도 | `supervisor-quality-retry.ts` | `MISSING_COMMAND_BLOCK` 발생해도 재시도 트리거 없음 |
| 프롬프트 포맷 강제 불충분 | `advisor.ts:55-62` | Phase 3 체크리스트가 선택적 표현 → Mistral이 코드 블록 누락 허용 |
| 전역 timeout만 존재 | `base-agent-types.ts:58` | `45_000ms` 공유, Advisor 전용 timeout guard 없음 |

### 현재 임계값 vs 실제 관측값

| 분류 | 현재 기준 (non-heavy) | Advisor 실측 |
|------|----------------------|-------------|
| fast | ≤ 3,000ms | - |
| normal | ≤ 8,000ms | - |
| slow | ≤ 18,000ms | - |
| **very_slow** | **> 18,000ms** | **35,000~86,000ms** |

Advisor는 Mistral 모델 + 복수 tool call = 구조적으로 느림. Reporter/Vision/Analyst와 동등한
heavy 분류가 필요하다.

---

## Task 1: Advisor Agent latency 임계값 보정

**우선순위**: P1 | **규모**: 소 (~15분) | **위험도**: 낮음 (관측값만 변경)

### 변경 대상

`cloud-run/ai-engine/src/services/ai-sdk/agents/response-quality.ts`

**현재 코드 (`classifyLatencyTier`):**
```typescript
const isHeavyAgent =
  agentName === 'Reporter Agent' ||
  agentName === 'Vision Agent' ||
  agentName === 'Analyst Agent';

const fastThreshold = isHeavyAgent ? 5000 : 3000;
const normalThreshold = isHeavyAgent ? 13000 : 8000;
const slowThreshold = isHeavyAgent ? 25000 : 18000;
```

**수정 방향:**
- Advisor Agent를 `isHeavyAgent`에 추가 → heavy 임계값 적용
- 또는 Advisor 전용 임계값: fast=8000/normal=20000/slow=40000ms (Mistral 특성 반영)
- Advisor 실측 35~86s 기반: slow=40000ms까지 'slow', 초과 시 'very_slow'

### 완료 기준
- `response-quality.test.ts` Advisor latency 케이스 추가
- `npm run type-check && npm run test` 통과

---

## Task 2: Advisor 프롬프트 포맷 강제 강화

**우선순위**: P1 | **규모**: 소 (~20분) | **위험도**: 중간 (LLM 동작 변화)

### 변경 대상

`cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/advisor.ts`

### 현재 문제

Phase 3 체크리스트가 "확인하세요" 형태의 권고 → Mistral이 무시 가능:
```
### Phase 3: finalAnswer 전 완성도 점검
답변 작성 전에 확인하세요:
- ✅ 진단 명령어 코드 블록이 1개 이상 있는가?
```

### 수정 방향

1. 프롬프트 맨 앞에 **하드 규칙 블록** 추가 (LLM은 앞 부분을 더 강하게 따름)
2. 코드 블록 필수 포함을 "금지" 형태로 명시 (`코드 블록 없는 finalAnswer 호출 금지`)
3. 응답 형식 템플릿에 `` `command` `` 플레이스홀더 명시적 포함

### 완료 기준
- 로컬 probe에서 MISSING_COMMAND_BLOCK 빈도 감소 확인
- 기존 테스트 회귀 없음

---

## Task 3: quality-retry MISSING_COMMAND_BLOCK 트리거 추가

**우선순위**: P1 | **규모**: 소~중 (~30분) | **위험도**: 중간 (재시도 로직 변경)

### 변경 대상

`cloud-run/ai-engine/src/services/ai-sdk/supervisor-quality-retry.ts`

### 현재 상태

현재 재시도 트리거 조건:
- non-general intent에서 `toolsCalled === []` (도구 미사용)

### 추가할 조건

`formatCompliance === false` AND `qualityFlags.includes('MISSING_COMMAND_BLOCK')` 조합 시
Advisor Agent 한정 1회 재시도.

재시도 시 프롬프트에 **명시적 포맷 강제** 메시지 prepend:
```
[RETRY] 이전 응답에 코드 블록이 누락되었습니다. 반드시 진단/조치/검증 명령어를 `코드 블록`으로 포함하세요.
```

### 완료 기준
- `supervisor-quality-retry.test.ts` Advisor MISSING_COMMAND_BLOCK 재시도 케이스 추가
- `npm run test` 통과

---

## Task 4: Cloud Run 재배포 + post-deploy QA

**우선순위**: P1 | **규모**: 소 | **위험도**: 낮음

### 절차

```bash
# 1. 로컬 검증
cd cloud-run/ai-engine
npm run type-check
npm run test

# 2. Cloud Run 배포
bash cloud-run/ai-engine/deploy.sh

# 3. health probe
curl https://ai-engine-jdhrhws7ia-an.a.run.app/health

# 4. QA 기록
npm run qa:record -- --input <json>
npm run qa:status
```

### 완료 기준
- revision `ai-engine-003xx` 100% 전환
- post-deploy QA: Advisor 질의 3회 sampled probe에서 `LATENCY_VERY_SLOW` 플래그 감소 확인
- `MISSING_COMMAND_BLOCK` 재시도 경로 로그 확인

---

## Task 5 (P3): graph traversal 유지/제거 재평가

**우선순위**: P3 | **규모**: 조사 | **전제**: Task 1~4 완료 후

### 목표

P1 Advisor 오류 정상화 후 3회 targeted QA로 graph hit-rate/precision 재측정:
- `sourceType="graph"` 관측 빈도
- vector-only 대비 graph 경유 응답 품질 차이
- `graphrag-relations.ts` @deprecated 코드 제거 최종 판단

### 완료 기준
- QA 3회 기록
- 제거 or 유지 결정 TODO.md 반영

---

## Task 6 (P3): duplicate tool invocation 근본 제거 판단

**우선순위**: P3 | **규모**: 조사 | **전제**: Task 5 이후

### 현황

production 로그에서 `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]` 반복.
현재 cache로 backend 재실행 비용은 완화됐으나 latency 누적 잔존.

### 완료 기준
- dedupe 적용 시 latency 감소량 측정
- P2 승격 여부 결정

---

## 실행 순서

| 순서 | Task | 상태 | 완료 |
|------|------|------|------|
| 1 | **Task 1**: latency 임계값 보정 | ✅ 완료 | `aedbfbc91` (2026-04-14) |
| 2 | **Task 2**: 프롬프트 포맷 강화 | ✅ 완료 | `aedbfbc91` (2026-04-14) |
| 3 | **Task 3**: quality-retry 트리거 추가 | ✅ 완료 | `aedbfbc91` (2026-04-14) |
| 4 | **Task 4**: Cloud Run 배포 + QA | ✅ 완료 | `ai-engine-00316-l67`, `QA-20260415-0283` |
| 5 | **Task 5**: graph traversal 재평가 | P3, 보류 | |
| 6 | **Task 6**: duplicate tool 제거 | P3, 보류 | |

**Task 1~4 완료**: 2026-04-15. 배포 후 probe 3/3 성공, qualityFlags=[], latencyTier=fast 확인.

---

## 이전 계획서 완료 이력

이전 `next-tasks-plan.md` (2026-04-07)의 모든 Task 완료:
- TypeScript 6.0.2 업그레이드 ✅
- Knip v6 전환 ✅
- Storybook hygiene ✅
- node suite 최적화 ✅
- v8.11.0 릴리스 ✅
