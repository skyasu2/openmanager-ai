# ADR-004: Vercel AI SDK — LangChain/LangGraph 대신 선택한 이유

> Owner: platform-architecture
> Status: Active
> Doc type: Decision
> Last reviewed: 2026-05-06
> Canonical: docs/adr/adr-004-vercel-ai-sdk-over-langchain.md
> Tags: adr,ai-engine,vercel-ai-sdk,langchain,langgraph,architecture

**Date**: 2025-12-01 (초기 도입), 2026-05-06 (ADR 문서화)
**Status**: Decided

---

## 결정

AI 실행 레이어로 **Vercel AI SDK**를 채택한다.
LangChain / LangGraph / 기타 Python 중심 프레임워크는 채택하지 않는다.

---

## 컨텍스트

OpenManager AI는 아래 인프라 조합 위에서 동작한다.

```
Vercel (Frontend + BFF)  ←→  Cloud Run (AI Engine)
```

AI assistant 기능을 구현할 때 실행 프레임워크 선택지가 있었다.

| 후보 | 언어 | 스트리밍 방식 | Vercel 통합 |
|------|------|--------------|-------------|
| Vercel AI SDK | TypeScript | UIMessageStream (네이티브) | 네이티브 |
| LangChain.js | TypeScript | 별도 adapter 필요 | 별도 구성 |
| LangGraph (Python) | Python | 별도 서버 필요 | 비호환 |
| OpenAI SDK 직접 | TypeScript | 수동 구현 | 수동 구성 |

---

## 결정 이유

### 1. Vercel 플랫폼 일관성

Frontend와 BFF가 Vercel에서 동작한다. Vercel AI SDK의 `useChat`, `UIMessageStream`,
`streamText` 응답 형식은 Vercel Edge Runtime과 네이티브로 통합된다.

LangChain을 쓰면 Vercel의 스트리밍 계약(`data:` prefix SSE 형식)을 수동으로 맞춰야 하고,
BFF ↔ 클라이언트 간 transport adapter를 별도로 구현해야 한다.

### 2. 백엔드 부담 최소화

Cloud Run AI Engine이 무거운 처리를 담당하지만, BFF(Vercel)와 클라이언트 사이의
스트리밍 파이프는 최대한 얇게 유지해야 한다.

Vercel AI SDK는 이 파이프를 `streamText` → `toDataStreamResponse()` 한 줄로 처리한다.
LangChain은 동일한 기능을 위해 Chain 구성 + 커스텀 callback + response adapter가 필요하다.

### 3. TypeScript 우선 생태계

Python 중심 LangGraph는 TypeScript 지원이 제한적이고 기능 격차가 크다.
전체 스택이 TypeScript 기반인 이 프로젝트에서 Python 런타임을 추가하는 건
운영 복잡도 증가로 이어진다.

### 4. Vercel AI SDK의 multi-step tool call 지원

`streamText`의 `stopWhen`, `prepareStep`, `hasToolCall` 조합으로
multi-step tool call을 선언적으로 제어할 수 있다.
이것이 자체 orchestrator의 기반이 됐다.

---

## 트레이드오프

### 포기한 것

| 항목 | LangGraph 대비 손실 |
|------|-------------------|
| Graph 기반 state machine | 명시적 node/edge 선언 불가. 현재 orchestrator는 명령형 코드로 동일한 흐름을 표현 |
| Human-in-the-loop | LangGraph의 `interrupt()` 같은 내장 기능 없음. 필요 시 별도 구현 필요 |
| Python 생태계 도구 | LangSmith, LangServe 등 LangChain 전용 도구 활용 불가 |

### 얻은 것

| 항목 | 내용 |
|------|------|
| 단일 런타임 | TypeScript만으로 Frontend → BFF → AI Engine 전체 스택 통일 |
| 스트리밍 네이티브 | `useChat` ↔ `streamText` 계약이 플랫폼 수준에서 보장됨 |
| 배포 단순성 | Python 런타임, 별도 LangServe 서버 불필요 |
| provider 교체 용이 | `createOpenAI`, `createGroq`, `createCerebras` 등 1줄 교체 |

---

## 자체 Orchestrator 구현 배경

LangGraph를 쓰지 않으면서 multi-agent orchestration이 필요했다.
결과적으로 `orchestrator-agent-stream.ts` (1,167줄), `orchestrator-routing.ts` (1,119줄)를
직접 구현했다.

이 비용은 의도된 트레이드오프다.

- Vercel AI SDK의 `streamText` 루프 위에서 provider fallback, circuit breaker, quota tracking을
  직접 제어할 수 있다.
- LangGraph TypeScript 버전은 이 수준의 제어를 아직 제공하지 않는다.

향후 LangGraph TypeScript 성숙도가 높아지거나 graph 기반 제어가 필요해지면,
`AssistantRuntimeHost.executeLLMStream` 경계에서 교체하면 된다.
Core / Domain Pack / Agent Registry는 건드릴 필요 없다.

---

## 재검토 조건

아래 상황이 되면 이 결정을 재검토한다.

- Vercel 플랫폼을 완전히 이탈하는 경우
- LangGraph TypeScript SDK가 provider fallback / circuit breaker를 내장하는 경우
- Human-in-the-loop 기능이 제품 요구사항으로 확정되는 경우
