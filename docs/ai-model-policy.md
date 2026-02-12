# AI Model Policy (Cloud Run + Vercel AI SDK) - 2026.01

이 문서는 OpenManager AI의 AI 아키텍처를 정리합니다.
현재 AI 처리는 **Cloud Run 기반 LLM 멀티 에이전트 시스템 (Vercel AI SDK v6 Native)** 으로 구성되어 있습니다.

> **최종 업데이트**: 2026-02-12 (v8.0.0 버전 동기화)

---

## 🧠 NLP 아키텍처 개요

### 오픈소스 여부
**100% 오픈소스 LLM 기반**입니다. 자체 NLP 엔진은 없으며 외부 LLM API를 사용합니다.

| 구분 | 내용 |
|------|------|
| **NLP 엔진** | 자체 구현 없음 (외부 LLM API 사용) |
| **기반 모델** | Meta Llama 3.3 70B (오픈소스), Gemini 2.5 Flash-Lite (Vision) |
| **호스팅** | Cerebras, Groq, Mistral, **Google AI (Gemini)** 인프라 |
| **비용** | 모두 무료 tier 한도 내 운영 |

### 배치 위치
```
Cloud Run AI Engine (asia-northeast1)
├── cloud-run/ai-engine/src/services/ai-sdk/
│   ├── model-provider.ts     # LLM 프로바이더 관리 (3-way Fallback)
│   ├── supervisor.ts         # 메인 에이전트 오케스트레이션
│   └── agents/
│       ├── orchestrator.ts   # 멀티에이전트 오케스트레이터 (Dual-Path Routing)
│       ├── nlq-agent.ts      # 자연어 쿼리 처리 (NLP)
│       ├── analyst-agent.ts  # 분석, 이상 탐지
│       ├── reporter-agent.ts # 보고서 생성
│       ├── reporter-pipeline.ts  # Evaluator-Optimizer 패턴
│       ├── advisor-agent.ts  # RAG 기반 조언
│       └── vision-agent.ts   # Vision Agent (Gemini Flash-Lite)
```

### 기술 스택
```
Vercel AI SDK 6 (@ai-sdk)
├── @ai-sdk/cerebras     # Cerebras 통합 (Primary)
├── @ai-sdk/groq         # Groq 통합 (NLQ Agent)
├── @ai-sdk/mistral      # Mistral 통합 (Verifier)
└── @ai-sdk/google       # Gemini 통합 (Vision Agent)
```

### 의도 분류 (Intent Classification)

경량 정규식 기반 라우팅 (CPU 부담 최소화):

| 카테고리 | 패턴 예시 | 라우팅 |
|----------|----------|--------|
| 보고서 | `보고서`, `리포트`, `인시던트` | Multi-Agent |
| 원인 분석 | `왜.*높아`, `원인.*뭐`, `rca` | Multi-Agent |
| 문제 해결 | `어떻게.*해결`, `조치.*방법` | Multi-Agent |
| 예측/추세 | `예측`, `트렌드`, `앞으로` | Multi-Agent |
| 비교 분석 | `어제.*대비`, `비교.*해` | Multi-Agent |
| 용량 계획 | `언제.*부족`, `증설.*필요` | Multi-Agent |
| 이상 분석 | `왜.*이상`, `스파이크.*원인` | Multi-Agent |
| 요약 | `서버.*요약`, `핵심.*알려` | Multi-Agent |
| **기타** | 단순 조회 | **Single-Agent** |

> **설계 원칙**: Python NLP 라이브러리 대신 정규식 사용으로 Cloud Run CPU 부담 최소화

---

## 📊 현재 아키텍처

### LLM 멀티 에이전트 시스템 (Cloud Run)

| Agent | Primary | Fallback | 역할 |
|-------|---------|----------|------|
| **Orchestrator** | Cerebras llama-3.3-70b | Mistral mistral-small-2506 | 빠른 라우팅, 태스크 분배 (~200ms) |
| **NLQ Agent** | Cerebras llama-3.3-70b | Groq llama-3.3-70b-versatile | 자연어 쿼리, 서버 메트릭 조회 |
| **Analyst Agent** | Groq llama-3.3-70b-versatile | Cerebras llama-3.3-70b | 이상 탐지, 트렌드 예측, 패턴 분석 |
| **Reporter Agent** | Groq llama-3.3-70b-versatile | Cerebras llama-3.3-70b | 장애 보고서, 타임라인, GraphRAG |
| **Advisor Agent** | Mistral mistral-small-2506 | Groq llama-3.3-70b-versatile | 트러블슈팅 가이드, 명령어 추천 |
| **Vision Agent** | Gemini 2.5 Flash-Lite | ❌ (Graceful Degradation) | 스크린샷 분석, 대용량 로그, Search Grounding |
| **Verifier** | Mistral mistral-small-2506 | Cerebras llama-3.3-70b | 응답 검증 |

### Embedding (Cloud Run)

| 역할 | 모델 | 차원 | 비고 |
|------|------|------|------|
| **Vector Search** | mistral-embed | 1024d | Supabase pgvector 연동 |

### Frontend Layer (Vercel)

| 역할 | 기능 | 비고 |
|------|------|------|
| **Proxy** | API 라우팅 | Cloud Run으로 요청 전달 |
| **Cache** | 응답 캐싱 | Rate Limiting 보호 |
| **UI** | 사용자 인터페이스 | React 19 + Next.js 16 |

---

## 🛠️ 기술 스택

### Vercel AI SDK (`ai` v6.0.66, Cloud Run: `^6.0.50`)

```typescript
// Provider 패키지
"@ai-sdk/cerebras": "^2.0.2"   // Orchestrator, NLQ
"@ai-sdk/groq": "^2.0.33"      // Analyst, Reporter
"@ai-sdk/mistral": "^3.0.1"    // Advisor, Embedding
```

### Agent Framework (Native AI SDK v6)

```typescript
// Native AI SDK v6 patterns (no external agent library)
import { generateText, streamUI, tool } from 'ai';
import { createDataStreamResponse, createUIMessageStream } from '@ai-sdk/ui-utils';

// Key patterns:
// - stopWhen: [hasToolCall('finalAnswer'), stepCountIs(5)]
// - prepareStep: Agent priority optimization
// - UIMessageStream: Native streaming protocol
// - Resumable Stream v2: Redis-backed reconnection
```

---

## 🔄 Agent 라우팅

### Multi-Agent Mode
```
User Query → Orchestrator (Cerebras)
                ├→ NLQ Agent (Cerebras)
                ├→ Analyst Agent (Groq)
                ├→ Reporter Agent (Groq)
                └→ Advisor Agent (Mistral)
```

### Direct Routes
| Route | Agent | 용도 |
|-------|-------|------|
| `/analyze-server` | Analyst | 서버 분석 직접 호출 |
| `/incident-report` | Reporter | 인시던트 리포트 생성 |
| `/troubleshoot` | Advisor | RAG 기반 가이드 |

---

## 📊 Reporter Pipeline (Evaluator-Optimizer 패턴)

Reporter Agent는 고품질 보고서 생성을 위해 **Evaluator-Optimizer** 패턴을 사용합니다.

### 파이프라인 구성
```
┌─────────────────────────────────────────────────────────────┐
│                  Reporter Pipeline                          │
│  ┌──────────┐   ┌───────────┐   ┌───────────┐              │
│  │ Generate │ → │ Evaluate  │ → │ Optimize  │ → Re-evaluate│
│  │ (Draft)  │   │ (Score)   │   │ (Improve) │              │
│  └──────────┘   └───────────┘   └───────────┘              │
│                      │                                      │
│                  quality ≥ 0.75? ─────→ Return              │
│                      │                                      │
│                  No: Iterate (max 2회)                      │
└─────────────────────────────────────────────────────────────┘
```

### 설정값
| 항목 | 값 | 설명 |
|------|-----|------|
| **qualityThreshold** | 0.75 | 최소 품질 점수 |
| **maxIterations** | 2 | 최대 개선 반복 횟수 |
| **timeout** | 40초 | 파이프라인 타임아웃 |

### 평가 기준 (5가지)
1. **completeness** (0.2): 필수 정보 포함 여부
2. **accuracy** (0.25): 데이터 정확도
3. **clarity** (0.2): 명확한 표현
4. **actionability** (0.2): 실행 가능한 권고
5. **structure** (0.15): 논리적 구조

---

## 🔍 Tavily 웹 검색 통합

Reporter Agent는 **Tavily API**를 통해 실시간 웹 검색 기능을 제공합니다.

### 설정
| 항목 | 값 | 설명 |
|------|-----|------|
| **timeout** | 15초 | 검색 타임아웃 |
| **maxRetries** | 2 | 재시도 횟수 |
| **cacheSize** | 30 | LRU 캐시 항목 수 |
| **cacheTTL** | 5분 | 캐시 TTL |

### API 키 Failover
```
TAVILY_API_KEY (Primary)
     ↓ 실패 시
TAVILY_API_KEY_BACKUP (Backup)
```

### 사용 도구
- `searchWebWithTavily`: 웹 검색 수행
- `extractWebContent`: 특정 URL 콘텐츠 추출

---

## 👁️ Vision Agent (Gemini Flash-Lite)

Vision Agent는 **Gemini 2.5 Flash-Lite**를 사용하여 멀티모달 분석 기능을 제공합니다.

### 주요 기능
| 기능 | 설명 |
|------|------|
| **스크린샷 분석** | Grafana/CloudWatch/Datadog 대시보드 이미지 분석 |
| **대용량 로그 분석** | 1M 토큰 컨텍스트로 전체 로그 파일 분석 |
| **Google Search Grounding** | 실시간 기술 문서, 보안 취약점 검색 |
| **URL 콘텐츠 분석** | 외부 문서/문제 해결 가이드 직접 참조 |

### Vision 도구
| 도구 | 설명 |
|------|------|
| `analyzeScreenshot` | 대시보드 스크린샷 분석 (이상 패턴, 알림, 시각적 이슈 식별) |
| `analyzeLargeLog` | 대용량 로그 분석 (에러 패턴, 타임라인, 근본 원인) |
| `searchWithGrounding` | Google Search Grounding 실시간 검색 |
| `analyzeUrlContent` | URL 콘텐츠 추출 및 분석 |

### Fallback 전략: Graceful Degradation

Vision Agent는 **Fallback 없이 Graceful Degradation**으로 동작합니다:

```
Gemini 정상 시:
  Vision Agent → 모든 멀티모달 기능 사용 가능

Gemini 장애 시:
  Vision Agent → null 반환 (비활성화)
  기존 에이전트 (NLQ/Analyst/Reporter/Advisor) → 100% 정상 동작
  사용자에게 안내 메시지: "Vision 기능이 일시적으로 비활성화되었습니다"
```

> **Fallback 미적용 사유**: OpenRouter 무료 모델은 PDF, Google Search Grounding, 1M Context 미지원으로 핵심 기능 대체 불가

### Gemini 무료 티어 (2026-01 기준)
| 항목 | 제한 |
|------|------|
| RPD (Requests/Day) | 1,000 |
| RPM (Requests/Minute) | 15 |
| TPM (Tokens/Minute) | 250,000 |
| Context Window | 1M tokens |

---

## 🚨 아키텍처 변경 배경 (2025.12)

### Google AI → LLM 멀티 에이전트 마이그레이션

1. **무료 티어 제한 강화**: Google AI 무료 할당량 급감
2. **임베딩 차원 변경**: 384d (Google) → 1024d (Mistral)
3. **LLM 멀티 에이전트 도입**: 역할별 최적화된 LLM 배치
4. **통합 인프라**: Cloud Run 단일 서비스로 통합

### 무료 티어 활용 (2026-01 기준)

| Provider | 무료 할당량 | 용도 | 모델 |
|----------|-------------|------|------|
| **Cerebras** | 24M tokens/day | Primary (Orchestrator, NLQ) | llama-3.3-70b |
| **Groq** | 100K tokens/day | Analyst, Reporter | llama-3.3-70b-versatile |
| **Mistral** | 1M tokens/mo | Verifier, Advisor | mistral-small-2506 |
| **Gemini** | 1K RPD, 250K TPM | Vision Agent | gemini-2.5-flash-lite |

### Fallback 체인

Agent별로 Fallback 순서가 다릅니다:

| Agent | Primary | Fallback 1 | Fallback 2 |
|-------|---------|-----------|-----------|
| **NLQ** | Cerebras | Groq | Mistral |
| **Analyst** | Groq | Cerebras | Mistral |
| **Advisor** | Mistral | Groq | Cerebras |
| **Supervisor** | Cerebras | Mistral | Groq |

> **참고**: 위 표의 Supervisor 체인은 Orchestrator/Verifier 기준입니다. 각 Agent는 Primary provider 장애 또는 quota 80% 초과 시 자동 전환됩니다.

---

## 🔧 환경 변수 설정

```env
# Cloud Run AI Engine
CLOUD_RUN_AI_URL=https://ai-engine-xxx.asia-northeast1.run.app
CLOUD_RUN_AI_ENABLED=true

# Provider API Keys (Cloud Run 내부)
CEREBRAS_API_KEY=xxx
GROQ_API_KEY=xxx
MISTRAL_API_KEY=xxx
GEMINI_API_KEY=xxx   # Vision Agent 전용

# Note: Vercel에서는 Cloud Run URL만 필요
# API 키는 Cloud Run 환경에서 관리
```

---

## 💡 요약

**"LLM 멀티 에이전트 시스템 on Cloud Run with Vercel AI SDK"**

- **Orchestrator**: Cerebras (빠른 라우팅)
- **Analysis**: Groq (이상 탐지, 리포팅)
- **RAG/Embedding**: Mistral (1024d)
- **Vision**: Gemini Flash-Lite (스크린샷, 대용량 로그, Search Grounding)
- **Vector DB**: Supabase pgvector
- **Vercel**: Proxy + Cache only

_Last Updated: 2026-02-08_
