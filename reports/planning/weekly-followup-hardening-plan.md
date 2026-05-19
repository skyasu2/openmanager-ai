> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-19
> Tags: qa,analyst,reporter,vercel,cloud-run,free-tier

# Weekly Follow-up Hardening Plan

- 상태: Approved
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > 주간 개선 후속 안정화

## 목표

2026-05-12부터 2026-05-19까지의 대량 변경 이후, 실제로 추가 개선이 필요한 부분만 선별해 닫는다.
목표는 새 기능 확장이 아니라 release confidence를 높이는 것이다.

```text
대상 변경 성격
  Analyst 경량 evidence contract 마감
  Reporter live generation/fallback 재확인
  Provider fallback freshness hardening
  Cerebras short-output guard
  Advisor remediation query routing priority
  intelligent-monitoring analyze_server contract normalization
  최신 QA skipped surface 보강
  장기 세션 데이터 slot drift 정책 정리
  bundle budget 관측 지속

명시적 비목표
  학습형 ML 도입
  Cloud Run 리소스 증설
  항상-on 인스턴스 도입
  추가 LLM 호출 기반 검증 루프
  관리자용 live provider smoke 엔드포인트 추가
```

## 분석 및 평가

| 항목 | 개선 필요 | 개선 가능 | 판단 | 개선 방식 |
|------|:---:|:---:|------|-----------|
| Analyst 경량 evidence contract | 예 | 예 | 현재 TS 이상감지/예측은 경량 근거 추출기로 유지하는 것이 비용 대비 적절하다. 다만 LLM이 `signalStrength`를 장애 확률처럼 해석하지 않도록 계약을 고정해야 한다. | 이미 준비된 local diff를 검토 후 commit/push하고 production QA에서 회귀를 확인한다. |
| 최신 skipped QA surface closure | 예 | 예 | 최신 QA `QA-20260519-0534`는 targeted이며 `conversational-ai-qa`, `incident reporter generation`, `core route pack`, `observability/security pack`을 skip했다. | Vercel Playwright MCP broad 보강 QA를 1회 실행하고 QA tracker에 기록한다. |
| Reporter live generation/fallback | 예 | 조건부 | Reporter fallback 품질은 개선됐지만, live generation이 degraded 없이 동작하는지 최신 production broad 근거가 부족하다. Provider parse drift가 재현되면 code fix 후보가 된다. | 동일 incident scenario로 production report 생성, `degraded`, `fallbackReasonCode`, `fallbackSource`, latency를 기록한다. 재현 시 maxOutputTokens/pipeline 연결/프롬프트 경계를 최소 수정한다. |
| Provider fallback freshness | 예 | 예 | OpenRouter vision fallback은 최근 live smoke에서 정상 동작 근거가 부족하므로 green fallback으로 노출하면 운영 판단을 흐린다. | 기본 fallback chain에서 OpenRouter를 제외하고, 명시 opt-in일 때만 사용한다. metadata는 disabled/red로 노출한다. |
| Cerebras short-output guard | 예 | 예 | `gpt-oss-120b`는 너무 낮은 `maxOutputTokens`에서 빈 응답이 관측됐다. 128 tokens 이상에서는 정상 smoke가 확인됐다. | retry/fallback 경계에서 Cerebras GPT-OSS 모델의 최소 output token을 128로 보정한다. |
| Advisor remediation query routing priority | 예 | 예 | "해결/조치/명령어/방법" 질의가 semantic anomaly frame에 의해 Analyst로 가면 사용자가 원하는 실행 조치 답변이 약해진다. | explicit Advisor pre-filter는 semantic anomaly frame보다 우선시한다. |
| `analyze_server` response contract | 예 | 예 | Cloud Run `analyze-server` 응답에 `timestamp`가 없어 frontend artifact parser와 QA shape가 어긋날 수 있다. | Cloud Run payload에 `timestamp`와 provider/model metadata를 추가하고, Vercel BFF에서 legacy stringified response를 정규화한다. |
| `aiQueryAsOfDataSlot` 장기 세션 freeze | 정책 정리 필요 | 예 | Fresh load 정합성은 맞지만 장기 세션에서는 SSR slot 기준으로 frozen 될 수 있다. 실시간 resync 구현은 현재 free-tier/portfolio 범위에서 과하다. | 코드 변경보다 QA tracker의 accepted tradeoff 또는 TODO Backlog로 명시한다. |
| Bundle budget blocking 승격 | 아직 보류 | 예 | 기존 `vitest-storybook-optimization-plan.md`가 이미 tracking 중이다. 2026-05-30 전후 관측 전 blocking 승격은 이르다. | 기존 계획서 링크를 유지하고 신규 중복 계획을 만들지 않는다. |
| QA provider/latency attribution | 부분 필요 | 예 | 최근 QA latency observation 일부가 `provider: unknown`으로 남아 비용/성능 회고 정확도가 낮다. | 새 런타임 호출 없이 response metadata/header에서 provider/model을 QA 기록에 최대한 보존한다. |
| Completed plan archive hygiene | 예 | 예 | Completed 계획서 일부가 root `reports/planning/*.md`에 남아 있어 active plan 목록 노이즈가 있다. | 완료 링크를 TODO와 맞춘 뒤 `reports/planning/archive/`로 이동한다. |

## 범위

- 포함:
  - 현재 준비된 Analyst evidence contract 변경 검토/커밋/검증
  - Vercel production broad 보강 QA 실행 및 기록
  - Reporter live generation degraded 여부 확인
  - OpenRouter vision fallback 기본 비활성화 및 provider metadata 정렬
  - Cerebras `gpt-oss-120b` short-output guard
  - 명시적 조치/해결 질의의 Advisor routing precedence
  - `analyze_server` 응답 shape normalization
  - 장기 세션 data slot drift의 정책화
  - QA latency/provider attribution 기록 품질 보강
  - 완료된 planning 문서 archive 정리
- 제외:
  - 이상감지 학습형 ML/외부 ML 라이브러리 도입
  - Cloud Run `min-instances`, CPU, memory, max instances 증설
  - Reporter/Analyst 응답마다 추가 LLM self-check 호출
  - 관리자용 live provider smoke endpoint 추가
  - Bundlemon blocking 승격 즉시 수행
  - dashboard/AI 실시간 data slot resync 구현

## 계약 (Contract)

> Status를 Approved로 올리기 전에 이 섹션을 완성해야 한다.

### 변경 대상 파일

현재 예상되는 직접 변경 파일:

- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-shared.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-detect.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-detect-all.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-trend.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.test.ts`
- `cloud-run/ai-engine/src/lib/config-parser.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-metadata.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts`
- `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`
- `cloud-run/ai-engine/src/routes/analytics.ts`
- `src/app/api/ai/intelligent-monitoring/route.ts`
- `reports/qa/runs/2026/*.json`
- `reports/qa/qa-tracker.json`
- `reports/qa/QA_STATUS.md`
- `reports/planning/TODO.md`
- `reports/planning/*.md`

조건부 변경 파일:

- Reporter live generation이 여전히 degraded-only이면:
  - `cloud-run/ai-engine/src/routes/analytics.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-agent.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline.ts`
  - 관련 reporter tests

### 입출력 계약

| 경계 | 입력 | 출력 | 에러/비정상 케이스 |
|------|------|------|--------------------|
| Analyst anomaly/trend tools | metric snapshot/history | deterministic `results` + `evidenceContract` | tool failure 시 기존 `success:false` 계약 유지 |
| Analyst prompt | tool result evidence | 원인/영향/조치는 LLM 해석, `signalStrength`는 확률로 표현하지 않음 | 근거 부족 시 추가 확인 필요를 명시 |
| Reporter live QA | production incident scenario | report payload, degraded metadata, latency observation | degraded 재현 시 raw reason 미노출 유지 후 원인 분류 |
| Vision provider fallback | missing/failed Gemini vision provider | Z.AI vision fallback by default; OpenRouter only when explicitly enabled | OpenRouter disabled metadata remains red unless opt-in + validated smoke |
| Retry output budget | Cerebras GPT-OSS request with low `maxOutputTokens` | effective `maxOutputTokens >= 128` | other providers keep caller-requested token budget |
| Direct routing | explicit remediation query + anomaly semantic frame | Advisor Agent selected | reporter artifact/report frames keep existing precedence |
| intelligent-monitoring BFF | Cloud Run `analyze_server` result or legacy stringified `response` | `{ success:true, data:{ serverId, analysisType, timestamp, ... } }` + provider/model metadata when known | malformed legacy response falls back to existing data shape without throwing |
| QA tracker | Vercel Playwright MCP 결과 | counted QA run + durable artifacts | artifact debt는 예외 사유가 있을 때만 acknowledged |
| data slot policy | long-session mismatch observation | accepted tradeoff 또는 backlog item | product requirement로 승격 시 별도 plan 필요 |

### 테스트 시나리오 (구현 전 확정)

- [x] Analyst all-server anomaly result includes `evidenceContract.mode = "deterministic_evidence"`.
- [x] Analyst single-server anomaly result includes `evidenceContract.signalStrengthMeaning = "evidence_strength_not_incident_probability"`.
- [x] `predictTrends` result includes trend `decisionSource`, `analysisBasis`, and metric-level `rationale`.
- [x] Analyst instructions contain the lightweight evidence boundary and prohibit probability-like wording for signal strength.
- [x] OpenRouter vision fallback is disabled/red by default and Z.AI is the default vision fallback after Gemini.
- [x] Cerebras GPT-OSS requests with `maxOutputTokens < 128` are raised to 128; non-Cerebras requests are unchanged.
- [x] Explicit remediation queries route to Advisor even when semantic anomaly frame is present.
- [x] `analyze_server` responses include `timestamp`; Vercel BFF normalizes legacy stringified Cloud Run responses.
- [x] Vercel production broad QA covers the previously skipped surfaces.
- [x] Reporter live generation records whether response is degraded and whether fallback metadata is normalized.
- [x] QA evidence audit reports 0 orphan durable evidence and 0 missing durable artifact refs after recording.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 — Plan approval and current runtime hardening scope review
  - 완료 기준: 이 plan이 Approved로 전환되고, 이번 runtime hardening 변경 범위가 plan 범위와 일치함을 확인한다.
- [ ] Task 1 — Analyst lightweight evidence contract finalize
  - 완료 기준: targeted Analyst tests, AI Engine `type-check`, AI Engine full test 통과 완료. GitLab commit/push/pipeline 확인은 production post-deploy retest와 함께 남았다.
- [x] Task 2 — Reporter live generation/degraded closure QA
  - 완료 기준: production incident report generation을 실행하고 `degraded`/`fallbackReasonCode`/latency를 QA에 기록한다.
- [x] Task 3 — Broad QA skipped surface closure
  - 완료 기준: `conversational-ai-qa`, `incident reporter generation`, `core route pack`, `observability/security pack` 중 최소 release-risk 높은 항목을 Vercel Playwright MCP로 검증하고 QA tracker에 기록한다.
- [x] Task 4 — Long-session data slot drift policy
  - 완료 기준: `aiQueryAsOfDataSlot` freeze를 accepted tradeoff 또는 Backlog로 정리한다. 구현 요구가 생기면 별도 plan으로 분리한다.
- [x] Task 5 — QA/provider attribution polish
  - 완료 기준: 새 QA 기록에서 가능한 경우 provider/model/route/source가 `unknown` 대신 실제 값으로 보존된다. 제품 런타임 변경 없이 QA 기록 방식으로 해결 가능한 범위만 수행한다.
- [x] Task 5a — Runtime contract hardening without live-smoke endpoint
  - 완료 기준: OpenRouter 기본 fallback 비활성화, Cerebras output guard, Advisor precedence, `analyze_server` normalization이 targeted tests와 type-check를 통과한다.
- [x] Task 6 — Planning hygiene
  - 완료 기준: Completed plan이 root planning 목록에 남아 있으면 TODO 링크를 맞춘 뒤 archive 이동 여부를 결정한다.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `docs(planning):` | 선택 | 아니오 | 아니오 |
| Task 1 | `fix(ai):` 또는 `test(spec):` + `fix(ai):` | 예 | 예 | 아니오 |
| Task 2~3 | `test(qa):` | 예 | 아니오 | 아니오 |
| Task 4 | `docs(qa):` 또는 `docs(planning):` | 예 | 아니오 | 아니오 |
| Task 5 | `test(qa):` 또는 `chore(qa):` | 예 | 아니오 | 아니오 |
| Task 6 | `docs(planning):` | 예 | 아니오 | 아니오 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 1 전 | Analyst evidence contract가 기존 API 소비자를 깨지 않는지 |
| Task 1 후 | 추가 LLM 호출/비용 증가가 없는지 |
| Task 2 후 | Reporter degraded metadata가 raw provider message를 노출하지 않는지 |
| Task 3 후 | skipped surface가 QA 기록에서 실제로 줄었는지 |
| 전체 완료 전 | QA tracker pending/open gap/artifact audit 상태 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| Reporter provider drift가 live에서 재현됨 | fallback 품질이 정상이어도 별도 code-fix task로 승격 |
| Broad QA가 외부 provider quota로 막힘 | deterministic/local 계약 테스트로 대체하고 live smoke는 재시도 기록 |
| Data slot resync가 제품 요구로 승격 | 별도 `data-slot-resync-plan.md` 생성 검토 |
| Bundle budget regression 발견 | 기존 `vitest-storybook-optimization-plan.md`에서 처리 |

## 완료 기준

- [ ] Analyst evidence contract 변경이 GitLab pipeline을 통과한다.
- [x] Vercel production QA가 최신 skipped surface를 보강한다.
- [x] Reporter live generation degraded 상태가 기록되고, 필요 시 후속 code-fix가 분리된다.
- [x] 장기 세션 data slot freeze가 정책적으로 정리된다.
- [ ] `npm run qa:status`에서 pending 0, expert open gap 0 유지.
- [x] `npm run qa:evidence:audit`에서 orphan/missing warning 0 유지.
- [ ] 완료 후 이 plan은 `reports/planning/archive/`로 이동한다.
