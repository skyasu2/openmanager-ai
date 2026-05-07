# AI 도구 표준 가이드

> 멀티 에이전트 도구 사용 원칙과 협업 규칙 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: docs/guides/ai/ai-standards.md
> Tags: ai,standards,tooling,policy
>
> **통합 문서**: ai-coding-standards.md + ai-usage-guidelines.md
> **최종 갱신**: 2026-05-07 (test methodology SSOT alignment)
>
> **Note**: Qwen 제거 (2026-01-07) - 평균 201초 응답, 13.3% 실패율로 2-AI 단순화

---

## Policy SSOT

- 멀티 에이전트 공통 운영 정책의 SSOT는 `docs/guides/ai/ai-standards.md`입니다.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`는 각 에이전트의 실행 규칙/환경 규칙만 다룹니다.
- 공통 정책과 에이전트 전용 문서가 충돌하면 이 문서를 우선 적용합니다.

## Quick Reference

```bash
# 3-CLI 협업 개발 (브리지)
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "실무 검증"
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "아키텍처 분석"
bash scripts/ai/agent-bridge.sh --to claude --mode doc --save-auto "결과 문서화"

# 집계가 필요하면 Codex 결과를 기준으로 카운트
```

---

## 0. 프로젝트 3대 원칙 (모든 에이전트 필독)

> 이 원칙은 Claude Code 운영 메모리에서 추출한 교차 에이전트 공유 지식입니다.

### 원칙 1: Free Tier 절대 원칙 (운영/배포 환경 한정)
- **[중요 분리] 개발 환경(Claude Code, Cursor 등 AI 코딩 도구)은 유료 자원을 활용하되, 배포되어 동작하는 프로덕션(실 서비스) 환경은 `Vercel Pro`를 제외하면 무료 티어(또는 무료 티어 상당 사용량)로 운영함을 엄격히 인지한다.**
- 인프라 비용 관련 무료 한도 초과 구성/테스트 생성 **절대 금지**
- Vercel: **유일한 유료 예외**로 Pro 허용. 단, Pro 기능은 **정말 필요할 때만 제한적으로 사용**하고, 기본 설계/운영 사용량은 **무료 티어 수준**을 유지
- Vercel Free로 내려가도 **핵심 경로(로그인, 대시보드, 기본 AI 질의)** 는 동작해야 하며, 악화가 허용되는 것은 **대기시간/빌드 여유/운영 편의성** 정도로 제한
- Vercel Build: Standard만, Turbo/고비용 빌드 구성 금지
- 실환경 QA/배포 후에는 Vercel 사용량(빌드/함수/대역폭)을 점검해 **추가 비용 발생 징후가 없는지 확인**
- QA/실환경 테스트 중 문제가 발생해 Pro 기능이나 한도를 더 쓰고 싶어질 때도, **먼저 Vercel Usage와 비용 영향부터 점검**하고 그 다음에만 예외 사용 여부를 판단
- Cloud Run: 1 vCPU, 512Mi
- Cloud Build: 기본 머신/기본 풀만 사용, 커스텀 `machineType`/`--machine-type` 금지
- Google Cloud Free Tier는 단일 통합 크레딧 풀이 아니라 billing account 단위로 서비스별 한도가 적용된다. Cloud Run, Cloud Tasks, Cloud Build, Artifact Registry, Secret Manager는 과금 단위가 다르지만 초과분은 같은 billing account에 합산되므로 GCP 월간 예산으로 함께 감시한다.
- "최적화" ≠ 스펙 업그레이드. 캐시/병렬화/코드 개선으로 해결

#### 원칙 1-1: 개발비와 배포비를 먼저 분리한다
- 개발 환경 비용(Claude/ChatGPT/Gemini 구독, Codex/MCP, 로컬 리서치, 개발용 AI 호출)은 **개발 생산성 비용**으로 보고 배포 비용과 분리해 판단한다.
- **인증 방식의 차이**: 로컬 개발 도구(Gemini CLI 등)는 **사용자 메일 계정 인증(Google Auth)**을 기반으로 개발 효율을 극대화하며, 배포 환경(Vision Agent 등)은 **Service Account / API Key**를 기반으로 운영된다.
- **AI 운영 전략**: 개발 도구는 품질과 속도를 우선하여 최신 고성능 모델을 자유롭게 활용하되, 배포 환경은 **무료 티어 한도(Free Tier)**를 엄격히 준수하도록 최적화된 모델(예: Gemini Flash 등)과 호출 로직을 사용한다.
- AI 에이전트는 어떤 제안이든 먼저 `개발비 영향`인지 `배포비 영향`인지 분류한 뒤 판단한다.
- `개발비 영향`이면 품질과 속도를 우선하고, `배포비 영향`이면 사용량/무료 한도/추가 과금 가능성을 먼저 확인한다.
- 판단이 애매하면 개발 도구 사용은 허용하고, 배포 스펙 증설은 보수적으로 거부하는 방향을 기본값으로 삼는다.

### 원칙 2: 클라우드 배포 인지 개발
- 배포 대상: Vercel (Frontend) + Cloud Run (AI Engine) + Supabase + Redis
- 로컬 개발과 프로덕션 환경 차이를 항상 인지
- 환경변수 동기화 필수 (`.env.local` ↔ Vercel ↔ GCP Secret Manager)
- API health check로 배포 후 검증: `/api/health`, `/health`

### 원칙 2-1: 저장소 토폴로지와 배포 권위
- **정본(canonical) 개발 저장소는 GitLab private remote (`gitlab`)** 입니다. 전체 이력, 테스트, 문서, QA 기록, 에이전트 규칙은 GitLab 기준으로 유지합니다.
- **Frontend production 배포 권한은 GitLab CI `deploy` job** 이 가집니다. `git push gitlab main`은 validate 전용이고, 실제 production deploy는 `git push --follow-tags gitlab main`으로 생성된 semver tag pipeline에서 실행됩니다. `deploy` job은 `vercel build --prod` + `vercel deploy --prebuilt --prod`로 배포합니다.
- **CI quota 소진 또는 WSL2 로컬 빌드 실패 시 긴급 fallback**: `vercel --prod` (소스 업로드 방식). `vercel build --prod`는 WSL2 환경에서 `fonts.gstatic.com` 네트워크 차단으로 Turbopack 빌드가 실패할 수 있으므로, CI 없이 직접 배포가 필요한 경우 `vercel --prod`를 사용합니다. **이는 CI 게이트를 우회하므로 예외적 상황에만 적용합니다.**
- **Vercel Git Integration은 해제** 되어 있습니다. Frontend 자동 배포의 권위 있는 경로는 GitLab CI 파이프라인뿐입니다.
- **GitLab CI는 활성** 상태이며, `.gitlab-ci.yml`은 branch/main validate 파이프라인과 semver tag deploy/smoke 파이프라인으로 분리되어 있습니다. docs/reports 전용 push는 `changes` 규칙으로 스킵합니다.
- **GitHub public remote의 기본 이름은 `github-public`** 입니다. 공개용 frontend-focused snapshot 으로만 취급하며, Vercel에 노출되는 프론트엔드와 공개 자산만 공유합니다. `origin`은 legacy fallback 으로만 허용합니다.
- 현재 GitHub public repo는 **frontend-focused 최소 공개 이력만 유지**합니다. canonical full history, Cloud Run AI 엔진, 내부 QA/운영 자산은 공개하지 않으며, release/tag 권위도 갖지 않습니다.
- 현재 GitHub public repo는 **releases/tags가 없고, issues/wiki/projects가 비활성화**된 상태를 기본 운영값으로 봅니다. 즉 협업 허브가 아니라 읽기/분석용 코드 공개면입니다.
- 따라서 AI 에이전트는 **`github-public/main` 또는 `origin/main`이 canonical branch라고 가정하면 안 됩니다.** push/fetch/rebase 전에 항상 `git remote -v`로 원격 구성을 먼저 확인합니다.
- 기본 push 대상은 `gitlab` 입니다. GitHub 공개 동기화는 **명시적 요청이 있을 때만**, 가능하면 별도 worktree/임시 저장소에서 수행합니다.
- `git push gitlab ...` 이후에는, `GITLAB_TOKEN`이 환경변수 또는 `.env.local`에 있으면 `npm run gitlab:pipeline:head -- --wait`로 **방금 pushed SHA 기준 GitLab pipeline** 을 확인하고 최종 보고에 `pipeline id/status/url`를 포함합니다. `status=not_created`면 docs/reports 전용 변경처럼 **해당 SHA에 pipeline이 생성되지 않았음**을 명시합니다.
- **로컬 전체 검증 표준 경로는 계속 `npm run ci:local:docker`** 입니다. broad change, release 전, 배포 민감 변경에서는 GitLab CI와 별도로 로컬 컨테이너 검증을 추가합니다.
- 표준 배포/공개 순서는 아래와 같습니다.
  - Frontend/AI Engine validate: `git push gitlab main` → GitLab CI `validate`
  - Frontend/AI Engine production deploy: `git push gitlab --follow-tags` → GitLab CI semver tag `deploy` / `deploy_ai_engine` / `smoke`
  - 공개 코드 snapshot 갱신: `npm run sync:github` (선택)
  - Cloud Run AI Engine 배포: `cloud-run/ai-engine/deploy.sh` (별도 수동 경로)

### 원칙 3: Pre-generated OTel 데이터 SSOT
- 실제 서버 모니터링 대신 사전 생성된 시뮬레이션 데이터 사용
- **18개 서버 × 24시간 × 10분 간격** = `public/data/otel-data/hourly/hour-XX.json`
- 구성 컨셉: 15대 주 서비스 경로와 3대 보조 capacity node를 함께 관측하는 계층형 부하 전파 데이터셋
- 데이터 로더: `src/data/otel-data/index.ts`
- Vercel 소비: `src/services/metrics/MetricsProvider.ts`
- AI Engine 소비: `cloud-run/ai-engine/src/data/precomputed-state.ts`
- 메트릭 수정 시 **Dashboard + AI 응답 양쪽 확인** 필수

### 원칙 4: 테스트 전략 (Risk-Based Local-First + Contract-First)
- 상세 기준의 SSOT는 `docs/guides/testing/test-strategy.md`입니다.
- 프론트엔드/백엔드 검증은 **MSW(Mock Service Worker)/Vitest 계약 검증 위주**로 진행합니다.
- Risk-Based/Pareto 기준으로 AI stream/API 계약, auth/session, OTel 데이터 SSOT, artifact schema, env/deploy boundary, 비용 발생 경로를 우선 검증합니다.
- Pesticide Paradox 방지를 위해 같은 hardcoded happy-path mock을 반복해 신뢰하지 않고, 결함 발견 시 기존 테스트 데이터를 교체하거나 실제 계약 guard로 전환합니다.
- AI/Cloud-heavy 실추론 기반의 자동화 E2E는 **기본 비활성화**하며 Pull Request 단계에서 실행하지 않습니다.
- AI 응답은 스트림 이벤트, 구조(JSON Schema), 상태 전이 중심의 **계약 테스트(Contract Testing)** 로 우선 검증합니다.
- 수동/야간 스모크 테스트 등 최소한의 단위에서만 실제 외부 서비스(Supabase, Cloud Run, LLM) 연결을 허용합니다.
- 테스트 추가로 외부 비용, 실행 시간, CI 부담이 커지면 새 테스트 추가보다 false-pass 테스트 수정/삭제를 우선합니다.

### 원칙 5: 시크릿 보안 및 테스트 무결성 (Secret Management)
- **하드코딩 절대 금지**: 모든 API 키는 반드시 `.env.local` 또는 GCP Secret Manager를 통해 관리하며, 소스 코드(스크립트 포함)에 직접 기재하는 것을 금지한다.
- **파싱 시 따옴표 처리**: `.env` 파일의 값을 파싱할 때 값 양끝의 큰따옴표(`"`)를 반드시 제거하는 코드를 포함해야 한다. (예: `val.replace(/^"|"$/g, '')`)
- **Git 노출 차단**: `.env`, `.env.local`, `.env.test` 등 모든 시크릿 설정 파일은 `.gitignore`에 등록되어야 하며, 이를 위반하는 커밋은 `pre-commit` 단계에서 차단된다.

### 원칙 6: 토큰 절약 및 비용 최적화 (Token Conservation)
- **수동 테스트 제한**: `scripts/*.ts` 로컬 테스트는 **장애 진단 및 설정 변경 시 1회성**으로만 사용하며, 자동화된 루프나 CI 파이프라인에 절대로 포함하지 않는다.
- **최소 출력 토큰(Minimum Tokens)**: 테스트 쿼리는 반드시 `maxOutputTokens`를 최소값(50~150)으로 설정하여 토큰 낭비를 방지한다.
- **Mock 우선**: 로직 검증은 가급적 실제 LLM 호출 대신 MSW(Mock Service Worker)나 Vitest Mock을 활용한다.
- **쿼터 보호 준수**: `GOOGLE_AI_QUOTA_PROTECTION=true` 등 모델별 쿼터 보호 플래그를 상시 활성화한다.

### 원칙 7: 객관성 및 정직성 (Objectivity & Honesty)
- **비아첨 원칙 (No Flattery)**: 사용자의 기분을 맞추기 위한 아첨이나 근거 없는 낙관론을 제시하지 않는다. 항상 전문적인 엔지니어로서 객관적이고 중립적인 태도를 유지한다.
- **사실 기반 답변 (Fact-Based)**: 모든 기술적 제안과 판단은 코드 분석, 데이터, 공식 문서 등 검증 가능한 근거에 기반해야 한다. 추측이나 주관적인 선호도를 사실처럼 전달하지 않는다.
- **정직한 한계 인정 (Transparency)**: 모르는 내용, 구현 불가능한 사항, 또는 잠재적인 위험 요소에 대해 숨기거나 회피하지 않고 솔직하게 답변한다. Hallucination(거짓 정보 생성) 방지를 최우선 가치로 삼는다.
- **합리적 비판 (Constructive Criticism)**: 사용자의 요청이라도 프로젝트의 아키텍처나 보안, 비용(Free Tier) 원칙에 위배된다면 합리적인 근거를 들어 반대 의견을 제시하고 대안을 제안한다.

---

## 1. 핵심 코딩 규칙

모든 AI 도구(Codex, Gemini, Claude Code)가 준수하는 규칙:

### 가독성 (Readability)
- **명확한 네이밍**: `userCount` vs `u` 처럼 의도가 드러나는 이름
- **함수 분리**: 하나의 함수는 "한 가지 일"만 수행
- **스타일 준수**: 프로젝트 컨벤션 일관성 유지

### 간결함 (Simplicity)
- **KISS 원칙**: 과도한 기교보다 단순하고 명료한 구현
- **매직 넘버 제거**: 의미 있는 상수로 대체
- **UX Obsession**: 사용자 경험 최우선

### 유지보수성 (Maintainability)
- **미래 고려**: 확장 가능한 코드 구조
- **SOLID 원칙**: 모듈화, 관심사 분리, 응집도/결합도 고려

### 일관성 (Consistency)
- 팀/프로젝트 단위 네이밍, 주석, 커밋 메시지 규칙 엄수

### 테스트 & 검증
- **테스트 필수**: 핵심 로직 단위 테스트 확보
- **상호 검증**: 3 AI 협업으로 수동 검증 수행
- **개별 에이전트 수동 테스트**: `cloud-run/ai-engine/scripts/` 디렉토리의 전용 스크립트로 검증

| 테스트 대상 | 실행 명령어 (in `cloud-run/ai-engine`) | 검증 항목 |
| :--- | :--- | :--- |
| **Advisor (Cerebras policy primary / Groq fallback)** | `npx ts-node scripts/test-mistral-advisor-local.ts` | 조치 명령어 제안, 스트리밍 응답 |
| **Reporter (Cerebras primary / Groq fallback)** | `npx ts-node scripts/test-groq-reporter-local.ts` | 요약 보고서 작성 품질 |
| **Vision (Gemini)** | `npx ts-node scripts/test-vision-multimodal-fallback.ts` | 이미지 분석, Fallback 메커니즘 |
| **NLQ (Groq Primary / Cerebras Opt-in)** | `npx ts-node scripts/test-cerebras-nlq-local.ts` | `CEREBRAS_MODEL_ID` 기준 SQL 생성 전문성 또는 Groq primary 대비 fallback 동작 |
| **전체 Agent API** | `bash scripts/test-agents-api.sh` | Supervisor 라우팅 및 툴 호출 |

> **주의**: Cerebras 계정별 접근 가능한 모델이 다를 수 있습니다. 로컬 테스트는 `CEREBRAS_MODEL_ID`를 기준으로 수행하고, 일반 인사말보다 SQL 생성이나 코드 분석 같은 기술적 쿼리로 검증하십시오.

---

## 2. TypeScript Strict Mode

### Type-First 원칙
1. **타입 정의 우선**: 구현 전 인터페이스 먼저 작성
2. **No `any`**: `any` 타입 사용 금지, 제네릭 활용
3. **컴파일 체크**: `npm run type-check` 필수

### 기존 코드 분석
- **의존성 파악**: 리팩토링 전 모든 참조 타입/모듈 분석
- **레거시 호환성**: 기존 인터페이스 호환 유지
- **영향도 분석**: 변경 사항 영향 예측 및 문서화

---

## 3. AI 도구별 역할 (Identity)

| AI 도구 | 공통 역할 (Independent Full-Stack) | 협업 시의 고유 강점 (선택적) | 호출 방법 |
|---------|---------|-----------|-----------|
| **Claude Code** | 기획/아키텍처 설계부터 전체 개발 단독 리드 | 복잡한 비즈니스 로직 분석 및 코드베이스 전반의 리팩토링 | `agent-bridge.sh --to claude` |
| **Codex (GPT-5)** | 기획/아키텍처 설계부터 전체 개발 단독 리드 | 막힌 문제의 논리적 돌파, 실험적 기능 구현 | `agent-bridge.sh --to codex` |
| **Gemini** | 기획/아키텍처 설계부터 전체 개발 단독 리드 | 시스템 성능 최적화, 보안 규칙(OWASP) 점검 및 하이브리드 인프라 설계 | `agent-bridge.sh --to gemini` |

- **핵심 원칙:** 세 에이전트는 역할을 쪼개서 분담하는 것이 아니라, **모두가 End-to-End 전체 프로젝트를 리드할 수 있는 독립형 풀스택 엔지니어**로 동작합니다. 자신의 작업은 남에게 넘기지 않고 끝까지 책임집니다.

---

## 4. DO/DON'T

### ✅ 공통 DO
1. **교차 검증 활용** - 중요 결정은 2개 이상 AI로 검증
2. **명확한 컨텍스트** - 목표와 제약사항 명시
3. **실행 및 테스트** - AI 제안은 반드시 실제 검증
4. **한국어 우선** - 기술용어 영어 병기 허용

### ❌ 공통 DON'T
1. **무료 티어 한도 초과** - Codex(30-150/5h), Gemini(1K/day)
2. **맹목적 신뢰** - 검증 없이 적용 금지
3. **컨텍스트 없는 질문** - 환경/목표 미명시 요청

### 도구별 DON'T
- **Codex**: 긴 질문은 분할, 타임아웃 시 간결하게 수정
- **Gemini**: Rate limit 주의 (1K RPD)
- **Claude Code**: 단순 반복 작업은 다른 AI 활용

---

## 5. 무료 티어 한도 관리

### 개발 환경 AI (개발자 구독 — 별개 예산)

| 도구군 | 용도 | 비용 판단 |
|--------|------|-----------|
| **Codex / Claude / ChatGPT** | 구현, 리뷰, 문서화, 리서치 | 개발 생산성 비용 |
| **Gemini** | 리서치, 아키텍처 검토, 보안/성능 분석 | 개발 생산성 비용 |

#### 한도 초과 시 폴백
1. Codex → Gemini → Claude
2. Gemini → Codex → Claude

### 배포 환경 AI/Redis/Queue 의존성 (Production — 무료 티어 엄수)

실제 서비스 경로에서 호출되는 provider, Redis, queue 의존성입니다. 정확한 공급사 한도 수치는 변동 가능하므로, 이 문서에서는 운영 판단 기준만 유지합니다.

| 프로바이더/서비스 | Agent 역할 | 주요 제약 | 위험도 |
|------------------|-----------|----------|--------|
| **Cerebras** | Orchestrator·Analyst·Reporter·Advisor·Verifier short-context runtime, Groq-first agents fallback | 기본 runtime은 `llama3.1-8b`만 사용한다. Qwen 235B Preview는 runtime 후보에서 제외하고 명시적 override/deprecated 감지용 metadata로만 추적한다. 16K/32K context floor 경로는 8K Cerebras runtime을 건너뜀 | ⚠️ |
| **Groq** | Supervisor·NLQ primary, Cerebras-first agents fallback | burst 상황에서 분당 요청 제한과 일일 토큰 한도가 첫 병목이 되기 쉬움 | ⚠️ |
| **Mistral** | Last-resort text fallback | tier 정책 변동성이 있어 배포 전 재확인 필요 | ✅ |
| **Gemini Flash-Lite** | Vision Agent | 이미지/멀티모달 요청의 일일 한도와 RPM을 함께 추적해야 함 | ⚠️ |
| **Upstash Redis** | async Job 상태/진행률/결과, 스트림 저장·재개 인프라·Cache | Job Queue SSE polling, progress update, resumable chunk 수에 따라 명령 수가 빠르게 증가 | ⚠️ |
| **Google Cloud Tasks** | async Job worker dispatch | HTTP task delivery/retry/속도제어만 담당. job 상태와 결과는 Redis가 SSOT이며, Cloud Tasks 단독으로는 응답 복구 불가 | ✅ |

> **핵심 제약**: AI 성능 강화 = API 호출 증가 = 무료 한도 소진.
> 성능 개선은 반드시 **캐싱 강화·응답 재사용·라우팅 최적화** 방향으로만 진행합니다.
> 정확한 운영 기준과 현재 참고 수치는 [free-tier-optimization.md](../../reference/architecture/infrastructure/free-tier-optimization.md)에서 관리합니다.

---

---

## Data Parity Contract (항상 준수)

> **원칙**: 프론트엔드 대시보드가 보여주는 서버 상태와 AI가 분석하는 서버 상태는 반드시 동일한 데이터 슬롯을 참조해야 한다.

### 슬롯 계산 공식 (SSOT)

```
globalSlotIndex = Math.floor(KST_minutes_of_day / 10)   // 0–143
```

| 사이드 | 파일 | 공식 |
|--------|------|------|
| **Frontend** | `src/services/metrics/kst-time.ts` → `getKSTDateTime()` | `Math.floor(minuteOfDay / 10)` |
| **AI Engine** | `cloud-run/ai-engine/src/data/precomputed-state.ts` → `getCurrentSlotIndex()` | `Math.floor(kstMinutes / 10)` |

두 공식은 수학적으로 동일하다. 같은 UTC 시각에 호출하면 항상 같은 `globalSlotIndex`를 반환한다.

### 허용 오차

10분 슬롯 경계(정시 전후)에서 최대 **±1 슬롯** 차이는 허용한다.

### QA 검증 방법

1. **API 확인**: `GET /api/health?service=parity` → `slot.globalSlotIndex` 값 기록
2. **AI 응답 확인**: AI 채팅에서 서버 조회 → tool call `dataSlot.slotIndex` 확인
3. **합격 조건**: `|parity.globalSlotIndex - aiDataSlot.slotIndex| ≤ 1`
4. **UI 확인**: 대시보드 상단의 `HH:MM KST (slot X/143)` 표시와 비교

### 위반 시 체크 포인트

- Cloud Run AI Engine의 KST 시간 계산이 UTC 변환 오류 없는지 확인
- Vercel Serverless Function이 올바른 UTC 시간을 받는지 확인
- `hour-XX.json` 파일이 올바른 시간대로 생성됐는지 확인

---

## Related Documents

- [Vibe Coding README](../../development/vibe-coding/README.md)
- [Vibe Coding Workflows](../../development/vibe-coding/workflows.md)
- [AI Tools](../../development/vibe-coding/multi-agent-tools.md)

---

**이전 문서** (archived):
- `ai-coding-standards.md` → 이 문서로 통합
- `ai-usage-guidelines.md` → 이 문서로 통합
