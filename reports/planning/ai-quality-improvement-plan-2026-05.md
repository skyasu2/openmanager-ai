> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-05-21
> Tags: ai,krl,session-memory,intentframe,quality,z.ai

# AI 품질 개선 계획 (2026-05 이후)

**작성 배경**: v8.11.192 기준 AI 어시스턴트 설계 상태 분석(2026-05-21)에서 도출한 차기 개선 항목.
이전 Q0~Q3(quota rebalance), Task 1-C~3-D(design cleanup), KRL canonical화 등은 모두 아카이브 완료.
이 계획은 **현재 잔존하는 실질 품질 격차**를 대상으로 한다.

**전제 제약**:
- Free Tier 한도: Upstash 500K 커맨드/월, Supabase Free Tier, Groq RPD 1,000
- KB hard max: 64건 (현재 60건 → 여유 4건)
- Cloud Run: 1 vCPU, 512Mi

---

## 현황 스냅샷 (v8.11.192, 2026-05-21)

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| KRL grounded synthesis | v8.11.191~192 신규 도입, v8.11.192 OTel criteria production QA 완료 | 잔여 QA 시나리오 완료 |
| KB corpus | 60건 (hard max 64) | 우선순위 카테고리 보강 |
| 세션 메모리 | session-memory.ts 71줄, 최대 20메시지 | Supabase 기반 지속 (P3) |
| Z.AI 안정성 | Reporter primary 편입 5일차 | 안정성 관찰 게이트 통과 |
| intentFrame 신뢰도 | 0.8 임계값, 실제 적중률 미측정 | 실측 후 임계값 교정 |
| Redis R-5 | 예산 초안 완료, 실측 보정 대기 | Upstash 대시보드 확인 |
| bundlemon | warn-first 관찰 중 (2026-05-30 마일스톤) | blocking 승격 여부 결정 |

---

## Task A: grounded KRL production QA (🔴 즉시)

**근거**: v8.11.191(`feat(ai): grounded LLM synthesis for direct KRL knowledge path`)과
v8.11.192(`fix(ai): keep otel criteria in grounded krl answers`)는 FORCE_KB_QUERY_PATTERN
경로 전체를 변경했다. unit test 5개가 추가됐으나 production end-to-end QA가 없다.

**대상 시나리오**:
1. `명령어 알려줘` / `스크립트 보여줘` 류 → grounded LLM synthesis 경로 확인
2. OTel criteria(cpu/memory/disk 임계값) 포함 KRL 답변 반환 확인
3. KB 검색 실패 시 template fallback 동작 확인
4. `groundingMode: llm-synthesized` vs `template-fallback` 메타데이터 반환 확인

**수용 기준**:
- Vercel production 대상 Playwright MCP QA 4개 시나리오 PASS
- `groundingMode` 메타데이터 응답에 포함 확인
- OTel 기반 수치(임계값, 서버 상태)가 KRL 답변 안에 보존됨 확인

**2026-05-21 진행 상태**:
- 완료: `QA-20260521-0547`에서 v8.11.192 production 대상 OTel criteria UI QA 통과.
  - `/api/version=8.11.192`, Cloud Run AI Engine health `8.11.192`.
  - Dashboard 18대 OTel summary와 AI KRL/OTel 답변의 `P0/P1/P3/P99` 기준 포함 확인.
  - Playwright MCP 프로필 잠금으로 기존 세션을 종료하지 않고 isolated Playwright로 동일 production URL을 검증.
- 잔여: command/script, KB 실패 fallback, `groundingMode` 메타데이터 직접 확인 시나리오.

**예상 소요**: 30분 (QA 실행 + 기록)

- [x] OTel criteria production UI QA 실행
- [x] `npm run qa:record` 로 결과 기록 (`QA-20260521-0547`)
- [ ] command/script 시나리오 Playwright MCP QA 실행
- [ ] KB 실패 fallback 시나리오 확인
- [ ] `groundingMode` 메타데이터 확인
- [ ] 회귀 발견 시 즉시 hotfix 커밋

---

## Task B: Redis R-5 완결 (🟡 간단)

**근거**: `redis-usage-cleanup-plan.md` R-5 체크리스트에 실측 보정 항목이 미완 상태.

**작업**:
- Upstash 대시보드 접속 → 일간/월간 커맨드 소비 실측치 확인
- `docs/reference/architecture/infrastructure/redis-usage.md` 내 예산 섹션 수치 보정
- redis-usage-cleanup-plan.md R-5 `[x]` 체크 완료 후 archive 이동 판단

**수용 기준**:
- 실측 커맨드 소비량 기록됨
- 문서 예상치와 실측치 간 괴리가 20% 초과 시 소비원 재분석

**예상 소요**: 15분

- [ ] Upstash 대시보드 소비 확인
- [ ] redis-usage.md 수치 보정
- [ ] redis-usage-cleanup-plan.md R-5 최종 체크
- [ ] 모든 Task 완료 시 plan 파일 archive 이동

---

## Task C: KRL corpus 보강 (🟠 중간)

**근거**: 현재 KB 60건(`architecture=5`, `command=25`, `incident=9`, `best_practice=9`, `security=1`).
hard max 64 기준 4건 추가 여지. `security` 카테고리가 1건으로 지나치게 얕다.

**우선 보강 대상** (hard max 64 엄수, 초과 시 rollback):
- `security` 카테고리: +2건 (보안 강화 절차, 접근 제어 점검 명령어)
- `incident` 카테고리: +2건 (스토리지 장애 대응, 네트워크 지연 RCA 시나리오)

**작업 순서**:
1. `npm run rag:analyze` → 현재 60건, 관계 참조 0건 확인
2. seed SQL 작성 → `supabase/seeds/kb-security-incident.sql`
3. `npx supabase db push` 또는 직접 SQL 실행
4. `npm run rag:analyze` → 64건 이하 확인
5. `npm run supabase:rag:smoke` → 16/16 PASS 확인

**SDD 게이트**: corpus 변경은 SQL seed 파일이 구현체. 별도 failing test 불필요(smoke로 대체).

**수용 기준**:
- KB 총계 ≤ 64건
- `npm run supabase:rag:smoke` 16/16 PASS
- 신규 security/incident 항목이 smoke 쿼리에서 top result로 반환

**예상 소요**: 45분

- [ ] `npm run rag:analyze` 현재 상태 확인
- [ ] seed SQL 작성 (security ×2, incident ×2)
- [ ] Supabase 적용
- [ ] smoke 검증 (16/16 PASS)
- [ ] `npm run qa:record` 기록

---

## Task D: intentFrame 신뢰도 실측 (🟡 관찰)

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

**수용 기준**:
- 10회 샘플에서 confidence 분포 기록
- 0.8 임계값 적합성 판단 보고서 (유지/하향/상향)
- 임계값 변경이 필요한 경우 별도 핫픽스로 처리

**예상 소요**: 30분 (관찰) + 필요시 30분 (임계값 조정)

- [ ] Langfuse 또는 로컬 dev 서버로 10회 쿼리 confidence 샘플링
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

**판단 기준**:
- 7일 연속 Z.AI 실패율 < 5% → 안정 판정, 이 Task 완료
- 실패율 ≥ 5% → Reporter primary를 Mistral로 복귀하는 hotfix

**예상 소요**: 관찰만 (코드 작업 없음)

- [ ] 7일 관찰 완료 (마감: 2026-05-23)
- [ ] 안정/불안정 판정 기록
- [ ] 불안정 시 reporter provider order 복귀 hotfix

---

## 실행 우선순위

| Task | 우선순위 | 상태 | 예상 소요 | 마감 기준 |
|------|:------:|------|:---------:|-----------|
| A: grounded KRL production QA | 🔴 즉시 | Draft | 30분 | v8.11.192 이후 즉시 |
| B: Redis R-5 완결 | 🟡 쉬움 | Draft | 15분 | 언제든 |
| C: KRL corpus 보강 | 🟠 중간 | Draft | 45분 | 이번 주 내 |
| F: Z.AI 안정성 관찰 | 🟡 추적 | Draft | 관찰 | 마감: 2026-05-23 |
| D: intentFrame 신뢰도 측정 | 🟡 관찰 | Draft | 30분 | A/C 완료 후 |
| E: 세션 메모리 확장 | 🟢 중장기 | Draft | 2~3시간 | Backlog |

---

## 완료 기준

모든 Task A~D가 완료되면 이 계획서를 `archive/`로 이동한다.
Task E는 완료 시 별도 TODO.md 항목으로 격상하거나 완료 처리한다.

---

## 연관 계획서

- [archive/provider-quota-rebalance-plan.md](archive/provider-quota-rebalance-plan.md) — Q0~Q3 완료
- [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) — KRL canonical화, GraphRAG 제거
- [archive/ai-assistant-design-cleanup-plan.md](archive/ai-assistant-design-cleanup-plan.md) — Task 1-C~3-D 완료
- [redis-usage-cleanup-plan.md](redis-usage-cleanup-plan.md) — R-5 미완 (→ Task B)
- [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) — bundlemon 관찰 중
