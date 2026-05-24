> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-24 (Z.AI stability gate closure)
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

**현재 실행 상태**: tracking/conditional. 2026-05-22 기준 `groundingMode` developer-panel 노출 보강과 Z.AI Task F pre-final 관찰은 완료됐으며, v8.12.0~v8.12.5 production QA에서 발견된 Task G/H/I 계열 AI 품질 gap은 local implementation 후 v8.12.6으로 배포 완료했다. 같은 날 v8.12.5 2차 Playwright MCP 평가에서 capacity forecast 표현 다양성, 영어+오타 metric 입력, Redis 설정 가이드 KRL 미진입이 추가 확인되어 Task H follow-up으로 회귀 테스트 선행 후 v8.12.7로 배포 완료했다. `QA-20260522-0562`에서 남은 H-4 DC 비교·운영 우선순위·CPU "위험 수준 도달" 표현은 v8.12.9 배포 후 `QA-20260522-0563`에서 3/3 PASS로 닫았다. H-5 semantic-router-v2/fail-closed는 SDD/failing spec 선행 후 v8.12.10으로 배포했고 `QA-20260522-0564` production QA에서 deterministic fail-closed를 확인했다. 2026-05-24 기준 Task E Supabase 장기 세션 메모리는 portfolio-deferred, Task J standalone 운영 질의 guard는 완료, Task F Z.AI 안정성 관찰 게이트는 provider-attributed 오류 0건으로 완료 처리했다.

---

## 현황 스냅샷 (v8.11.192, 2026-05-21)

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| KRL grounded synthesis | v8.11.191~192 신규 도입, v8.11.192 OTel criteria production QA 완료 | production 추가 호출은 변경 발생 시만 수행 |
| KB corpus | 67건 (target 72, hard max 80), governance PASS | 현 상태 유지 |
| 세션 메모리 | session-memory.ts 71줄, 최대 20메시지, Redis TTL 1시간 | 현행 유지. 장기 기억은 portfolio-deferred, standalone 질의 정확도 우선 |
| Z.AI 안정성 | Reporter primary 편입 후 7일+ 관찰 | availability/fallback 안정 판정. Latency는 별도 추적 |
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
| Task E Supabase session memory | Portfolio-deferred | 비용 0원 범위 구현은 가능하지만 DB/RLS/RPC/pruning/QA 복잡도 대비 포트폴리오 효과가 낮다. 현행 Redis 1시간 TTL을 유지하고, 장기 기억은 핵심 기능으로 홍보하지 않는다. |
| Task F Z.AI 안정성 | 완료 | 2026-05-24 final 관찰에서 Z.AI/GLM provider-attributed ERROR 0건, `config.zai=true`, Cloud Run free-tier guard 유지. Reporter primary 유지. |
| Task G AZ 집계·Top-N 추세 grounding | Released | v8.12.0 production QA에서 확인된 품질 갭은 failing regression test 선행 후 구현·배포까지 완료됐다. 현재 신규 구현 대상이 아니며, 재현 시 새 회귀 테스트로 재개한다. |

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
Cloud Run: selectExecutionMode(query, intentFrame, inputType)
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

## Task E: 세션 메모리 확장 — Supabase 기반 (Portfolio-deferred)

**근거**: `session-memory.ts` 71줄, Redis 기반 최대 20메시지(TTL 1시간). 세션 재시작 시 대화 맥락이 단절된다.

**SDD 상태**: 계약 초안 Approved였으나, 2026-05-24 portfolio 판단으로 구현 보류. 계약 섹션은 재개 시 재사용 가능한 참고안으로 유지하지만, 현재 구현 대상이 아니다.

**2026-05-24 판단**:
- 포트폴리오에서 더 중요한 것은 장기 사용자 기억보다 `현재 서버 상태`, `정상 범위 서버`, `최저 부하`, `성능 개선 조언`, `즉시 조치 대상` 같은 standalone 운영 질의의 정확도다.
- Supabase Free Tier 안에서 0원 구현은 가능하지만 DB migration, RLS, service-role RPC, owner hash, pruning, fallback, QA 표면이 늘어난다.
- 저장 비용보다 실제 위험은 저장된 대화를 prompt에 다시 넣으며 생기는 LLM 토큰/쿼터 증가다.
- 따라서 Cloud Run RAM 증설, min instance, 항상 켜진 worker, Supabase 장기 기억 구현은 진행하지 않는다.

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

**우선순위**: Low / Portfolio-deferred

**재개 조건**:
- 로그인 사용자의 며칠 단위 장기 follow-up이 포트폴리오 핵심 시나리오로 승격될 때
- 실제 QA에서 standalone 질의가 아니라 세션 기억 부재 자체가 blocker로 확인될 때
- Supabase row/egress와 LLM prompt budget을 함께 감당할 명확한 운영 예산이 있을 때

- [x] Supabase migration/RPC 계약 설계
- [x] 2026-05-24 portfolio-deferred 판단 기록
- [ ] 재개 조건 충족 시 failing test 선행 커밋
- [ ] 재개 조건 충족 시 session-memory.ts 확장 구현
- [ ] 재개 조건 충족 시 Root BFF `sessionOwnerKey` 전달 구현
- [ ] 재개 조건 충족 시 Cloud Run schema/agent option 전달 구현
- [ ] 재개 조건 충족 시 세션 복원 local/contract 확인

---

## Task F: Z.AI 안정성 관찰 게이트 (Completed)

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

**2026-05-24 final 관찰**:
- Cloud Run `/health`: `status=ok`, `version=8.12.19`, `config.zai=true`, Redis `state=closed`, routes ready.
- Cloud Run free-tier guard: live service limit `cpu=1;memory=512Mi`, 최근 Cloud Build 30건 `options.machineType` 공란.
- Cloud Run 로그(2026-05-16 이후): `severity>=ERROR AND ("zai" OR "Z.AI" OR "glm")` 검색 결과 0건.
- 같은 기간 `zai/Z.AI/glm` 전체 검색에는 2026-05-22 incident-report tool fallback 경고와 과거 provider toggle 로그가 잡혔지만, Z.AI provider/model attributed failure는 확인되지 않았다. 2026-05-22 주변 ERROR는 Groq streamText 오류와 Analyst empty-response fallback으로, Z.AI text primary 불안정 근거로 보지 않는다.
- 최종 판정: Z.AI Reporter primary는 availability/fallback 기준 안정. Reporter primary를 Mistral로 되돌리는 hotfix는 하지 않는다. 단, latency P95 <3s는 표본 부족과 7s 표본 때문에 안정 판정 근거로 쓰지 않고 향후 QA latency rollup에서 별도 관찰한다.

**판단 기준**:
- 7일 연속 Z.AI 실패율 < 5% → 안정 판정, 이 Task 완료
- 실패율 ≥ 5% → Reporter primary를 Mistral로 복귀하는 hotfix

**예상 소요**: 완료 (코드 작업 없음)

- [x] 7일 관찰 완료 (마감: 2026-05-23)
- [x] 2026-05-21 중간 관찰 기록
- [x] 2026-05-22 pre-final 관찰 기록
- [x] 2026-05-24 final 관찰 기록
- [x] 안정 판정 기록
- [x] 불안정 시 reporter provider order 복귀 hotfix 불필요

---

## Task G: AZ 집계·Top-N 추세 grounding 회귀 수정 (Released)

**상태**: Released. v8.12.0 production QA에서 확인된 두 가지 데이터 grounding gap은 failing regression test 선행 후 구현·검증까지 완료했다. 이 섹션의 계약은 완료 이력과 재개 기준으로 보존한다.

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

**SDD 게이트**: 완료. 이 Task는 AI tool response schema와 routing contract 변경이었으므로 failing test 선행 커밋 후 구현했다.

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

**Status**: Released(v8.12.6) (2026-05-22)

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
| H1-E | `parseThreshold`가 "현재 69% ... 언제 90%"에서 첫 번째 퍼센트(현재값)를 목표 임계치로 오인 | provider regression test로 `threshold=90` 고정 |

**진단 결과(2026-05-22)**:
- H1-B 재현: server-specific exclusion 이후 general monitoring artifact 분기로 재진입 가능.
- H1-E 재현: evidence provider가 동일 쿼리에서 목표 임계치 90이 아닌 현재값 69를 threshold로 반환.

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
- [x] `chat-artifact-intent.test`: "언제 90%를 넘을까? 용량 예측해줘" → `isServerMonitoringArtifactRequest=false`
- [x] `load-balance-capacity-evidence-provider.test`: CAPACITY_FORECAST_PATTERN이 "언제 90%를 넘을까", "용량 예측해줘", "임계치 도달 시점" 쿼리를 모두 매칭한다
- [x] `load-balance-capacity-evidence-provider.test`: slope≈0 서버에서 `buildCapacityForecastAnswer`가 null이 아닌 "현재 추세상 90% 도달 없음" 답변을 반환한다

---

### H-2: monitoringPeakMetricEvidenceProvider 응답 내용 부실

**Status**: Released(v8.12.6) (2026-05-22)

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

**진단 결과(2026-05-22)**:
- H2-A는 현재 코드상 24h 파싱이 가능하다.
- H2-B/H2-C는 provider fallback이 피크 시각·서버명·수치를 만들고 있어 주원인 가능성이 낮다.
- H2-D 재현 가능성이 높다. 일반 peak evidence는 `responsePolicy=deterministic_answer`가 없어 stream path에서 LLM 합성으로 넘어갈 수 있다.

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
- [x] `peak-metric-intent.test`: "지난 24시간 동안 전체 서버에서 CPU load가 가장 높았던 시간대" → `parseWindowHours=24`, metric=`load`
- [x] `peak-metric-evidence-provider.test`: 24h 히스토리 슬롯이 있을 때 `resolve` 결과의 `answer`에 피크 서버명과 수치가 포함된다
- [x] `peak-metric-evidence-provider.test`: `answer`가 섹션 제목만("CPU 사용률 상위 3대") 반환하는 경우 테스트 실패

---

### H-3: v8.12.5 2차 QA capacity forecast/KRL routing follow-up

**Status**: Released (v8.12.7, 2026-05-22)

**근거**: v8.12.5 2차 Playwright MCP 평가에서 AZ load-balance와 "언제 90% 넘을까" 경로는 PASS였지만, 표현 다양성과 영어+오타 입력에서 deterministic evidence path miss가 확인됐다.

| QA 항목 | 증상 | 수정 방향 |
|---------|------|-----------|
| Q2 capacity forecast 표현 다양성 | "100%에 도달하는 시점 예측", "포화 예측"이 `server-monitoring-analysis` artifact로 오라우팅 | Root `CAPACITY_FORECAST_EXCLUSION_PATTERN` 확장 |
| 영어+오타 입력 | `cache-redis-dc1-01 memori when will it exceed 90%`가 OTel 없는 일반 대화로 응답, LLM이 임의 ETA/증가율 생성 | Cloud Run capacity evidence provider의 영어 threshold 순서, `memori` metric typo, query 내 server id fallback 보강 |
| Q4 Redis 설정 가이드 | "Redis 설정 가이드" 류가 KRL direct grounded path에 진입하지 않고 일반 Advisor LLM으로 25초 응답 | `FORCE_KB_QUERY_PATTERN`에 Redis 설정/config guide 표현 추가. 즉시 완화 명령어는 KRL 강제에서 제외 |

**계약**:
- capacity forecast는 한국어 "N%에 도달하는 시점", "포화 예측", "가득 찰 때" 표현을 artifact가 아닌 일반 AI/evidence 경로로 보낸다.
- `when will it exceed N%`처럼 영어에서 동사가 threshold보다 먼저 나오는 표현도 `monitoring-capacity-forecast` deterministic evidence로 처리한다.
- `memori`/`memroy`는 memory metric typo로만 보정하고, 실제 수치는 OTel snapshot/history에서만 가져온다.
- Redis 설정 가이드/redis.conf/maxmemory/eviction 설명 요청은 KRL direct knowledge path로 보내되, "즉시 완화 명령어" 요청은 기존 deterministic command guidance를 유지한다.

**테스트 시나리오**:
- [x] `chat-artifact-intent.test`: "100%에 도달하는 시점 예측", "포화 예측", "가득 찰 때" → artifact 생성 없음
- [x] `entity-extractor.test`: `cache-redis-dc1-01 memori when will it exceed 90%` → `capacity_forecast`, metric=`memory`, target server 보존
- [x] `load-balance-capacity-evidence-provider.test`: 영어 threshold 순서 + `memori` typo → deterministic capacity evidence
- [x] `supervisor-domain-evidence.test`: 동일 영어+오타 질의가 `monitoring-capacity-forecast`로 resolve
- [x] `query-routing-signals.test`: Redis 설정 가이드는 `knowledge`, Redis 즉시 완화 명령어는 non-knowledge

---

**우선순위**: P2 (non-blocking, QA tracker auto WONT-FIX. 재현 빈도 증가 시 P1 승격)
**SDD 게이트**: 진단 → failing test 선행 커밋 → 구현 순서 준수
**현재 판단**: H-1/H-2 및 review follow-up은 v8.12.6으로 배포 완료. H-3은 회귀 테스트 선행 후 v8.12.7로 배포 완료했으며, 다음 production QA에서 사용자-facing 품질을 재확인한다.

**예상 소요**: 진단 30분 + 구현/테스트 60분

- [x] H-1 `isServerMonitoringArtifactRequest` + `buildCapacityForecastAnswer` slope=0 케이스 진단 (`8f12a0b30`)
- [x] H-2 `monitoringPeakMetricEvidenceProvider.resolve` answer 내용 진단 (`d09af3f46`)
- [x] H-1 failing test 선행 커밋 (`8f12a0b30`)
- [x] H-1 구현 완료(local)
- [x] H-1 AI Engine targeted/full tests, root targeted/test:quick/type-check/lint/test:contract 통과
- [x] H-2 failing test 선행 커밋 (`d09af3f46`)
- [x] H-2 구현 완료(local)
- [x] Review follow-up: `parseThreshold` 현재/과거 퍼센트 guard 보강, 서버 ID case-insensitive exact match, retired `mode_multi_analysis_mode` label 제거 (`06309822c`)
- [x] v8.12.6 release/tag pipeline `2545506889` success, Cloud Run `ai-engine-00508-4bv` 100% traffic
- [x] H-3 failing spec 선행 커밋 (`f5517a0d6`)
- [x] H-3 구현 완료(local): capacity forecast 표현 확장, 영어 threshold/memory typo deterministic evidence, Redis 설정 가이드 KRL routing
- [x] H-3 targeted tests, root type-check/lint/test:quick/test:contract, AI Engine type-check/full test 통과
- [x] v8.12.7 release/tag pipeline `2545712930` success, Cloud Run `ai-engine-00509-pgh` 100% traffic, production `/api/version` 및 AI Engine `/health` 8.12.7 확인
- [x] QA-20260522-0562에서 "포화 예측", "가득 찰까", 영어 `how soon will disk hit 80%` capacity forecast PASS 및 `monitoring-metric-trend` PASS 확인

### H-4: QA-20260522-0562 residual deterministic routing

**Status**: Released (v8.12.9) + production QA 완료.

**근거**: v8.12.7 Playwright MCP 7문항 평가(`QA-20260522-0562`)에서 H-3 개선은 확인됐지만, 일반 대화 경로로 빠질 때 OTel 없는 수치 창작 위험이 다시 확인됐다. 특히 Q5의 `api-was-dc1-01 CPU 92%`는 Q7의 OTel 실측 43%와 충돌했다.

| QA 항목 | 증상 | 후보 수정 방향 |
|---------|------|----------------|
| DC 비교 | "DC1과 DC2 어느 데이터센터 부하 높아"가 `monitoring-location-load-balance`에 미진입 | location/DC group 비교 표현을 load-balance evidence provider로 확장 |
| 운영 우선순위 | "지금 당장 조치 시급한 서버 순위"가 일반 대화로 빠져 수치 hallucination 발생 | snapshot/risk signal 기반 deterministic ranking 경로 연결 |
| CPU 위험 수준 | "api-was-dc1-01 CPU 언제 위험 수준 도달해"가 capacity forecast에 미진입 | "위험 수준 도달"을 임계치 기반 capacity forecast 표현으로 해석 |

**판단**: Supabase/DB 변경 없이 regex/routing/evidence provider 표면에서 처리했다. 단, 문장별 패턴 누적은 장기 해법이 아니므로 H-5 구조 개선을 별도 후속으로 둔다.

**테스트 시나리오**:
- [x] `load-balance-capacity-evidence-provider.test`: DC1/DC2 데이터센터 비교 표현이 `monitoring-location-load-balance`로 resolve
- [x] `current-metrics-evidence-provider.test`: "조치 시급한 서버 순위"가 deterministic server-health action-needed 답변으로 resolve
- [x] `supervisor-domain-evidence.test`: 위 3개 QA 문장이 supervisor evidence support에서 deterministic provider로 resolve
- [x] `entity-extractor.test`: CPU "위험 수준 도달"이 `capacity_forecast` semantic frame으로 보정
- [x] `chat-artifact-intent.test`: CPU "위험 수준 도달" capacity forecast가 artifact path로 빠지지 않음

**검증**:
- [x] Root targeted `test:node` 26/26 PASS
- [x] Root `test:quick`, `type-check`, `lint`, `test:contract` PASS
- [x] AI Engine targeted 82/82 PASS
- [x] AI Engine `type-check`, full `test` 1410/1410 PASS
- [x] `git diff --check` PASS
- [x] v8.12.9 release/tag pipeline `2546072069` success, Cloud Run `ai-engine-00511-2s9` 100% traffic, production `/api/version` 및 AI Engine `/health` 8.12.9 확인
- [x] `QA-20260522-0563` targeted production QA 3/3 PASS: DC2 missing snapshot 안내, action-needed deterministic ranking, CPU danger-level capacity forecast duplicate label 제거

### H-5: Semantic router v2 / monitoring evidence fail-closed 후속

**Status**: Released (v8.12.10) + production QA 완료.

**근거**: H-3/H-4에서 확인된 공통 원인은 개별 문장 표현이 아니라 `intentFrame trust gap`이다. LLM 또는 local semantic frame이 의도를 맞혀도 최종 provider 선택이 raw regex miss에 좌우되면 OTel 없는 일반 LLM 응답으로 빠져 수치 hallucination이 발생한다.

```text
사용자 문장
  -> 정규화/슬롯 추출(server, metric, threshold, timeWindow)
  -> intentFrame(capabilityId, intent, scope, aggregation)
  -> evidence provider 선택
  -> monitoring 수치 근거 없으면 수치 답변 금지
```

### 계약 (Contract)

#### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| Runtime contract | `cloud-run/ai-engine/src/core/assistant-runtime/types.ts` |
| Monitoring capability metadata | `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts` |
| Evidence resolution/fail-closed | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.ts` |
| Stream deterministic policy | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`, `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent-stream.ts` |
| Regression tests | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.test.ts`, 필요 시 domain wiring/stream tests |

#### 입출력 계약

| 조건 | 입력 | 기대 출력 |
|------|------|-----------|
| Evidence-required capability + high-confidence semantic frame | `intentFrame.domainId='openmanager-monitoring'`, `confidence >= 0.8`, `capability.metadata.evidenceRequired=true` | matching provider가 valid evidence를 반환하면 기존 deterministic answer 유지 |
| Evidence-required capability + high-confidence semantic frame + provider miss | 예: `monitoring.metric_current`인데 unsupported metric/slot으로 provider가 evidence를 만들 수 없음 | 일반 LLM stream으로 넘기지 않고 deterministic fail-closed 답변 반환 |
| Low-confidence semantic frame | `confidence < 0.8` | 기존 raw regex/provider fallback 유지. provider miss 시 일반 path 허용 |
| Evidence-required가 아닌 capability | anomaly/failure-risk처럼 Analyst tool path가 필요한 capability | provider miss만으로 fail-closed하지 않음 |
| Semantic trace | provider success/fail-closed 모두 `semanticQueryTrace` 반환 | success는 `evidenceAvailable=true`, fail-closed는 `evidenceAvailable=false`, `clarificationRequired=true`, reasonCodes에 `semantic_frame_provider_miss`, `semantic_frame_fail_closed` 포함 |

#### 정책 계약

- `DomainCapability.metadata.evidenceRequired === true`인 capability만 fail-closed 대상이다.
- confidence threshold는 기존 semantic routing 기준과 같은 `0.8`을 사용한다.
- fail-closed 응답은 수치/순위/예측값을 새로 만들지 않는다.
- fail-closed 응답은 사용자가 다시 질의할 수 있도록 필요한 slot(`server`, `metric`, `timeWindow`, `threshold`, `topN`)을 짧게 안내한다.
- Supabase/DB, Redis, live LLM 추가 호출 없이 Cloud Run runtime 내부에서 처리한다.
- raw regex fallback은 삭제하지 않는다. 단, high-confidence semantic frame이 evidence-required capability를 가리킨 경우 provider miss가 LLM hallucination으로 이어지지 않게 차단한다.

#### 테스트 시나리오

- [x] high-confidence `monitoring.metric_current` frame이 unsupported metric을 담으면 `monitoring-evidence-unavailable` fail-closed evidence를 반환한다.
- [x] fail-closed evidence는 `responsePolicy='deterministic_fail_closed'`, `evidenceAvailable=false`, `clarificationRequired=true` trace를 포함한다.
- [x] low-confidence evidence-required frame은 fail-closed하지 않고 기존 fallback path를 유지한다.
- [x] evidence-required가 아닌 `monitoring.anomaly_detection` frame은 provider miss만으로 fail-closed하지 않는다.
- [x] 기존 H-4 seed(DC comparison/action-needed/danger-level forecast)는 계속 deterministic evidence provider로 resolve된다.

**수용 기준**:
- H-5 targeted tests PASS
- AI Engine `type-check` 및 관련 targeted tests PASS
- root 영향이 있으면 `test:contract` 또는 관련 root targeted tests PASS
- Free Tier 영향 없음: DB/Redis/LLM 추가 호출 없음

**다음 단계**:
- [x] SDD 계약 작성: intentFrame → capability routing 우선순위, confidence 기준, fail-closed 응답 계약
- [x] failing regression seed corpus 구성 및 `test(spec):` 커밋 (`6efd2a474`)
- [x] 구현: capability metadata + supervisor fail-closed response policy
- [x] targeted/full validation 완료: H-5 targeted 31/31 PASS, domain wiring/stream/domain-pack targeted 58/58 PASS, AI Engine full 1414/1414 PASS, root `test:contract` PASS, docs checks PASS
- [x] 배포 및 production QA 완료: v8.12.10 GitLab pipeline `2546194670`, Cloud Run `/health` 8.12.10, `QA-20260522-0564` direct Cloud Run fail-closed smoke PASS

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
- [x] `supervisor-prompt.test` / `analyst.test`: backup 서버 디스크 분석 지침에 binlog/dump/incremental backup 근거 포함 확인
- [ ] KRL smoke: "db 서버 디스크 증가 원인" 쿼리의 top result에 backup/binlog 관련 항목 포함

**우선순위**: P2
**SDD 게이트**: prompt/instruction 변경은 failing test 선행 커밋 후 구현한다. KB seed 변경으로 확장할 때는 `rag:analyze` governance 확인 후 진행한다.

- [x] 서버 역할별 원인 분석 prompt/instruction 힌트 설계
- [x] supervisor-prompt와 Analyst instruction에 역할 힌트 섹션 추가
- [ ] 필요 시 KRL seed 항목 설계 및 `supabase:rag:smoke` 갱신
- [ ] prompt-only 변경으로 `rag:analyze` governance 미실행. KB seed 변경 시 실행

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

## Task J: 포트폴리오 standalone 운영 질의 회귀 고정

**근거**: 2026-05-24 세션 메모리 확장 판단에서 포트폴리오 목표는 장기 사용자 기억보다 독립 질의 정확도라고 정리했다. 따라서 다음 단계는 Supabase/Cloud Run 스펙을 늘리는 것이 아니라, 핵심 데모 질의가 세션 기억 없이도 deterministic evidence 경로를 유지하도록 local regression을 고정하는 것이다.

**대상 질의**:
- `현재 서버 전체 상태를 요약해줘`
- `현재 정상 범위인 서버 목록 보여줘`
- `지금 부하가 가장 낮은 서버는?`
- `web-server-01 상태를 자세히 알려줘`
- `지금 당장 조치가 필요한 서버가 있어?`

**계약**:
- 각 질의는 DB 기반 장기 세션 메모리 없이 단일 request snapshot으로 답할 수 있어야 한다.
- 정상 범위/최저 부하/조치 필요 질의는 일반 대화나 hallucinated 숫자로 빠지지 않고 deterministic monitoring evidence를 반환해야 한다.
- 테스트는 live LLM, Supabase, Cloud Run production 호출 없이 로컬 deterministic provider만 사용한다.

**상태**: Completed locally (2026-05-24). Task E를 보류한 대신 바로 착수한 다음 단계로, live LLM/DB 호출 없이 local deterministic evidence regression을 추가했다.

- [x] 포트폴리오 핵심 standalone 질의 local regression 추가 (`portfolio-demo-evidence.test.ts`)
- [x] AI Engine targeted test 실행: 1 file / 5 tests PASS
- [ ] 필요 시 production targeted QA는 후속 release-facing 변경 때만 수행

---

## 실행 우선순위

| Task | 우선순위 | 상태 | 예상 소요 | 마감 기준 |
|------|:------:|------|:---------:|-----------|
| **J: 포트폴리오 standalone 운영 질의 회귀 고정** | 🔴 High | Completed locally | 완료 | DB/스펙 증설 없이 핵심 데모 질의 deterministic evidence 유지 |
| A: grounded KRL production QA | 🟡 조건부 | 부분 완료, 추가 호출 보류 | 변경 시 15~30분 | KRL runtime 변경 시 |
| B: Redis R-5 완결 | 🟡 사용자 액션 | 접근 권한 대기 | 접근 후 15분 | dashboard/API 가능 시 |
| C: KRL corpus 보강 | — | No-op | 0분 | coverage FAIL 발생 시 재개 |
| F: Z.AI 안정성 관찰 | 🟢 완료 | Completed | 완료 | provider-attributed ERROR 0건, Reporter primary 유지 |
| G: AZ 집계·Top-N 추세 grounding | 🔴 High | Released (v8.12.5) | 60~90분 | production QA 회귀 수정 |
| H: Evidence Provider 라우팅·응답 품질 | 🟡 P2 | Released (v8.12.7) + H-4 Tracking | 조건부 | QA-0562 residual: DC 비교, 운영 우선순위, CPU 위험 수준 표현 |
| **I-1: 서버 1:1 비교 쿼리 경로** | 🔴 **P1** | **Released (v8.12.6)** | 완료 | `710c6165d` failing test 선행, AI Engine type-check/full test PASS |
| **I-2: 심층 분석 도메인 특성 주입** | 🟡 P2 | Released (v8.12.6) | 완료 | prompt/instruction 힌트 반영 |
| **I-3: Reporter 기준 명시** | 🟢 P3 | **Released (v8.12.6)** | 완료 | Reporter UI/다운로드 기준 구분 반영 |
| D: intentFrame 신뢰도 측정 | 🟡 조건부 | 보류 | 필요 시 30분 | routing 증상 재현 시 |
| E: 세션 메모리 확장 | 🟢 Low | Portfolio-deferred | 재개 시 2~3시간 | 장기 follow-up이 portfolio blocker가 될 때만 |

---

## 완료 기준

- Task A 추가 QA, Task B 실측, Task D 측정은 조건 충족 시만 수행한다.
- Task C는 현재 no-op으로 닫고, 재개 조건 발생 전까지 DB/seed 변경을 금지한다.
- Task F는 2026-05-24 final 관찰로 완료. latency는 별도 QA rollup에서 관찰한다.
- Task E는 portfolio-deferred로 유지한다. 재개 조건 충족 전까지 Supabase migration/RPC/Cloud Run owner propagation을 구현하지 않는다.
- Task G는 Released 상태다. 같은 증상이 재현될 때만 새 회귀 테스트로 재개한다.
- Task H는 H-1/H-2 v8.12.6 배포 완료, H-3 v8.12.7 배포 완료 상태다. QA-0562에서 확인된 H-4 후보는 구현 여부를 별도 판단하고, 착수 시 failing regression test를 먼저 추가한다.
- Task H-5는 v8.12.10 배포와 `QA-20260522-0564` production QA로 완료 처리한다.
- Task I-1은 v8.12.6 배포 완료 상태로 유지하고, 서버 비교 쿼리 수치 오류 재현 시 새 회귀 테스트로 재개한다.
- Task I-2는 prompt/instruction 힌트는 v8.12.6 배포 완료. KRL seed 변경으로 확장할 때만 `rag:analyze` governance PASS를 검증한다.
- Task I-3은 v8.12.6 배포 완료. 레이블/텍스트 변경 수준이므로 추가 SDD 게이트는 없다.
- Task J는 추가 DB/LLM/live QA 없이 local deterministic evidence regression으로 시작한다. production live QA는 release-facing 변경이 생길 때만 1회 targeted로 수행한다.

---

## 연관 계획서

- [archive/provider-quota-rebalance-plan.md](archive/provider-quota-rebalance-plan.md) — Q0~Q3 완료
- [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) — KRL canonical화, GraphRAG 제거
- [archive/ai-assistant-design-cleanup-plan.md](archive/ai-assistant-design-cleanup-plan.md) — Task 1-C~3-D 완료
- [redis-usage-cleanup-plan.md](redis-usage-cleanup-plan.md) — R-5 미완 (→ Task B)
- [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) — bundlemon 관찰 중
