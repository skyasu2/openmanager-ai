> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-14
> Tags: ai-engine,cerebras,provider,fallback,deprecation

# Cerebras `llama3.1-8b` Graceful Exit Plan

**마감**: 2026-05-27 (13일 남음)

## 배경 및 목표

Cerebras 공식 deprecation 문서와 supported models 문서 기준으로 `llama3.1-8b`와 `qwen-3-235b-a22b-instruct-2507` 모델은 2026-05-27에 서비스 종료된다.
목표는 **정지 전까지는 계속 사용하고, 이후에는 Groq으로 자동 전환**하는 것이다.

### 현재 상태 (2026-05-14 확인)

| 모델 | smokeStatus | role | blockAfterDeprecation |
|------|-------------|------|----------------------|
| `llama3.1-8b` | 🟢 green | primary | true |
| `qwen-3-235b-a22b-instruct-2507` | 🔴 red (429) | excluded | true |
| `gpt-oss-120b` | 🔴 red (404) | excluded | false |

영향 받는 에이전트: **Analyst Agent, Reporter Agent, Advisor Agent**
(short-context 경로에서 Cerebras-first, long-context는 이미 Groq-first)

### 기존 fallback 동작 확인

`FALLBACK_ERROR_CODES = [429, 503, 502, 504]` — 404는 미포함.
→ 2026-05-27 이후 Cerebras 404 수신 시 **"Non-retryable error" 경로**로 자동 Groq 전환됨.
→ 기능상 이미 작동하지만 매 요청마다 불필요한 Cerebras round-trip 발생.

### 개선 목표

폐기일 이후 Cerebras를 provider 체인에서 **사전 제외**하여:
1. 불필요한 Cerebras 호출 오버헤드 제거 (~200–400ms 절약)
2. 404 에러 로그 스팸 방지
3. 대체 모델 없이 Groq-first로 매끄럽게 전환

---

## Contract

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts` | `FALLBACK_ERROR_CODES`에 `404`, `410` 추가 및 provider loop 진입 전 deprecation date 기반 사전 제외 로직 추가 |
| `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts` | `isCerebrasExpiredByDate()` 헬퍼 추가 |
| `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.test.ts` | 신규 테스트 케이스 |
| `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.test.ts` | 신규 테스트 케이스 |
| `reports/planning/TODO.md` / `reports/planning/cerebras-deprecation-graceful-exit-plan.md` | 진행 상태 및 완료 이력 갱신 |

### 계약 명세

```
isCerebrasExpiredByDate(asOf?: Date): boolean
  - asOf >= 2026-05-28T00:00:00Z → true
  - asOf < 2026-05-28T00:00:00Z → false
  - 날짜 기준은 기존 `blockAfterDeprecation` 정책과 동일하게 deprecation date 다음 UTC 일자부터 차단

RetryWithFallback provider loop:
  - provider = 'cerebras' && isCerebrasExpiredByDate() → 즉시 skip (로그: "cerebras excluded: past deprecation date")
  - provider = 'cerebras' && !isCerebrasExpiredByDate() → 기존 동작 유지

FALLBACK_ERROR_CODES: [404, 410, 429, 503, 502, 504] (404, 410 추가)
```

### 테스트 시나리오

```
T1: isCerebrasExpiredByDate(new Date('2026-05-27T00:00:00Z')) → false
T2: isCerebrasExpiredByDate(new Date('2026-05-28T00:00:00Z')) → true
T3: provider loop with cerebras expired → 즉시 Groq로 전환, Cerebras 호출 없음
T4: provider loop with cerebras not expired → 기존 동작 유지 (Cerebras 호출)
T5: Cerebras returns 404 → FALLBACK_ERROR_CODES에 포함되어 fast-fallback 경로 실행
T6: Cerebras returns 410 → same as T5
```

---

## Tasks

- [x] **T0**: SDD gate — failing test 커밋 선행
  - `test(spec): cerebras graceful exit add failing tests before implementation`
  - T1~T6 테스트 시나리오를 failing 상태로 커밋

- [x] **T1**: `FALLBACK_ERROR_CODES`에 404, 410 추가
  - 파일: `retry-with-fallback.ts:113`
  - 사유: deprecation 이후 fast-fallback 경로로 유도 (지연 동일하나 로그 명확화)

- [x] **T2**: `isCerebrasExpiredByDate()` 구현
  - 파일: `provider-model-policy.ts`
  - `CEREBRAS_LLAMA_DEPRECATION_DATE` 상수 활용
  - export하여 테스트 가능하게

- [x] **T3**: RetryWithFallback provider loop에 사전 제외 로직 추가
  - 파일: `retry-with-fallback.ts` provider 순회 loop 진입 직전
  - `if (provider === 'cerebras' && isCerebrasExpiredByDate()) { excludedProviders.push(provider); continue; }`
  - 로그: `[RetryWithFallback] cerebras skipped: past deprecation date 2026-05-27`

- [x] **T4**: AI Engine type-check + targeted test 통과 확인
  ```bash
  cd cloud-run/ai-engine && npm run type-check
  npx vitest run src/services/resilience/retry-with-fallback.test.ts
  npx vitest run src/services/ai-sdk/provider-model-policy.test.ts
  ```

- [x] **T5**: AI Engine full test suite 통과 확인
  ```bash
  cd cloud-run/ai-engine && npm run test
  ```

- [x] **T6**: root lint + type-check (변경 없어도 드래그 방지)
  ```bash
  npm run type-check && npm run lint
  ```

- [x] **T7**: GitLab 배포 + pipeline 확인
  ```bash
  git push gitlab main
  npm run gitlab:pipeline:head -- --wait
  ```
  - main push는 validate pipeline만 실행한다.
  - production 배포가 필요하면 별도 semver tag pipeline에서 `deploy_ai_engine`을 확인한다.
  - GitLab main pipeline `2523895744`: success

- [x] **T8**: TODO.md Active 항목 완료 처리 및 On Hold 항목 재평가 메모 갱신

## 완료 결과

- Failing test 커밋: `aba1f39d0`
- 구현 커밋: `a512fb6a4`
- main validate pipeline: `2523895744` success
- production 배포: 미수행. 필요 시 별도 semver tag pipeline으로 진행.

---

## 검증 기준

| 검증 | 방법 | 합격 기준 |
|------|------|----------|
| 폐기 전 동작 | unit test mock (date: 2026-05-26) | Cerebras 호출 발생 |
| 폐기 후 동작 | unit test mock (date: 2026-05-28) | Cerebras 호출 없음, Groq 호출 |
| 404 fast-fallback | unit test mock (status 404) | FALLBACK_ERROR_CODES 경로 실행 |
| AI Engine 전체 | `npm run test` | 1192+ tests pass |
| 배포 | GitLab pipeline | validate + deploy_ai_engine success |

---

## 위험 요소

| 위험 | 대응 |
|------|------|
| Groq RPD 소진 (14.4K/일) | Cerebras 제거 후 Groq 부하 증가 가능 → quota-tracker 모니터링 |
| Mistral fallback 2 RPM 병목 | Groq 소진 시만 진입 — 정상 범위에서 드물다 |
| 사전 제외 로직 clock drift | UTC 기준, `isCerebrasExpiredByDate`의 asOf 주입으로 단위 테스트 커버 |

---

## 관련 파일

- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts` — 모델 정책 SSOT
- `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts` — fallback 엔진
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts` — deprecation contingency 기록
- On Hold 원본: `reports/planning/TODO.md` (P2: Metrics Query Agent Cerebras-first 전환)
- 공식 근거: `https://inference-docs.cerebras.ai/support/deprecation`, `https://inference-docs.cerebras.ai/models/overview`
