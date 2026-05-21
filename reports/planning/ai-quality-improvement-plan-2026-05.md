> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-21
> Tags: ai,krl,session-memory,intentframe,quality,z.ai

# AI 품질 개선 계획 (2026-05 이후)

**작성 배경**: v8.11.192 기준 AI 어시스턴트 설계 상태 분석(2026-05-21)에서 도출한 차기 개선 항목.
이전 Q0~Q3(quota rebalance), Task 1-C~3-D(design cleanup), KRL canonical화 등은 모두 아카이브 완료.
이 계획은 **현재 잔존하는 실질 품질 격차**를 대상으로 한다.

**전제 제약**:
- Free Tier 한도: Upstash 500K 커맨드/월, Supabase Free Tier, Groq RPD 1,000
- KB governance: target 72건, hard max 80건. 2026-05-21 `cloud-run/ai-engine` `npm run rag:analyze` 기준 현재 67건이며 전체 PASS.
- Cloud Run: 1 vCPU, 512Mi
- 실 LLM/운영 DB 변경은 필요성이 입증된 경우에만 수행한다. 이미 contract/unit/local smoke로 덮인 failure path를 production에서 인위적으로 만들지 않는다.

**현재 실행 상태**: tracking/conditional. 2026-05-21 기준 `groundingMode` developer-panel 노출 보강은 완료됐으며, 남은 항목은 사용자 액션 또는 재개 조건이 충족될 때만 진행한다.

---

## 현황 스냅샷 (v8.11.192, 2026-05-21)

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| KRL grounded synthesis | v8.11.191~192 신규 도입, v8.11.192 OTel criteria production QA 완료 | production 추가 호출은 변경 발생 시만 수행 |
| KB corpus | 67건 (target 72, hard max 80), governance PASS | 현 상태 유지 |
| 세션 메모리 | session-memory.ts 71줄, 최대 20메시지 | Supabase 기반 지속 (P3) |
| Z.AI 안정성 | Reporter primary 편입 5일차 | 안정성 관찰 게이트 통과 |
| intentFrame 신뢰도 | 0.8 임계값, 실제 적중률 미측정 | 실측 후 임계값 교정 |
| Redis R-5 | 예산 초안 완료, 실측 보정 대기 | dashboard/management API 접근 가능 시만 보정 |
| bundlemon | warn-first 관찰 중 (2026-05-30 마일스톤) | blocking 승격 여부 결정 |

---

## 2026-05-21 실행 판단

이번 계획 정정의 목적은 **할 일을 늘리는 것**이 아니라, stale 전제와 과잉 QA를 제거하는 것이다.

| 항목 | 판단 | 근거 |
|------|------|------|
| Task A 추가 production LLM QA | 기본 보류 | v8.11.192 OTel criteria production QA가 최고위험 회귀를 이미 확인했다. command/script 확인은 다음 KRL 변경 시 targeted로 수행한다. `groundingMode` developer-panel 노출은 `b5a41e161`에서 보강했다. |
| Task A KB 실패 fallback production 재현 | 미진행 | 운영 KB/도구 실패를 인위적으로 만들면 production 안정성 검증이 아니라 장애 주입이 된다. unit/contract test로만 검증한다. |
| Task B Upstash 실측 보정 | 사용자 액션 필요 | 소비량은 Upstash dashboard 또는 management API 권한이 있어야 확인 가능하다. Redis data REST credential만으로 billing/usage metric을 조회하지 않는다. |
| Task C KRL corpus 보강 | 미진행 | 현재 67건, target 72/hard 80, `security=5`, `incident=9`, governance PASS. 추가 seed는 필요성이 없다. |
| Task D intentFrame 10회 live sampling | 보류 | 실 LLM 호출과 Langfuse trace 접근이 필요하다. 임계값 변경 근거가 생길 때 별도 측정한다. |
| Task E Supabase session memory | Backlog 유지 | 신규 기능/DB schema 변경이므로 별도 Approved plan과 failing test 선행 커밋 전에는 착수하지 않는다. |
| Task F Z.AI 안정성 | 관찰 지속 | 마감일은 2026-05-23. 현재는 코드 작업 대상이 아니다. |

---

## Task A: grounded KRL production QA (부분 완료, 추가 호출 보류)

**근거**: v8.11.191(`feat(ai): grounded LLM synthesis for direct KRL knowledge path`)과
v8.11.192(`fix(ai): keep otel criteria in grounded krl answers`)는 FORCE_KB_QUERY_PATTERN
경로 전체를 변경했다. unit test 5개가 추가됐으나 production end-to-end QA가 없다.

**대상 시나리오와 현재 판단**:
1. `명령어 알려줘` / `스크립트 보여줘` 류 → 다음 KRL command/script 경로 변경 시 targeted QA로 수행
2. OTel criteria(cpu/memory/disk 임계값) 포함 KRL 답변 반환 확인 → `QA-20260521-0547` 완료
3. KB 검색 실패 시 template fallback 동작 확인 → production 인위 재현 금지, unit/contract test로 검증
4. `groundingMode: llm-synthesized` vs `template-fallback` 메타데이터 반환 확인 → backend metadata와 developer-panel JSON 노출을 unit/DOM test로 검증

**수용 기준**:
- Vercel production 대상 OTel criteria QA PASS (`QA-20260521-0547`)
- `groundingMode` metadata는 supervisor direct-knowledge unit/contract test와 frontend developer-panel DOM test에서 확인
- KB failure fallback은 production 장애 주입 없이 deterministic test로만 확인
- 추가 KRL command/script runtime 변경이 발생하면 1회 targeted production QA를 별도 기록

**2026-05-21 진행 상태**:
- 완료: `QA-20260521-0547`에서 v8.11.192 production 대상 OTel criteria UI QA 통과.
  - `/api/version=8.11.192`, Cloud Run AI Engine health `8.11.192`.
  - Dashboard 18대 OTel summary와 AI KRL/OTel 답변의 `P0/P1/P3/P99` 기준 포함 확인.
  - Playwright MCP 프로필 잠금으로 기존 세션을 종료하지 않고 isolated Playwright로 동일 production URL을 검증.
- 추가 확인: `QA-20260521-0550`에서 v8.11.194 weekly focused QA 기준 KRL grounded synthesis가 PASS.
  - `searchKnowledgeBase` 5건 반환, Z.AI `glm-4.5-flash` 합성, OTel 18대/6역할 서버명 보존을 확인했다.
  - UI debug view의 `groundingMode: llm-synthesized` 미노출은 사용자-facing 회귀나 release blocker는 아니었으나, `b5a41e161`에서 developer-panel JSON 정규화 경계를 보강해 노출되도록 수정했다.
- 잔여 처리:
  - command/script production QA는 현재 릴리스 차단 항목이 아니다.
  - KB 실패 fallback production 재현은 하지 않는다.
  - `groundingMode` metadata는 UI/API 계약 변경 시 회귀 테스트를 유지한다.

**예상 소요**: 현재 추가 작업 없음. 변경 발생 시 targeted QA 15~30분.

- [x] OTel criteria production UI QA 실행
- [x] `npm run qa:record` 로 결과 기록 (`QA-20260521-0547`)
- [ ] command/script 경로가 변경될 때 targeted QA 실행
- [x] KB 실패 fallback은 production 재현 대상에서 제외
- [x] `groundingMode` 메타데이터 developer-panel 노출 보강 (`b5a41e161`)
- [ ] 회귀 발견 시 별도 hotfix 커밋

---

## Task B: Redis R-5 완결 (사용자 액션 필요)

**근거**: `redis-usage-cleanup-plan.md` R-5 체크리스트에 실측 보정 항목이 미완 상태.

**작업**:
- Upstash 대시보드 또는 management API 권한으로 일간/월간 커맨드 소비 실측치 확인
- `docs/reference/architecture/infrastructure/redis-usage.md` 내 예산 섹션 수치 보정
- redis-usage-cleanup-plan.md R-5 `[x]` 체크 완료 후 archive 이동 판단

**수용 기준**:
- 실측 커맨드 소비량 기록됨
- 문서 예상치와 실측치 간 괴리가 20% 초과 시 소비원 재분석

**현재 판단**:
- 로컬 Redis data REST credential은 key/value 접근용이며, billing/usage metric 확인 권한으로 사용하지 않는다.
- dashboard/management API 접근이 확보되기 전까지 문서 수치 보정은 진행하지 않는다.

**예상 소요**: dashboard 접근 확보 후 15분

- [ ] Upstash 대시보드 또는 management API로 소비 확인
- [ ] redis-usage.md 수치 보정
- [ ] redis-usage-cleanup-plan.md R-5 최종 체크
- [ ] 모든 Task 완료 시 plan 파일 archive 이동

---

## Task C: KRL corpus 보강 (현시점 불필요)

**기존 근거의 폐기 사유**: 이 계획 초안은 과거 KB 60건, hard max 64 전제를 사용했다.
2026-05-20 KRL corpus cap expansion 이후 live KB는 이미 67건이고 target/hard cap은 72/80이다.

**2026-05-21 live inventory** (`cloud-run/ai-engine` `npm run rag:analyze`):
- `total_docs=67`
- target max `72`, hard max `80`
- `architecture=8`, `best_practice=9`, `command=25`, `incident=9`, `security=5`, `troubleshooting=11`
- governance checks PASS

**판단**:
- `security=5`는 현재 target 범위 상단에 도달했다.
- `incident=9`도 기존 목표 범위 안이다.
- 추가 seed 작성, Supabase 적용, smoke/QA record는 지금 수행하지 않는다.

**재개 조건**:
- `npm run rag:analyze`에서 category coverage FAIL 발생
- production KRL QA에서 특정 운영 질문의 top result 누락 재현
- 신규 정책/운영 문서가 실제 런타임 답변에 반드시 필요해짐

**수용 기준**:
- 현 상태 유지. 별도 DB/seed 변경 없음.
- 재개 조건 발생 시 별도 plan update 후 진행.

**예상 소요**: 0분 (no-op)

- [x] `npm run rag:analyze` 현재 상태 확인
- [x] seed SQL 작성 미진행 결정
- [x] Supabase 적용 미진행 결정
- [x] smoke/QA record 미진행 결정

---

## Task D: intentFrame 신뢰도 실측 (관찰, 보류)

**근거**: `selectExecutionMode()`에서 intentFrame은 confidence ≥ 0.8 이상일 때만 routing primary signal로 채택된다(`INTENT_FRAME_EXECUTION_MODE_CONFIDENCE = 0.8`). 실제 production에서 이 임계값을 충족하는 비율이 얼마인지 측정된 적이 없다.

**현재 구조 요약**:
```
Vercel: extractEntitiesCached() → intentFrame (SemanticIntentFrame)
       ↓ toDomainIntentFrame() 변환
Cloud Run: selectExecutionMode(query, analysisMode, intentFrame, inputType)
         → resolveIntentFrameExecutionMode(intentFrame)
         → confidence < 0.8 → undefined (regex fallback으로 계속 진행)
         → confidence ≥ 0.8 → intentFrame.executionMode 반환
```

**측정 방법**:
- Langfuse 트레이스에서 `intentFrame.confidence` 분포 샘플링 (10회 대화 기준)
- 실측 신뢰도 분포: 0.8 초과 비율이 50% 미만이면 임계값 0.7 하향 검토
- Groq `llama-4-scout` NLQ 추출 품질 및 정확도 확인

**현재 판단**:
- 10회 live sampling은 실 LLM 호출과 Langfuse trace 접근이 필요하므로 일반 계획 정리 작업에서 실행하지 않는다.
- routing 회귀 또는 confidence 임계값 관련 production 증상이 재현될 때 별도 측정한다.
- 임계값 변경은 계약 변경에 해당하므로 Approved plan + failing test 선행 후 진행한다.

**수용 기준**:
- 10회 샘플에서 confidence 분포 기록
- 0.8 임계값 적합성 판단 보고서 (유지/하향/상향)
- 임계값 변경이 필요한 경우 별도 핫픽스로 처리

**예상 소요**: 30분 (관찰) + 필요시 30분 (임계값 조정)

- [ ] 필요성 재확인 후 Langfuse 또는 로컬 dev 서버로 10회 쿼리 confidence 샘플링
- [ ] 분포 결과 기록
- [ ] 임계값 유지 / 조정 결정

---

## Task E: 세션 메모리 확장 — Supabase 기반 (🟢 중장기)

**근거**: `session-memory.ts` 71줄, Redis 기반 최대 20메시지(TTL 1시간). 세션 재시작 시 대화 맥락이 단절된다.

**현재 한계**:
- Redis TTL 1시간 후 대화 히스토리 소멸
- 세션 ID 기반 일시적 저장만 가능
- 사용자 식별 없이 anonymous 세션만 지원

**설계 방향** (Free Tier 준수):
- Supabase `chat_sessions` / `chat_messages` 테이블 추가
- 로그인 사용자 기준 세션 지속 (guest는 현행 Redis 유지)
- 최대 저장: 10 세션 × 50 메시지 (Supabase free row limit 고려)
- 오래된 세션 자동 만료: DB 레벨 `created_at < now() - interval '7 days'`

**SDD 게이트**: 이 Task는 상당 규모 — 별도 failing test 선행 커밋 필요.

**수용 기준**:
- 로그인 사용자가 세션 재시작 후 이전 대화 컨텍스트 복원
- Supabase free tier row 한도 미초과
- 기존 Redis-based anonymous 경로 유지

**예상 소요**: 2~3시간 (설계 + 구현 + 테스트)

**우선순위**: P3 (Backlog — A/B/C/D 완료 후 착수)

- [ ] Supabase migration 설계 (테이블 스키마)
- [ ] failing test 선행 커밋
- [ ] session-memory.ts 확장 구현
- [ ] 세션 복원 E2E 확인

---

## Task F: Z.AI 안정성 관찰 게이트 (🟡 추적)

**근거**: v8.11.156(2026-05-16)에 Z.AI(GLM Flash)를 Reporter primary로 편입했다. 현재 5일 경과.

**관찰 항목**:
- Reporter Agent Cloud Run 로그에서 Z.AI 실패율 추적
- Z.AI → Mistral fallback 발생 빈도
- 응답 레이턴시 (목표 <3s P95)

**2026-05-21 중간 관찰**:
- Cloud Run `/health`: `status=ok`, `version=8.11.194`, `config.zai=true`, Redis `state=closed`, routes ready.
- 인증된 `/api/ai/providers`: Z.AI `enabled=true`, `available=true`, model `glm-4.5-flash`, `smokeStatus=green`, `modelDrift=[]`.
- Cloud Run 로그(2026-05-16 이후): `RetryWithFallback`/`fallback` 검색 결과 0건. Z.AI provider 실패로 식별되는 로그 없음.
- 같은 기간 ERROR/500 중 incident-report 오류는 v8.11.167~170의 structured output/schema parse 계열, Vision 오류는 2026-05-20 Z.AI Vision overload 재현으로 현재 runtime에서는 Gemini-only 전환 완료. Reporter/Z.AI text primary 불안정 근거로 보지 않는다.
- Cloud Run free-tier guard: 최근 Cloud Build 30건 explicit `machineType` 없음, live service limit `cpu=1;memory=512Mi`.

**판단 기준**:
- 7일 연속 Z.AI 실패율 < 5% → 안정 판정, 이 Task 완료
- 실패율 ≥ 5% → Reporter primary를 Mistral로 복귀하는 hotfix

**예상 소요**: 관찰만 (코드 작업 없음)

- [ ] 7일 관찰 완료 (마감: 2026-05-23)
- [x] 2026-05-21 중간 관찰 기록
- [ ] 안정/불안정 판정 기록
- [ ] 불안정 시 reporter provider order 복귀 hotfix

---

## 실행 우선순위

| Task | 우선순위 | 상태 | 예상 소요 | 마감 기준 |
|------|:------:|------|:---------:|-----------|
| A: grounded KRL production QA | 🟡 조건부 | 부분 완료, 추가 호출 보류 | 변경 시 15~30분 | KRL runtime 변경 시 |
| B: Redis R-5 완결 | 🟡 사용자 액션 | 접근 권한 대기 | 접근 후 15분 | dashboard/API 가능 시 |
| C: KRL corpus 보강 | — | No-op | 0분 | coverage FAIL 발생 시 재개 |
| F: Z.AI 안정성 관찰 | 🟡 추적 | 관찰 중 | 관찰 | 마감: 2026-05-23 |
| D: intentFrame 신뢰도 측정 | 🟡 조건부 | 보류 | 필요 시 30분 | routing 증상 재현 시 |
| E: 세션 메모리 확장 | 🟢 중장기 | Draft | 2~3시간 | Backlog |

---

## 완료 기준

- Task A 추가 QA, Task B 실측, Task D 측정은 조건 충족 시만 수행한다.
- Task C는 현재 no-op으로 닫고, 재개 조건 발생 전까지 DB/seed 변경을 금지한다.
- Task F는 2026-05-23 이후 안정/불안정 판정을 기록한다.
- Task E는 별도 Approved plan 없이는 구현하지 않는다.

---

## 연관 계획서

- [archive/provider-quota-rebalance-plan.md](archive/provider-quota-rebalance-plan.md) — Q0~Q3 완료
- [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) — KRL canonical화, GraphRAG 제거
- [archive/ai-assistant-design-cleanup-plan.md](archive/ai-assistant-design-cleanup-plan.md) — Task 1-C~3-D 완료
- [redis-usage-cleanup-plan.md](redis-usage-cleanup-plan.md) — R-5 미완 (→ Task B)
- [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) — bundlemon 관찰 중
