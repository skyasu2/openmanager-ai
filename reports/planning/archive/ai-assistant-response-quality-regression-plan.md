> Owner: project
> Status: Completed
> Last reviewed: 2026-05-13

# AI Assistant Response Quality Regression Plan

- 상태: Completed
- 작성일: 2026-05-13
- TODO.md 연결: Active Tasks > AI Assistant response quality regression hardening

## 목표

Production 직접 AI Engine supervisor 호출에서 확인된 응답 품질 회귀를 deterministic contract로 고정한다.

```text
single-agent + metrics tool result
        ↓
deterministic TOP-N synthesis
        ↓
user-facing sanitizer
        ↓
quality evaluator
```

## 범위

- 포함:
  - TOP-N 랭킹 질의가 `getServerMetricsAdvanced` 결과를 확보한 경우 LLM 최종 문장보다 deterministic ranking synthesis를 우선한다.
  - `[응답 가이드]`, `이 값을 사용자에게 전달하세요`, `순서를 바꾸지 말고...` 같은 내부 scaffold가 사용자 응답에 노출되지 않게 한다.
  - AI Engine supervisor 직접 호출에서도 off-domain 질의를 deterministic guard로 처리한다.
  - 짧지만 정량 근거가 충분한 답변은 `TOO_SHORT` false positive로 보지 않는다.
- 제외:
  - provider 순서 정책 변경 또는 Cerebras 모델 skip 정책 변경.
  - `vectorStore: empty` metadata 정합성 확인.
  - 실 LLM 기반 broad QA 자동화.

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/server-metrics/tools-advanced.ts`
- `cloud-run/ai-engine/src/lib/text-sanitizer.ts`
- `cloud-run/ai-engine/src/lib/off-domain-guard.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/response-quality.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `executeSupervisor` | `SupervisorRequest` | `SupervisorResponse \| SupervisorError` | provider/circuit/runtime error |
| `buildDeterministicSummaryFallback` | `query`, `agentName`, `CollectedToolResult[]` | `string \| null` | `null` fallback |
| `sanitizeUserFacingResponse` | `string` | `string` | 입력 문자열 유지 |
| `getOffDomainGuardrail` | `string` | deterministic guard result or `null` | `null` fallback |
| `evaluateAgentResponseQuality` | agent name, response text, timing | `ResponseQualityMetrics` | quality flags |

### 테스트 시나리오 (구현 전 확정)

- [x] TOP-N direct supervisor: `getServerMetricsAdvanced`가 상위 서버 데이터를 반환하면 finalAnswer의 "없습니다"를 무시하고 deterministic TOP-N 응답을 반환한다.
- [x] Scaffold sanitizer: `[응답 가이드] ... 이 값을 사용자에게 전달하세요.` 형태의 응답은 사용자 응답에서 내부 문구가 제거된다.
- [x] Tool answer contract: `getServerMetricsAdvanced.answer`는 내부 instruction marker 없이 user-facing 한국어 요약을 반환한다.
- [x] Off-domain guard: `오늘 날씨 어때?` 같은 비운영 실시간 질의는 AI Engine 직접 호출에서도 실패/LLM 호출 대신 deterministic off-domain 응답을 반환한다.
- [x] Quality evaluator: `db-mysql-dc1-primary 82%`처럼 서버명과 퍼센트 근거가 있는 짧은 답변은 `TOO_SHORT`와 `formatCompliance=false`를 발생시키지 않는다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 — failing test 커밋: 위 테스트 시나리오를 먼저 실패 상태로 고정한다.
- [x] Task 1 — deterministic TOP-N synthesis를 single-agent direct path에 연결한다.
- [x] Task 2 — user-facing sanitizer와 tool answer scaffold 제거를 적용한다.
- [x] Task 3 — AI Engine off-domain guard와 TOO_SHORT 정량 응답 예외를 적용한다.
- [x] Task 4 — AI Engine targeted tests/type-check와 docs whitespace 검증을 통과시킨다.

## 검증 결과

- Failing spec 확인: targeted Vitest 4 files / 79 tests 중 6 failed.
- 구현 후 targeted Vitest: 4 files / 79 tests passed.
- AI Engine type-check: passed.
- AI Engine full test: 117 files / 1162 tests passed.
- `git diff --check`: passed.
- `npm run docs:budget`: passed.
- `npm run docs:ai-consistency`: passed.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| 계획서 | `docs(plan):` | 선택 | ❌ | ❌ |
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~3 | `fix:` | ✅ | ✅ | ❌ |
| Task 4 | — | ✅ | 배포 후 smoke 필요 | ❌ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 실패 테스트가 실제 production 회귀를 표현하는지 |
| Task 1~3 완료 후 | LLM-free deterministic path, sanitizer boundary, off-domain contract |
| 전체 완료 후 | targeted regression, type-check, `git diff --check` |

## 완료 기준

- [x] AI Engine targeted regression tests 통과.
- [x] `cd cloud-run/ai-engine && npm run type-check` 통과.
- [x] `git diff --check` 통과.
- [x] TODO.md 완료 이력 갱신 및 plan archive 이동.
