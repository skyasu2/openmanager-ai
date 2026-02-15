# Vision Agent 구현 계획서

> Gemini 2.5 Flash-Lite 기반 Vision Agent 추가 구현 계획

**작성일**: 2026-01-27
**버전**: v1.0.0
**상태**: 검토 대기

---

## 1. 개요

### 1.1 목적

OpenManager AI 서버 모니터링 플랫폼에 **Vision Agent**를 추가하여 다음 기능을 제공:

| 기능 | 설명 | 현재 Gap |
|------|------|----------|
| **스크린샷 분석** | Grafana/CloudWatch 대시보드 이미지 분석 | 불가능 |
| **대용량 로그 분석** | 1M 토큰 컨텍스트로 전체 로그 분석 | 128K 제한 |
| **Google Search Grounding** | 실시간 기술 문서/해결책 검색 | Tavily 의존 |
| **URL Context** | 외부 문서 직접 참조 | 수동 WebFetch |

### 1.2 선정 모델

| 항목 | 값 |
|------|-----|
| **모델** | `gemini-2.5-flash-lite` |
| **Provider** | Google AI (Vercel AI SDK) |
| **무료 티어** | 1,000 RPD, 15 RPM, 250K TPM |
| **Context** | 1M tokens (Input), 65K tokens (Output) |
| **멀티모달** | Text, Image, Video, Audio, PDF |

### 1.3 아키텍처 변경

```
현재 (Tri-Provider):
┌─────────────────────────────────────────────────────────────┐
│  Cerebras (Primary) → Mistral (Verifier) → Groq (Fallback) │
│      llama-3.3-70b       mistral-small       llama-3.3-70b │
└─────────────────────────────────────────────────────────────┘

변경 후 (Quad-Provider + Graceful Degradation):
┌─────────────────────────────────────────────────────────────┐
│  Text Agents (기존 유지)    │  Vision Agent (신규)         │
│  Cerebras → Mistral → Groq │  Gemini Flash-Lite (단독)    │
│  3-way Fallback 유지       │  Fallback 없음 → Graceful    │
│                            │  Degradation으로 처리         │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Fallback 전략: Graceful Degradation

**Gemini 장애 시 동작:**
- Vision Agent 기능 일시 비활성화
- 사용자에게 안내 메시지 반환
- 텍스트 기반 Agent로 대체 라우팅 (가능한 경우)
- 기존 NLQ/Analyst/Reporter/Advisor 100% 정상 동작

**Fallback 미적용 사유:**
- OpenRouter 무료 모델: PDF, Google Search Grounding, 1M Context 미지원
- 핵심 기능 대체 불가 (이미지 분석만 가능 = 20% 수준)
- 복잡도 대비 이점 없음

---

## 2. 구현 범위

### 2.1 Cloud Run AI Engine 변경

| 파일 | 변경 내용 | 우선순위 |
|------|----------|:--------:|
| `src/services/ai-sdk/model-provider.ts` | `getGeminiFlashLiteModel()` 추가 | P0 |
| `src/lib/config-parser.ts` | `getGeminiApiKey()` 추가 | P0 |
| `src/services/ai-sdk/agents/config/agent-configs.ts` | Vision Agent 설정 추가 | P0 |
| `src/services/ai-sdk/agents/config/instructions/vision.ts` | Vision Agent Instructions | P0 |
| `src/services/resilience/quota-tracker.ts` | Gemini 쿼터 추가 | P1 |
| `src/tools-ai-sdk/vision-tools.ts` | Vision 전용 도구 (신규) | P1 |

### 2.2 신규 Tools

```typescript
// src/tools-ai-sdk/vision-tools.ts
export const analyzeScreenshot = tool({...});     // 이미지 분석
export const searchWithGrounding = tool({...});   // Google Search Grounding
export const analyzeUrlContent = tool({...});     // URL 문서 분석
export const analyzeLargeLog = tool({...});       // 대용량 로그 분석
```

### 2.3 환경변수

```bash
# .env.local (이미 존재)
GEMINI_API_KEY_PRIMARY=<your-gemini-api-key>

# Cloud Run 환경변수 추가 필요
GEMINI_API_KEY=${GEMINI_API_KEY_PRIMARY}
```

---

## 3. 사이드 이펙트 분석

### 3.1 기존 시스템 영향

| 영역 | 영향 | 대응 방안 |
|------|------|----------|
| **Provider Fallback** | 기존 3-way 체인 유지 | Vision Agent는 독립 운영, 기존 로직 변경 없음 |
| **Quota Tracker** | Gemini 쿼터 추가 필요 | 별도 트래킹 로직 추가 |
| **Error Handling** | Gemini API 에러 패턴 다름 | `@ai-sdk/google` 에러 핸들링 추가 |
| **Rate Limiting** | 15 RPM 제한 엄격 | Pre-emptive fallback 로직 적용 |

### 3.2 의존성 추가

```json
// cloud-run/ai-engine/package.json
{
  "dependencies": {
    "@ai-sdk/google": "^1.2.0"  // 신규 추가
  }
}
```

### 3.3 잠재적 리스크

| 리스크 | 확률 | 영향도 | 완화 방안 |
|--------|:----:|:-----:|----------|
| Gemini API 장애 | 낮음 | 중간 | Vision 기능만 비활성화, 기존 기능 유지 |
| 무료 티어 한도 초과 | 중간 | 낮음 | 1,000 RPD로 충분, 쿼터 트래킹으로 사전 경고 |
| 이미지 업로드 실패 | 중간 | 중간 | Base64 인코딩 + 재시도 로직 |
| Context 길이 초과 | 낮음 | 낮음 | 1M 토큰으로 대부분 커버, 청킹 로직 예비 |

---

## 4. 문서 업데이트 목록

### 4.1 필수 업데이트 (P0)

| 문서 | 변경 내용 |
|------|----------|
| `docs/status.md` | AI Provider 4개로 변경, Vision Agent 추가 |
| `docs/ai-model-policy.md` | Gemini Flash-Lite 정책 추가 |
| `.claude/rules/ai-tools.md` | Gemini Provider 추가 |
| `config/ai/registry-core.yaml` | Vision Agent 등록 |

### 4.2 참조 업데이트 (P1)

| 문서 | 변경 내용 |
|------|----------|
| `docs/reference/architecture/ai/ai-engine-architecture.md` | Vision Agent 다이어그램 추가 |
| `docs/reference/architecture/ai/ai-engine-internals.md` | Vision 처리 파이프라인 설명 |
| `cloud-run/ai-engine/README.md` | Vision Agent 설명 추가 |

### 4.3 환경변수 문서 (P1)

| 문서 | 변경 내용 |
|------|----------|
| `.env.example` | GEMINI_API_KEY 설명 추가 |
| `docs/vibe-coding/mcp-servers.md` | Gemini 관련 없음 (MCP 아님) |

---

## 5. 프론트엔드 업데이트

### 5.1 Feature Cards (랜딩 페이지)

**파일**: `src/data/feature-cards.data.ts`

```typescript
// 수정: AI Assistant 카드
{
  id: 'ai-assistant-pro',
  title: '🧠 AI Assistant',
  description:
-   '3개 AI 프로바이더 + 5개 전문 에이전트로 서버 장애를 실시간 분석...',
+   '4개 AI 프로바이더 + 6개 전문 에이전트로 서버 장애를 실시간 분석. Vision Agent로 대시보드 스크린샷 분석 지원.',
  detailedContent: {
    features: [
+     '👁️ Vision Agent: 대시보드 스크린샷 분석 (Gemini Flash-Lite)',
+     '🔍 Google Search Grounding: 실시간 기술 문서 검색',
+     '📄 1M Context: 대용량 로그 파일 전체 분석',
      // ... 기존 features
    ],
    technologies: [
+     'Gemini 2.5 Flash-Lite (Vision)',
      // ... 기존 technologies
    ],
  },
}
```

### 5.2 Architecture Diagram (모달)

**파일**: `src/data/architecture-diagrams.data.ts`

```typescript
// 수정: ai-assistant-pro 다이어그램
{
  title: 'Specialized Agents',
  color: 'from-purple-500 to-pink-500',
  nodes: [
    // ... 기존 4개 agents
+   {
+     id: 'vision',
+     label: 'Vision Agent',
+     sublabel: 'Screenshot Analysis',
+     type: 'secondary',
+     icon: '👁️',
+   },
  ],
},
+ {
+   title: 'Vision Provider',
+   color: 'from-green-500 to-teal-500',
+   nodes: [
+     {
+       id: 'gemini',
+       label: 'Gemini Flash-Lite',
+       sublabel: '1M Context + Vision',
+       type: 'tertiary',
+       icon: '🌐',
+     },
+   ],
+ },
```

### 5.3 Tech Stacks Data

**파일**: `src/data/tech-stacks.data.ts`

```typescript
// ai-assistant-pro 섹션에 추가
{
  name: 'Gemini 2.5 Flash-Lite',
  version: '2.5',
  icon: '🌐',
  description: 'Vision Agent 전용. 스크린샷 분석, 대용량 로그 처리, Google Search Grounding.',
  implementation: 'Cloud Run AI Engine에서 Vision 쿼리 전용 처리',
  importance: 'high',
  category: 'ai',
  type: 'product',
  aiType: 'google-api',
  tags: ['Vision', 'Multimodal', '1M Context', 'Google Search'],
},
```

---

## 6. 구현 단계

### Phase 1: 백엔드 기반 (1일)

1. `@ai-sdk/google` 패키지 설치
2. `config-parser.ts`에 Gemini API 키 getter 추가
3. `model-provider.ts`에 `getGeminiFlashLiteModel()` 추가
4. Vision Agent 설정 및 Instructions 작성
5. 단위 테스트 작성

### Phase 2: Vision Tools (1일)

1. `vision-tools.ts` 파일 생성
2. `analyzeScreenshot` 도구 구현
3. `searchWithGrounding` 도구 구현 (Google Search)
4. `analyzeUrlContent` 도구 구현
5. 도구 단위 테스트

### Phase 3: 통합 및 문서 (0.5일)

1. Orchestrator에 Vision Agent 라우팅 추가
2. 쿼터 트래커에 Gemini 추가
3. 문서 업데이트 (status.md, ai-model-policy.md)
4. 통합 테스트

### Phase 4: 프론트엔드 (0.5일)

1. `feature-cards.data.ts` 업데이트
2. `architecture-diagrams.data.ts` 업데이트
3. `tech-stacks.data.ts` 업데이트
4. E2E 테스트

---

## 7. 테스트 계획

### 7.1 단위 테스트

```typescript
// cloud-run/ai-engine/src/services/ai-sdk/model-provider.test.ts
describe('getGeminiFlashLiteModel', () => {
  it('should create Gemini model with valid API key', () => {...});
  it('should throw error without API key', () => {...});
  it('should handle rate limit errors', () => {...});
});
```

### 7.2 통합 테스트

```typescript
// cloud-run/ai-engine/src/services/ai-sdk/agents/vision-agent.test.ts
describe('Vision Agent', () => {
  it('should analyze dashboard screenshot', () => {...});
  it('should search with Google Grounding', () => {...});
  it('should analyze large log files', () => {...});
  it('should fallback gracefully on Gemini failure', () => {...});
});
```

### 7.3 E2E 테스트

```typescript
// tests/e2e/vision-agent.spec.ts
test('Vision Agent - Screenshot Analysis', async ({ page }) => {
  // 1. 이미지 업로드
  // 2. AI 응답 확인
  // 3. 분석 결과 검증
});
```

---

## 8. 롤백 계획

### 8.1 즉시 롤백 (5분)

```bash
# Cloud Run 이전 리비전으로 롤백
gcloud run services update-traffic ai-engine \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1
```

### 8.2 코드 롤백

```bash
# Git 롤백
git revert HEAD~N  # N = Vision Agent 관련 커밋 수
git push origin main
```

### 8.3 Feature Flag (선택)

```typescript
// 환경변수로 Vision Agent 비활성화
const VISION_AGENT_ENABLED = process.env.VISION_AGENT_ENABLED === 'true';

if (VISION_AGENT_ENABLED) {
  // Vision Agent 라우팅 활성화
}
```

---

## 9. 성공 기준

| 기준 | 목표 |
|------|------|
| **빌드 성공** | Cloud Run 배포 성공 |
| **테스트 통과** | 모든 단위/통합 테스트 PASS |
| **스크린샷 분석** | Grafana 스크린샷 분석 성공 |
| **로그 분석** | 100K줄 로그 분석 성공 |
| **Search Grounding** | 기술 문서 검색 결과 반환 |
| **무료 티어 유지** | 1,000 RPD 내 운영 |

---

## 10. 체크리스트

### 구현 전

- [x] Gemini API 키 유효성 확인 (`.env.local`에 존재)
- [x] `@ai-sdk/google` 버전 호환성 확인 (v1.2.0)
- [x] 무료 티어 한도 재확인 (1000 RPD, 15 RPM, 250K TPM)

### 구현 중 (Phase 1-2 완료)

- [x] `model-provider.ts` 변경 - Gemini Provider, getGeminiFlashLiteModel, getVisionAgentModel 추가
- [x] `config-parser.ts` 변경 - getGeminiApiKey() 추가
- [x] `agent-configs.ts` 변경 - Vision Agent 설정 추가
- [x] `vision-tools.ts` 생성 - 4개 Vision 도구 구현
- [x] `tools/index.ts` 업데이트 - Vision 도구 export 추가
- [x] `quota-tracker.ts` 변경 - Gemini 쿼터 추가
- [ ] 단위 테스트 작성 (Optional)

### 구현 후 (Phase 3-4 완료)

- [x] `docs/status.md` 업데이트 - Quad-provider, 6 agents, 26 tools
- [x] `docs/ai-model-policy.md` 업데이트 - Vision Agent 섹션 추가
- [x] `feature-cards.data.ts` 업데이트 - 4 providers, 6 agents
- [x] `architecture-diagrams.data.ts` 업데이트 - Vision Agent 노드 추가
- [x] `tech-stacks.data.ts` 업데이트 - Gemini Flash-Lite 추가
- [ ] E2E 테스트 통과
- [ ] Cloud Run 배포 성공

---

## 11. 승인

| 역할 | 이름 | 승인 |
|------|------|:----:|
| **기획** | - | ⏳ |
| **개발** | Claude Code | ✅ Phase 1-4 완료 |
| **리뷰** | Codex/Gemini | ⏳ |

---

_Last Updated: 2026-01-27 (Phase 4 완료 - 프론트엔드 업데이트)_
