# AI 도구 표준 가이드

> 멀티 에이전트 도구 사용 원칙과 협업 규칙 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-21
> Canonical: docs/guides/ai/ai-standards.md
> Tags: ai,standards,tooling,policy
>
> **통합 문서**: ai-coding-standards.md + ai-usage-guidelines.md
> **최종 갱신**: 2026-02-21 (v8.1.0)
>
> **Note**: Qwen 제거 (2026-01-07) - 평균 201초 응답, 13.3% 실패율로 2-AI 단순화

---

## Policy SSOT

- 멀티 에이전트 공통 운영 정책의 SSOT는 루트 `AGENTS.md`입니다.
- 이 문서는 도구 사용 가이드/운영 팁에 집중합니다.
- 공통 정책과 충돌 시 `AGENTS.md`를 우선 적용합니다.

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
- **[중요 분리] 개발 환경(Claude Code, Cursor 등 AI 코딩 도구)은 유료 자원을 활용하되, 배포되어 동작하는 프로덕션(실 서비스) 환경은 100% 무료 티어(₩0)로 운영함을 엄격히 분리하여 인지한다.**
- 인프라 비용 관련 무료 한도 초과 구성/테스트 생성 **절대 금지**
- Vercel: Pro 플랜이지만 최소 사용량 유지 (Build Machine: Standard만)
- Cloud Run: 1 vCPU, 512Mi, `--machine-type` 옵션 사용 금지
- Cloud Build: `e2-medium` 기본값만 (120분/일 무료)
- "최적화" ≠ 스펙 업그레이드. 캐시/병렬화/코드 개선으로 해결

### 원칙 2: 클라우드 배포 인지 개발
- 배포 대상: Vercel (Frontend) + Cloud Run (AI Engine) + Supabase + Redis
- 로컬 개발과 프로덕션 환경 차이를 항상 인지
- 환경변수 동기화 필수 (`.env.local` ↔ Vercel ↔ GCP Secret Manager)
- API health check로 배포 후 검증: `/api/health`, `/health`

### 원칙 3: Pre-generated OTel 데이터 SSOT
- 실제 서버 모니터링 대신 사전 생성된 시뮬레이션 데이터 사용
- **15개 서버 × 24시간 × 10분 간격** = `public/data/otel-data/hourly/hour-XX.json`
- 데이터 로더: `src/data/otel-data/index.ts`
- Vercel 소비: `src/services/metrics/MetricsProvider.ts`
- AI Engine 소비: `cloud-run/ai-engine/src/data/precomputed-state.ts`
- 메트릭 수정 시 **Dashboard + AI 응답 양쪽 확인** 필수

### 원칙 4: 테스트 전략 (무료 티어 사수 및 E2E 축소)
- 프론트엔드/백엔드 검증은 **MSW(Mock Service Worker)/Vitest 계약 검증 위주**로 진행
- AI/Cloud-heavy 실추론 기반의 자동화 E2E는 **기본 비활성화** (Pull Request 단계 실행 금지)
- AI 응답은 스트림 이벤트, 구조(JSON Schema), 상태 전이 중심의 **계약 테스트(Contract Testing)** 도입
- 수동/야간 스모크 테스트 등 최소한의 단위에서만 실제 외부 서비스(Supabase, Cloud Run, LLM) 연결 허용

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

| AI 도구 | 일일 한도 | 분당 한도 | 비용 |
|---------|-----------|-----------|------|
| **Codex** | 30-150 메시지/5시간 | - | Plus $20/월 |
| **Gemini** | 1,000 RPD | 60 RPM | 무료 |

### 한도 초과 시 폴백
1. Codex → Gemini → Claude
2. Gemini → Codex → Claude

---

## Related Documents

- [Vibe Coding README](../../vibe-coding/README.md)
- [Vibe Coding Workflows](../../vibe-coding/workflows.md)
- [AI Tools](../../vibe-coding/multi-agent-tools.md)

---

**이전 문서** (archived):
- `ai-coding-standards.md` → 이 문서로 통합
- `ai-usage-guidelines.md` → 이 문서로 통합
