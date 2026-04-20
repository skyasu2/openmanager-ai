> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-21
> Tags: ai,latency,advisor,ai-engine

# Advisor Tail Latency Plan

- 작성일: 2026-04-21
- TODO.md 연결: Active Tasks > Advisor tail latency 축소

## 목표

Advisor Agent가 이미 느린 응답(`LATENCY_SLOW`, `LATENCY_VERY_SLOW`)을 반환한 뒤 형식 품질(`MISSING_COMMAND_BLOCK`)만으로 추가 provider retry를 수행하지 않도록 조정해, 장꼬리 지연을 줄인다.

## 범위

- 포함:
  - Advisor 전용 quality retry 조건에 latency guard 추가
  - 느린 응답 이후에는 형식 재시도를 생략한다는 계약 테스트 추가
  - ai-engine targeted/full gate로 회귀 검증
- 제외:
  - Advisor provider order 변경
  - latency threshold 수치 자체 조정
  - multi-agent orchestration retry budget 전반 재설계

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-quality-retry.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-quality-retry.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `shouldRetryForQuality` | `SupervisorResponse`, `IntentCategory` | `boolean` | 없음. quality flag 조합에 따라 재시도 여부만 판정 |

### 동작 계약

- Advisor 응답에서 `formatCompliance=false`이고 `MISSING_COMMAND_BLOCK`가 있어도 아래 조건이면 `false`를 반환한다.
  - `qualityFlags`에 `LATENCY_SLOW` 포함
  - `qualityFlags`에 `LATENCY_VERY_SLOW` 포함
- 기존 hard failure retry는 유지한다.
  - `EMPTY_RESPONSE`, `NO_OUTPUT`, meaningful content가 없는 `TOO_SHORT`
- non-Advisor agent 동작은 변경하지 않는다.

### 테스트 시나리오

- [ ] Advisor + `MISSING_COMMAND_BLOCK` + `LATENCY_SLOW` + `formatCompliance=false` → 재시도하지 않는다
- [ ] Advisor + `MISSING_COMMAND_BLOCK` + `LATENCY_VERY_SLOW` + `formatCompliance=false` → 재시도하지 않는다
- [ ] Advisor + `MISSING_COMMAND_BLOCK` + `formatCompliance=false` + latency flag 없음 → 기존처럼 재시도한다
- [ ] `EMPTY_RESPONSE`, `NO_OUTPUT` 등 hard failure retry는 기존처럼 유지된다

## Task 목록

- [x] Task 0 — failing test: slow/very_slow Advisor format retry 억제 계약 추가
- [x] Task 1 — `shouldRetryForQuality`에 Advisor latency guard 반영
- [x] Task 2 — targeted ai-engine tests + full ai-engine gate 검증

## 완료 기준

- [x] `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-quality-retry.test.ts src/services/ai-sdk/agents/response-quality.test.ts` 통과
- [x] `cd cloud-run/ai-engine && npm run type-check` 통과
- [x] `cd cloud-run/ai-engine && npm run test` 통과
- [x] TODO.md Active/Completed 상태 갱신
