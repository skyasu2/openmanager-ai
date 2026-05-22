> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-22 (Task I-3 Reporter 기준 명시 local implementation 반영)
> Tags: ai,krl,session-memory,intentframe,quality,z.ai,production-qa

# AI 품질 개선 계획 (2026-05 이후)

**작성 배경**: v8.11.192 기준 AI 어시스턴트 설계 상태 분석(2026-05-21)에서 도출한 차기 개선 항목.
이전 Q0~Q3(quota rebalance), Task 1-C~3-D(design cleanup), KRL canonical화 등은 모두 아카이브 완료.
이 계획은 **현재 잔존하는 실질 품질 격차**를 대상으로 한다.

**전제 제약**:
- Free Tier 한도: Upstash 500K 커맨드/월, Supabase Free Tier, Groq RPD 1,000
- KB governance: target 72건, hard max 80건. 2026-05-21 `cloud-run/ai-engine` `npm run rag:analyze` 기준 현재 67건이며 전체 PASS.
- Cloud Run: 1 vCPU, 512Mi
- 실 LLM/운영 DB 변경은 필요성이 입증된 경우에만 수행한다. 이미 contract/unit/local smoke로 덮인 failure path를 production에서 인위적으로 만들지 않는다.

**현재 실행 상태**: tracking/conditional. 2026-05-22 기준 `groundingMode` developer-panel 노출 보강과 Z.AI Task F pre-final 관찰은 완료됐으며, Task E는 신규 기능/DB schema 변경이므로 구현 전 SDD 계약을 먼저 Approved 상태로 승격했다. 같은 날 v8.12.0 production QA에서 AZ별 부하 균형 쿼리 grounding 실패와 Top-N+추세 누락이 재현되어 Task G를 기존 AI 품질 계획 안에서 SDD Approved로 추가한다.

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

## 2026-05-21~22 실행 판단

이번 계획 정정의 목적은 **할 일을 늘리는 것**이 아니라, stale 전제와 과잉 QA를 제거하는 것이다.

| 항목 | 판단 | 근거 |
|------|------|------|
| Task A 추가 production LLM QA | 기본 보류 | v8.11.192 OTel criteria production QA가 최고위험 회귀를 이미 확인했다. command/script 확인은 다음 KRL 변경 시 targeted로 수행한다. `groundingMode` developer-panel 노출은 `b5a41e161`에서 보강했다. |
| Task A KB 실패 fallback production 재현 | 미진행 | 운영 KB/도구 실패를 인위적으로 만들면 production 안정성 검증이 아니라 장애 주입이 된다. unit/contract test로만 검증한다. |
| Task B Upstash 실측 보정 | 사용자 액션 필요 | 소비량은 Upstash dashboard 또는 management API 권한이 있어야 확인 가능하다. Redis data REST credential만으로 billing/usage metric을 조회하지 않는다. |
| Task C KRL corpus 보강 | 미진행 | 현재 67건, target 72/hard 80, `security=5`, `incident=9`, governance PASS. 추가 seed는 필요성이 없다. |
| Task D intentFrame 10회 live sampling | 보류 | 실 LLM 호출과 Langfuse trace 접근이 필요하다. 임계값 변경 근거가 생길 때 별도 측정한다. |
| Task E Supabase session memory | SDD 계약 Approved | 신규 기능/DB schema 변경이므로 구현 전 failing test 선행 커밋이 필요하다. 신규 plan 파일은 TODO Backlog와 이 plan Task E가 이미 존재하므로 만들지 않는다. |
| Task F Z.AI 안정성 | 관찰 지속 | 마감일은 2026-05-23. 현재는 코드 작업 대상이 아니다. |
| Task G AZ 집계·Top-N 추세 grounding | SDD 계약 Approved | v8.12.0 production QA에서 실제 품질 갭이 확인됐다. 기존 AI 품질/intentFrame 계획과 중복되므로 신규 plan 파일 없이 이 계획에 계약을 추가하고, failing regression test 선행 커밋 후 구현한다. |

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

**SDD 상태**: Approved (2026-05-22). 계약 섹션을 이 Task 안에 확정했으며, TODO.md Backlog와 이 plan의 중복 주제이므로 신규 plan 파일을 만들지 않는다. 구현 착수 전 `test(spec):` failing test 커밋이 먼저 필요하다.

**현재 한계**:
- Redis TTL 1시간 후 대화 히스토리 소멸
- 세션 ID 기반 일시적 저장만 가능
- 사용자 식별 없이 anonymous 세션만 지원

### 계약 (Contract)

#### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| Supabase schema/RPC | `supabase/migrations/<timestamp>_create_chat_session_memory.sql` |
| Cloud Run session memory | `cloud-run/ai-engine/src/services/ai-sdk/session-memory.ts` |
| Cloud Run Supabase store | `cloud-run/ai-engine/src/services/ai-sdk/session-memory-supabase.ts` |
| Cloud Run agent context | `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-session.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-types.ts` |
| Cloud Run supervisor request | `cloud-run/ai-engine/src/routes/supervisor.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-types.ts` |
| Root BFF owner propagation | `src/app/api/ai/supervisor/session-owner.ts`, `src/app/api/ai/supervisor/route.ts`, `src/app/api/ai/supervisor/stream/v2/route.ts` |
| Root/Cloud Run tests | adjacent `*.test.ts`, plus SQL contract test near existing Supabase SQL contract coverage |

#### 입출력 계약

| 함수/API | 입력 | 출력 | 에러/거부 케이스 |
|----------|------|------|------------------|
| `resolveScopedSessionIds(req, bodySessionId)` | authenticated `NextRequest` + optional session id | `{ sessionId, cacheSessionId, ownerKey, persistentOwnerKey? }` | `persistentOwnerKey`는 `authType='supabase' && userId`일 때만 반환. guest/API key/dev/test는 반환하지 않는다. |
| Root `/api/ai/supervisor/stream/v2` and JSON proxy | normalized messages + session id + auth context | Cloud Run request body에 `sessionOwnerKey`를 조건부 포함 | Supabase 로그인 사용자가 아니면 `sessionOwnerKey`를 전송하지 않는다. raw `userId`는 전송하지 않는다. |
| Cloud Run `streamRequestSchema` | optional `sessionOwnerKey` | sanitized `sessionOwnerKey?: user:<sha256-prefix>` | 패턴 불일치, 128자 초과, non-user prefix는 validation error. |
| `SessionMemoryService.getHistory(sessionId, { ownerKey? })` | `sessionId`, optional persistent owner key | `ModelMessage[]` | owner key가 없으면 기존 Redis key만 조회. Supabase 실패/미구성 시 Redis fallback + warning. |
| `SessionMemoryService.saveHistory(sessionId, messages, { ownerKey? })` | `sessionId`, messages, optional persistent owner key | `void` | owner key가 없으면 기존 Redis TTL 저장. owner key가 있으면 Supabase에 최대 50개 메시지를 저장하고 실패 시 Redis fallback. |
| Supabase RPC `get_chat_session_messages` | `p_owner_key`, `p_session_id`, `p_limit` | ordered JSONB message rows | owner/session 불일치 시 빈 배열. service role 전용. |
| Supabase RPC `upsert_chat_session_history` | `p_owner_key`, `p_session_id`, `p_messages` JSONB | persisted message count | session당 50개 초과 저장 금지, owner당 최신 10세션 초과분 pruning, 7일 경과 세션 pruning. |

#### Supabase 스키마 계약

- Supabase `chat_sessions` / `chat_messages` 테이블 추가
- 로그인 사용자 기준 세션 지속 (guest는 현행 Redis 유지)
- 최대 저장: 10 세션 × 50 메시지 (Supabase free row limit 고려)
- 오래된 세션 만료: `expires_at` 컬럼 + RPC 실행 시 `expires_at < now()` pruning
- RLS: 두 테이블 모두 RLS enabled. public/authenticated broad read policy 금지, `TO service_role` full access policy만 허용
- 저장 값: raw Supabase `user.id` 저장 금지. `persistentOwnerKey`는 `user:<sha256-prefix>` 형태만 저장

#### 테스트 시나리오 (구현 전 확정)

- [ ] Root `session-owner.test`: Supabase auth context는 raw user id 없는 `persistentOwnerKey`를 반환한다.
- [ ] Root `session-owner.test`: guest/API key/dev/test auth context는 `persistentOwnerKey`를 반환하지 않는다.
- [ ] Root stream route test: Supabase 로그인 요청만 Cloud Run body에 `sessionOwnerKey`를 포함한다.
- [ ] Root stream route test: guest 요청은 기존 Redis session id 경로만 유지하고 `sessionOwnerKey`를 포함하지 않는다.
- [ ] Cloud Run route/schema test: valid `user:<hash>` owner key를 수용하고 invalid owner key를 400으로 거부한다.
- [ ] Cloud Run `session-memory.test`: owner key가 있으면 Supabase history를 우선 복원한다.
- [ ] Cloud Run `session-memory.test`: Supabase 미구성/실패 시 Redis fallback으로 복원한다.
- [ ] Cloud Run `session-memory.test`: owner key가 없으면 기존 Redis TTL 저장/조회 경로만 사용한다.
- [ ] Cloud Run `session-memory.test`: Supabase 저장은 최대 50개 메시지만 전달하고 raw user id를 저장하지 않는다.
- [ ] SQL contract test: migration이 `chat_sessions`, `chat_messages`, service-role-only RLS, pruning RPC, owner/session indexes를 포함한다.

**SDD 게이트**: 이 Task는 상당 규모 — 위 테스트 시나리오의 failing test 선행 커밋 필요.

**수용 기준**:
- 로그인 사용자가 세션 재시작 후 이전 대화 컨텍스트 복원
- Supabase free tier row 한도 미초과
- 기존 Redis-based anonymous 경로 유지
- raw 사용자 식별자와 시크릿이 Cloud Run request/log/DB에 저장되지 않음
- Supabase 장애가 AI 응답 실패로 전파되지 않고 Redis fallback 또는 빈 history로 degraded 처리

**예상 소요**: 2~3시간 (설계 + 구현 + 테스트)

**우선순위**: P3 (Backlog에서 SDD ready로 승격 — 구현은 Task F 최종 판정 또는 사용자 명시 지시 후 착수)

- [x] Supabase migration/RPC 계약 설계
- [ ] failing test 선행 커밋
- [ ] session-memory.ts 확장 구현
- [ ] Root BFF `sessionOwnerKey` 전달 구현
- [ ] Cloud Run schema/agent option 전달 구현
- [ ] 세션 복원 local/contract 확인

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
- Cloud Run 로그(2026-05-16 이후): provider가 `zai`로 기록된 실패 로그는 확인되지 않았다. 광범위한 `fallback` 문자열 검색에는 2026-05-18~19 Incident Report tool-based fallback 경고가 잡히지만, provider metadata가 `zai`인 오류는 아니다.
- 같은 기간 ERROR/500 중 incident-report 오류는 v8.11.167~170의 structured output/schema parse 계열, Vision 오류는 2026-05-20 Z.AI Vision overload 재현으로 현재 runtime에서는 Gemini-only 전환 완료. Reporter/Z.AI text primary 불안정 근거로 보지 않는다.
- Cloud Run free-tier guard: 최근 Cloud Build 30건 explicit `machineType` 없음, live service limit `cpu=1;memory=512Mi`.

**2026-05-22 pre-final 관찰**:
- Cloud Run `/health`: `status=ok`, `version=8.11.194`, `config.zai=true`, Redis `state=closed`, routes ready (`2026-05-21T19:11:42Z` / `2026-05-22 04:11 KST` 확인).
- Cloud Run stdout 로그(2026-05-16 이후): `jsonPayload.extra.provider="zai"` 검색 결과 0건, `severity>=ERROR AND provider="zai"` 검색 결과 0건.
- `fallback` 문자열은 2026-05-18~19 Incident Report tool-based fallback 경고 14건이 마지막으로 확인된다. 2026-05-21 이후 fallback 경고는 확인되지 않았고, provider field가 `zai`로 기록된 Z.AI text fallback은 없다.
- 2026-05-21 ERROR 로그 3건은 Groq/Cerebras streamText 오류이며 Z.AI provider 오류가 아니다.
- Cloud Run free-tier guard 재확인: live service limit `cpu=1;memory=512Mi`, 최근 Cloud Build 30건 `options.machineType` 공란.
- 기록된 Z.AI Reporter latency 표본은 `QA-20260521-0550`에서 7021ms(TTFB 1200ms, processing 5821ms)로 목표 P95 <3s에는 못 미친다. 다만 현재 증거는 availability/fallback 안정성 이슈가 아니라 latency 추적 이슈로 분리해 보는 것이 맞다.

**판단 기준**:
- 7일 연속 Z.AI 실패율 < 5% → 안정 판정, 이 Task 완료
- 실패율 ≥ 5% → Reporter primary를 Mistral로 복귀하는 hotfix

**예상 소요**: 관찰만 (코드 작업 없음)

- [ ] 7일 관찰 완료 (마감: 2026-05-23)
- [x] 2026-05-21 중간 관찰 기록
- [x] 2026-05-22 pre-final 관찰 기록
- [ ] 안정/불안정 판정 기록
- [ ] 불안정 시 reporter provider order 복귀 hotfix

---

## Task G: AZ 집계·Top-N 추세 grounding 회귀 수정 (🔴 SDD Approved)

**근거**: v8.12.0 production QA에서 프론트엔드 UX는 정상이나 AI 응답 품질에서 두 가지 데이터 grounding gap이 확인됐다.

| QA 항목 | 현상 | 판단 |
|---------|------|------|
| AZ별 부하 균형 | `DC1-AZ1/AZ2/AZ3 구역별 부하 균형` 질문이 OTel 도구 없이 일반 응답으로 처리되어 33대 같은 hallucinated count를 반환 | 라우팅/도구 계약 gap |
| Top-N+추세 | `메모리 사용률 상위 3개 서버와 추세`에서 상위 서버와 현재 수치는 맞지만 추세 방향/증감폭 누락 | `getServerMetricsAdvanced` 응답 계약 gap |
| Provider fallback | Q2에서 Groq fallback 1건 관찰 | fallback 자체는 정상이나 grounding 실패를 증폭한 보조 증상 |

**코드 분석 결과**:
- `orchestrator-routing-topology.ts`의 boundary regex에는 이미 `az`가 포함되어 있어 `DC1-AZ1` 문자열 미감지만으로 단정하지 않는다.
- 현재 structured topology path는 서버 수/역할/AZ 분포/count 중심이며, **AZ별 CPU/MEM/DISK 부하 집계**를 답하는 계약이 없다.
- `routing-policy.ts`의 prepare step은 AZ/구역별 load-balance 질문을 `getServerMetricsAdvanced`로 강제하지 못한다.
- `getServerMetricsAdvanced`는 Top-N ranking 결과에 24h 평균 대비 trend direction/delta를 포함하지 않는다.
- `supervisor-prompt.ts`와 `NLQ_BASE_INSTRUCTIONS`에는 `순위 + 추세`, `AZ별/구역별 부하 균형` composite 예시가 없다.

### 계약 (Contract)

#### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| AI Engine 메트릭 도구 | `cloud-run/ai-engine/src/tools-ai-sdk/server-metrics/tools-advanced.ts`, `cloud-run/ai-engine/src/tools-ai-sdk/server-metrics/data.ts`, `cloud-run/ai-engine/src/tools-ai-sdk/server-metrics/schemas.ts` |
| 라우팅 정책 | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts` |
| 프롬프트/에이전트 지침 | `cloud-run/ai-engine/src/domains/monitoring/supervisor-prompt.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/nlq.ts` |
| 회귀 테스트 | adjacent `*.test.ts` |

#### 입출력 계약

| 기능 | 입력 | 출력 |
|------|------|------|
| AZ/location group summary | `getServerMetricsAdvanced({ groupBy: "location", metric: "all", timeRange: "current", aggregation: "avg" })` | `groupSummary[]`에 `location`, `serverCount`, `metrics.cpu_avg/memory_avg/disk_avg`, `statusCounts`, `serverIds` 포함 |
| AZ load-balance routing | `AZ`, `DC1-AZ1`, `구역별`, `zone`, `부하 균형`, `balance`가 포함된 fleet query | step 0에서 `getServerMetricsAdvanced` 강제, step 1은 `finalAnswer` |
| Top-N trend | current ranking query with `sortBy`/`limit` | `servers[].trends.<metric>`에 `direction: rising|falling|stable`, `current`, `avg24h`, `deltaPercentPoints` 포함. `answer`에도 요청 metric의 추세 라벨을 포함 |
| Prompt mapping | `메모리 상위 3대와 추세`, `AZ별 부하 균형` | 도구 없는 일반 응답을 금지하고 위 계약의 tool result만 인용 |

#### 테스트 시나리오 (구현 전 확정)

- [x] `routing-policy.test`: `DC1-AZ1/AZ2/AZ3 구역별 부하 균형`은 step 0에서 `getServerMetricsAdvanced`를 강제한다.
- [x] `routing-policy.test`: `메모리 사용률 상위 3개 서버와 추세`는 current ranking path에서 `getServerMetricsAdvanced`를 강제한다.
- [x] `server-metrics.test`: `getServerMetricsAdvanced(groupBy:"location")`는 AZ별 serverCount와 평균 CPU/MEM/DISK를 반환한다.
- [x] `server-metrics.test`: current memory Top-3 응답의 각 서버에 trend direction/avg/delta가 포함되고 `answer`가 추세 라벨을 포함한다.
- [x] `nlq.test` / `routing-policy.test`: 순위+추세 및 AZ load-balance 예시가 프롬프트/지침에 포함된다.

**SDD 게이트**: 이 Task는 AI tool response schema와 routing contract 변경이므로 failing test 선행 커밋이 필요하다.

**수용 기준**:
- production과 동일한 query class에서 도구 없는 일반 응답으로 빠지지 않는다.
- AZ별 서버 수는 OTel resource catalog 기준 실제 18대와 일치한다.
- Top-N 결과는 현재 수치와 24h 평균 대비 방향/증감폭을 함께 제공한다.
- 기존 단일 서버 current metric, historical aggregation, group-by-role query 회귀 없음.

**예상 소요**: 60~90분

- [x] v8.12.0 production QA 증상 분석
- [x] 계약 승인
- [x] failing regression test 선행 커밋 (`4924039d0`)
- [x] 구현 커밋
- [x] AI Engine targeted tests/type-check
- [ ] 필요 시 targeted QA 기록

---

## Task H: Evidence Provider 라우팅·응답 품질 개선 (v8.12.5 QA 발견)

**근거**: v8.12.5 신규 5문항 QA(`QA-20260522-0558`)에서 두 가지 evidence provider 품질 갭이 확인됨.
기존 AI 품질 계획과 주제 중복 → 신규 plan 파일 미생성, 이 Task로 추가.

### H-1: monitoringCapacityForecastEvidenceProvider 불일치 라우팅

**증상**: `QA-20260522-0558 Q1` — "db-mysql-dc1-backup 디스크가 현재 69%야. 이 추세라면 언제 90%를 넘을까? 용량 예측해줘"
→ 이상감지/추세 분석 artifact 카드 출력 (응답 근거: "일반 대화 응답", 도구: "이상감지/추세 분석")

**예상 경로**: `monitoring-capacity-forecast` evidence provider → deterministic 용량 예측 답변
**실제 경로**: Vercel streaming path → server-monitoring-analysis 이상감지 artifact

**관찰된 불일치**:
- `QA-20260522-0557 Q2`: 동일 쿼리 → artifact 우회 확인됨 (0558 이전 세션에서 CAPACITY_FORECAST_EXCLUSION_PATTERN 정상 동작 확인)
- `QA-20260522-0558 Q1`: 동일 쿼리 → 이상감지 카드 재출현
- 두 세션의 차이: 0557은 기존 대화 세션 계속, 0558은 새 대화 시작

**원인 후보**:

| 번호 | 가설 | 진단 방법 |
|------|------|-----------|
| H1-A | `CAPACITY_FORECAST_EXCLUSION_PATTERN` regex가 chat 전처리 이후 메시지에서 불일치 | `chat-artifact-intent.ts` unit test에 동일 쿼리 추가해 확인 |
| H1-B | `isServerMonitoringArtifactRequest`가 EXCLUSION 후에도 다른 조건으로 true 반환 | `isServerMonitoringArtifactRequest` 전체 분기 추적 |
| H1-C | `monitoringCapacityForecastEvidenceProvider.canHandle`이 실제로 매칭되나 `resolve`가 null 반환 → LLM fallback → anomaly tool 선택 | evidence provider `resolve` 로직 확인. `buildCapacityForecastAnswer` → slope≈0 → 빈 결과 가능성 |
| H1-D | 새 대화 시작 시 다른 Vercel Edge 인스턴스가 이전 코드 버전을 서빙 | `/api/version` 응답 확인 |

**CAPACITY_FORECAST_PATTERN 검증** (`load-balance-capacity-evidence-provider.ts`):
```
/(?:언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|...)/i
```
"언제 90%를 넘을까" → `언제.{0,24}90\s*%.{0,24}넘` → 이론상 매칭 ✓
→ 매칭됨에도 provider가 불안정한 경우 H1-C(resolve null)가 주요 원인 가능성

**계약**:
- 동일 세션/신규 세션 모두 "언제 N%를 넘을까/용량 예측" 쿼리가 `monitoring-capacity-forecast` evidence provider를 일관되게 트리거해야 한다.
- `buildCapacityForecastAnswer` slope≈0 케이스도 "현재 추세상 N시간 내 도달 없음"을 명시한 답변을 반환해야 한다 (null 반환 금지).

**테스트 시나리오**:
- [ ] `chat-artifact-intent.test`: "언제 90%를 넘을까? 용량 예측해줘" → `isServerMonitoringArtifactRequest=false`
- [ ] `load-balance-capacity-evidence-provider.test`: CAPACITY_FORECAST_PATTERN이 "언제 90%를 넘을까", "용량 예측해줘", "임계치 도달 시점" 쿼리를 모두 매칭한다
- [ ] `load-balance-capacity-evidence-provider.test`: slope≈0 서버에서 `buildCapacityForecastAnswer`가 null이 아닌 "현재 추세상 90% 도달 없음" 답변을 반환한다

---

### H-2: monitoringPeakMetricEvidenceProvider 응답 내용 부실

**증상**: `QA-20260522-0558 Q3` — "지난 24시간 동안 전체 서버에서 CPU load가 가장 높았던 시간대는 언제야?"
→ "모니터링 피크 지표 근거" 확인 (provider 트리거됨), 그러나 응답은 섹션 제목만 반환, 기간 표시 "최근 1시간"

**예상 응답**: 피크 시각, 상위 서버명, CPU 수치, 24h 내 타임슬롯 정보
**실제 응답**: "📊 CPU 사용률 상위 3대", "💡 서버별 확인 항목", "🖥️ 관련 서버: db-mysql-dc1-primary" — 섹션 제목만 존재

**원인 후보**:

| 번호 | 가설 | 진단 방법 |
|------|------|-----------|
| H2-A | `parseMonitoringPeakMetricMessage`가 windowHours를 1h로 파싱하고 있음 (`HOURS_PATTERN`이 "24시간"을 24가 아닌 다른 값으로 파싱) | `parseWindowHours("지난 24시간 동안")` 직접 테스트 |
| H2-B | evidence provider의 `prompt` 문자열이 LLM에게 빈 placeholder만 제공하고 실제 데이터 없음 | `monitoringPeakMetricEvidenceProvider.resolve` 반환값 확인 |
| H2-C | history 데이터가 충분하지 않아 peak 계산 결과가 빈 상태 | `getTimeRangeData(24)` 반환 슬롯 수 확인 |
| H2-D | LLM이 evidence prompt의 데이터를 응답에 포함하지 않고 자체 생성 | evidence `fallback` 필드를 직접 사용하도록 policy 강화 |

**`HOURS_PATTERN` 분석** (`peak-metric-intent.ts`):
```
/(\d{1,2})\s*(?:시간|h|hr|hour)s?/i
```
"지난 24시간 동안" → "24시간" → `\d{1,2}=24`? NO — `\d{1,2}`는 최대 2자리, 24는 2자리 ✓ → `windowHours=24`
→ windowHours 파싱은 정상. H2-B 또는 H2-C가 주요 원인 가능성

**계약**:
- "지난 24시간" 쿼리에서 `parseWindowHours` 결과가 24여야 한다.
- `monitoringPeakMetricEvidenceProvider.resolve`가 실제 피크 서버명, 최대 수치, 타임슬롯 정보를 포함한 `answer`를 반환해야 한다.
- `answer`가 섹션 제목만 포함하는 경우 테스트로 차단해야 한다.

**테스트 시나리오**:
- [ ] `peak-metric-intent.test`: "지난 24시간 동안 전체 서버에서 CPU load가 가장 높았던 시간대" → `parseWindowHours=24`, metric=`load` 또는 `cpu`
- [ ] `peak-metric-evidence-provider.test`: 24h 히스토리 슬롯이 있을 때 `resolve` 결과의 `answer`에 피크 서버명과 수치가 포함된다
- [ ] `peak-metric-evidence-provider.test`: `answer`가 섹션 제목만("CPU 사용률 상위 3대") 반환하는 경우 테스트 실패

---

**우선순위**: P2 (non-blocking, QA tracker auto WONT-FIX. 재현 빈도 증가 시 P1 승격)
**SDD 게이트**: 진단 → failing test 선행 커밋 → 구현 순서 준수
**현재 판단**: H-1과 H-2 모두 재현 조건이 불안정(동일 쿼리 세션 간 차이). 현재 사용자 경험에 직접 차단 영향은 없으므로 Backlog에 두고 다음 AI Engine 변경 시 함께 처리한다.

**예상 소요**: 진단 30분 + 구현/테스트 60분

- [ ] H-1 `isServerMonitoringArtifactRequest` + `buildCapacityForecastAnswer` slope=0 케이스 진단
- [ ] H-2 `monitoringPeakMetricEvidenceProvider.resolve` answer 내용 진단
- [ ] failing test 선행 커밋
- [ ] 구현 커밋
- [ ] AI Engine targeted tests / type-check 통과

---

## Task I: 신규 개선 항목 (QA-20260522-0559 발견)

**근거**: 2026-05-22 Playwright MCP 6문항 신규 평가에서 이전 QA에서 다루지 않은 영역을 테스트하여 3개 품질 갭 도출.

### I-1: 서버 1:1 비교 쿼리 deterministic 경로 미확립 (P1)

**증상**: "api-was-dc1-01 과 api-was-dc1-02 의 CPU 사용량을 비교해줘"
→ `일반 대화 응답` 경로 라우팅, api-was-dc1-01 **92%** 보고(실제 대시보드 **82%**, 오탈자 Q3에서 `monitoring-server-health` 경로로 82% 정확 보고 — 두 경로 대조로 일반 대화 경로 수치 오류 확인됨).

**현황**:
- AZ 비교(`DC1-AZ1 vs DC1-AZ2`)는 `monitoringLocationLoadBalanceEvidenceProvider`가 처리.
- 개별 서버 1:1 비교("A vs B")는 대응 evidence provider 없음.
- `일반 대화 경로`는 LLM이 수치를 합성하여 오류 발생 가능.

**계약**:
- "서버A 와 서버B CPU/MEM/DISK 비교" 패턴을 `monitoring-metric-ranking` 또는 신규 `monitoringServerCompareEvidenceProvider`가 처리해야 한다.
- 응답의 수치는 현재 OTel 슬롯 데이터와 일치해야 한다.

**테스트 시나리오**:
- [x] `current-metrics-evidence-provider.test`: "api-was-dc1-01 vs api-was-dc1-02 CPU 비교" → deterministic 경로 라우팅 확인
- [x] 응답 수치가 현재 슬롯 OTel 데이터와 일치함

**우선순위**: P1 (수치 오류 직접 발생, intentFrame trust gap 동일 근본 원인)
**SDD 게이트**: 진단 → failing test → 구현

- [x] "A vs B" 쿼리 분류 로직 현황 분석
- [x] failing test 선행 커밋 (`710c6165d`)
- [x] `monitoringMetricCurrentEvidenceProvider` raw-query fallback 확장
- [x] supervisor-prompt few-shot 추가 없이 deterministic evidence provider에서 직접 처리
- [x] AI Engine targeted tests / type-check / full test 통과

---

### I-2: 심층 원인 분석 시 서버 도메인 특성 미주입 (P2)

**증상**: "db-mysql-dc1-backup 서버의 디스크 사용량이 70%로 높은데 원인이 뭔지 분석해줘"
→ 5개 도구 복합 실행, 상관관계(MEM 0.61, NET 0.57) 산출은 양호. 그러나 원인 추정이 "DISK 관련 문제" 수준의 generic 답변. Q1에서 단순 순위 쿼리가 오히려 "백업 산출물 보존 기간, 증분 백업 크기, 오래된 dump 정리 확인"처럼 구체적 권고를 포함한 것과 대조.

**현황**:
- `monitoring-metric-ranking` evidence provider의 서버별 확인 항목은 서버 역할 기반 힌트를 포함.
- 심층 분석 경로(`이상 징후 확인 + 서버 메트릭 조회 외 3`)에는 서버 역할/유형별 도메인 특성이 주입되지 않음.

**계약**:
- backup 서버 DISK 분석 시 binlog/WAL/dump/incremental backup 축적을 원인 후보로 제시해야 한다.
- redis 서버 MEM 분석 시 eviction policy/maxmemory/key TTL 미설정을 원인 후보로 제시해야 한다.
- 서버 유형은 serverId prefix(db-mysql, cache-redis, storage-nfs 등)로 식별 가능.

**상태**: Approved (2026-05-22). 사용자 지시에 따라 다음 단계로 착수하며, live KRL seed 변경 대신 supervisor/Analyst 지침에 역할별 분석 힌트를 먼저 주입한다. DB seed 변경은 별도 필요성이 생길 때만 수행한다.

**구현 방향**: KB seed 보강(서버 역할별 장애 원인 패턴) 또는 supervisor-prompt에 역할별 분석 힌트 추가. 현재 착수 범위는 prompt/instruction 힌트 보강으로 제한한다.

**테스트 시나리오**:
- [ ] `supervisor-prompt.test` / `analyst.test`: backup 서버 디스크 분석 지침에 binlog/dump/incremental backup 근거 포함 확인
- [ ] KRL smoke: "db 서버 디스크 증가 원인" 쿼리의 top result에 backup/binlog 관련 항목 포함

**우선순위**: P2
**SDD 게이트**: prompt/instruction 변경은 failing test 선행 커밋 후 구현한다. KB seed 변경으로 확장할 때는 `rag:analyze` governance 확인 후 진행한다.

- [ ] 서버 역할별 원인 분석 prompt/instruction 힌트 설계
- [ ] supervisor-prompt와 Analyst instruction에 역할 힌트 섹션 추가
- [ ] 필요 시 KRL seed 항목 설계 및 `supabase:rag:smoke` 갱신
- [ ] `rag:analyze` governance PASS 확인

---

### I-3: Reporter 영향 서버 기준 대시보드와 불일치 (P3)

**증상**: 자동 보고서 생성 결과 "영향받는 서버: api-was-dc1-01, web-nginx-dc1-01, web-nginx-dc1-02, web-nginx-dc1-03" (4대 주의)
→ 대시보드는 경고 1대(api-was-dc1-01만), web-nginx 3대는 경고 상태 아님.

**현황**:
- Reporter agent가 "경고" 서버 외 "영향 반경"(downstream dependencies)을 포함하여 4대를 보고.
- 대시보드는 임계값 초과 서버만 "경고"로 표시.
- 사용자 입장에서 두 숫자가 달라 혼란 가능.

**판단 옵션**:
1. Reporter가 영향 서버 개념임을 UI에 명시 (낮은 비용)
2. Reporter 영향 서버 기준을 대시보드 경고 임계값과 통일
3. 현 상태 유지 + 사용자가 보고서 레이블로 이해

**계약**:
- 보고서에 "경고 1대 (임계값 초과)" vs "영향 서버 4대 (의존 서버 포함)"를 구분 표시, 또는
- Reporter가 사용하는 기준("주의" = 어떤 조건인지)을 보고서 본문에 명시.

**우선순위**: P3 (사용자 혼란 유발이나 비차단)
**SDD 게이트**: 불필요 (단순 레이블/텍스트 변경 수준)

- [x] Reporter "주의" 기준 코드 확인 (`analytics-report-utils.ts`, `ReportCard.tsx`, `formatters.ts`)
- [x] 보고서 UI/다운로드 레이블에 임계값 초과 서버와 의존성 포함 영향 범위를 구분 표시
- [x] Reporter targeted tests 통과

---

## 실행 우선순위

| Task | 우선순위 | 상태 | 예상 소요 | 마감 기준 |
|------|:------:|------|:---------:|-----------|
| A: grounded KRL production QA | 🟡 조건부 | 부분 완료, 추가 호출 보류 | 변경 시 15~30분 | KRL runtime 변경 시 |
| B: Redis R-5 완결 | 🟡 사용자 액션 | 접근 권한 대기 | 접근 후 15분 | dashboard/API 가능 시 |
| C: KRL corpus 보강 | — | No-op | 0분 | coverage FAIL 발생 시 재개 |
| F: Z.AI 안정성 관찰 | 🟡 추적 | 관찰 중 | 관찰 | 마감: 2026-05-23 |
| G: AZ 집계·Top-N 추세 grounding | 🔴 High | Implemented (local) | 60~90분 | production QA 회귀 수정 |
| H: Evidence Provider 라우팅·응답 품질 | 🟡 P2 | Backlog | 진단 30 + 구현 60분 | 재현 빈도 증가 또는 다음 AI Engine 변경 시 |
| **I-1: 서버 1:1 비교 쿼리 경로** | 🔴 **P1** | **Implemented (local)** | 진단 30 + 구현 60분 | `710c6165d` failing test 선행, local AI Engine type-check/full test PASS |
| **I-2: 심층 분석 도메인 특성 주입** | 🟡 P2 | Approved | prompt 30 + 검증 30분 | `test(spec):` failing test 선행 |
| **I-3: Reporter 기준 명시** | 🟢 P3 | **Implemented (local)** | 30분 | Reporter UI/다운로드 기준 구분 반영 |
| D: intentFrame 신뢰도 측정 | 🟡 조건부 | 보류 | 필요 시 30분 | routing 증상 재현 시 |
| E: 세션 메모리 확장 | 🟢 중장기 | Approved (Backlog) | 2~3시간 | failing test 선행 필요 |

---

## 완료 기준

- Task A 추가 QA, Task B 실측, Task D 측정은 조건 충족 시만 수행한다.
- Task C는 현재 no-op으로 닫고, 재개 조건 발생 전까지 DB/seed 변경을 금지한다.
- Task F는 2026-05-23 이후 안정/불안정 판정을 기록한다.
- Task E는 failing test 선행 커밋 없이는 구현하지 않는다.
- Task G는 failing regression test와 구현 커밋을 분리하고, AI Engine targeted tests/type-check를 통과한다.
- Task H는 진단 후 근본 원인이 특정되면 failing test → 구현 순서로 진행하고, 재현 조건이 불안정한 동안은 Backlog에 유지한다.
- Task I-1은 서버 비교 쿼리 수치 오류가 재현되거나 다음 AI Engine 변경 시 failing test → 구현 순서로 진행한다.
- Task I-2는 다음 KRL seed 변경 시 함께 처리하고, rag:analyze governance PASS를 검증한다.
- Task I-3은 레이블/텍스트 변경 수준으로 SDD 게이트 불필요, 단독 착수 가능.

---

## 연관 계획서

- [archive/provider-quota-rebalance-plan.md](archive/provider-quota-rebalance-plan.md) — Q0~Q3 완료
- [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) — KRL canonical화, GraphRAG 제거
- [archive/ai-assistant-design-cleanup-plan.md](archive/ai-assistant-design-cleanup-plan.md) — Task 1-C~3-D 완료
- [redis-usage-cleanup-plan.md](redis-usage-cleanup-plan.md) — R-5 미완 (→ Task B)
- [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) — bundlemon 관찰 중
