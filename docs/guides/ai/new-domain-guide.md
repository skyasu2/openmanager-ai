# 새 도메인 추가 가이드

이 시스템의 AI 어시스턴트는 **도메인 플러그인 구조**로 설계되어 있습니다.
현재 `openmanager-monitoring` 도메인이 기본으로 등록되어 있으며,
아래 단계를 따라 새 도메인을 추가할 수 있습니다.

---

## 핵심 개념

```
AssistantDomain          ← 도메인 계약서 (인터페이스)
  └── domain-pack.ts     ← 구현체 (도메인별로 1개)

DomainEvidenceProvider   ← deterministic 응답 로직
DomainDataSource         ← 데이터 연결
DomainCapability         ← 이 도메인이 할 수 있는 것 선언

DomainRegistry           ← supervisor가 도메인을 찾는 곳
  └── registerDomainHost(domainId, hostFactory)
```

supervisor와 모든 라우트는 `DomainRegistry`만 봅니다.
모니터링 코드에 전혀 의존하지 않습니다.

---

## Step 1 — 새 도메인 폴더 생성

```
cloud-run/ai-engine/src/domains/<your-domain>/
  ├── constants.ts          ← 도메인 ID, capability ID 상수
  ├── domain-pack.ts        ← AssistantDomain 구현 (필수)
  ├── data-source.ts        ← DomainDataSource 구현 (데이터 있는 경우)
  ├── evidence-provider.ts  ← DomainEvidenceProvider 구현 (deterministic 응답)
  └── routing-policy.ts    ← RoutingPolicy 구현
```

### constants.ts 예시

```typescript
export const MY_DOMAIN_ID = 'my-company-helpdesk';
export const MY_DOMAIN_VERSION = '2026-01-01';

export const HELPDESK_TICKET_QUERY_CAPABILITY_ID = 'helpdesk.ticket_query';
export const HELPDESK_FAQ_CAPABILITY_ID = 'helpdesk.faq_answer';
```

---

## Step 2 — domain-pack.ts 구현

`AssistantDomain` 인터페이스를 구현합니다.
최소 필수 항목: `id`, `version`, `instructions`, `routingPolicy`, `tools`

```typescript
import type { AssistantDomain } from '../../core/assistant-runtime';
import { MY_DOMAIN_ID, MY_DOMAIN_VERSION } from './constants';
import { myDomainRoutingPolicy } from './routing-policy';
import { myDomainToolRegistry } from './tool-registry';
import { myDomainDataSource } from './data-source';
import { myEvidenceProvider } from './evidence-provider';
import { myCapabilityManifest } from './capabilities';

export const myDomainPack: AssistantDomain = {
  id: MY_DOMAIN_ID,
  version: MY_DOMAIN_VERSION,
  instructions: {
    system: `당신은 헬프데스크 AI 어시스턴트입니다.
티켓 조회, FAQ 답변, 이슈 분류를 담당합니다.`,
  },
  routingPolicy: myDomainRoutingPolicy,
  tools: myDomainToolRegistry,

  // 선택 항목
  dataSource: myDomainDataSource,
  capabilities: myCapabilityManifest,
  evidenceProviders: [myEvidenceProvider],
};
```

---

## Step 3 — runtime-host 파일 생성

`services/ai-sdk/my-domain-runtime-host.ts`

```typescript
import { generateText, streamText } from 'ai';
import { createInMemoryAssistantRuntimeAdapters } from '../../core/assistant-runtime';
import { myDomainPack } from '../../domains/my-domain/domain-pack';
import {
  createAssistantRuntimeHost,
  type AssistantRuntimeHost,
} from './assistant-runtime-host';
import { registerDomainHost } from './domain-registry';
import { MY_DOMAIN_ID } from '../../domains/my-domain/constants';
import { allTools } from '../../tools-ai-sdk';

let defaultHost: AssistantRuntimeHost | undefined;

export function getDefaultMyDomainHost(): AssistantRuntimeHost {
  defaultHost ??= createAssistantRuntimeHost({
    domain: myDomainPack,
    adapters: createInMemoryAssistantRuntimeAdapters(),
    adapterKinds: {
      stateStore: 'in-memory',
      sessionStore: 'in-memory',
      jobQueue: 'in-memory',
      artifactStore: 'in-memory',
      vectorStore: 'empty',
    },
    executionAdapter: {
      createToolSet() { return allTools; },
      createSystemPrompt() { return myDomainPack.instructions.system; },
      executeLLMStream(params) { return streamText(params as any); },
      executeLLMGenerate(params) { return generateText(params as any); },
    },
  });
  return defaultHost;
}

// 레지스트리에 자동 등록 (이 파일을 import하는 것만으로 충분)
registerDomainHost(MY_DOMAIN_ID, getDefaultMyDomainHost);
```

---

## Step 4 — agent-configs.ts에 import 추가

`services/ai-sdk/agents/config/agent-configs.ts` 상단에:

```typescript
// 도메인 레지스트리에 등록을 보장하기 위한 사이드이펙트 import
import '../../my-domain-runtime-host';
```

> 현재 `agent-configs.ts`는 모듈 로드 시점에 registry에서 도메인 호스트를 조회합니다.
> 이 import가 그 조회보다 먼저 등록이 이루어지도록 보장합니다.

---

## Step 5 — 라우트에서 도메인 선택 (선택)

특정 API 엔드포인트를 새 도메인 전용으로 만들고 싶다면:

```typescript
import { getDomainHost } from '../services/ai-sdk/domain-registry';
import { MY_DOMAIN_ID } from '../domains/my-domain/constants';

// 라우트에서
const request: SupervisorRequest = {
  messages,
  sessionId,
  runtimeHost: getDomainHost(MY_DOMAIN_ID), // ← 명시적 도메인 지정
};
```

`runtimeHost`가 설정되면 supervisor는 registry 기본값 대신 이 호스트를 사용합니다.

---

## evidence provider 패턴

deterministic 응답을 만드는 핵심 패턴입니다.
LLM 없이 빠르게 답하는 경로입니다.

```typescript
import type { DomainEvidenceProvider, DomainEvidenceRequest } from '../../core/assistant-runtime';

export const myEvidenceProvider: DomainEvidenceProvider = {
  id: 'my-domain-ticket-query',

  canHandle(request: DomainEvidenceRequest): boolean {
    // 이 쿼리를 처리할 수 있는지 판단
    return /티켓|ticket/i.test(request.message);
  },

  async resolve(request: DomainEvidenceRequest) {
    const snapshot = await request.dataSource?.snapshot(request);
    if (!snapshot) return null;

    const answer = buildTicketAnswer(snapshot, request.message);
    if (!answer) return null;

    return {
      id: 'my-domain-ticket-query',
      prompt: `[결정적 근거]\n${answer}`,
      fallback: answer,
      metadata: {
        responsePolicy: 'deterministic_answer', // LLM bypass
        intent: 'ticket_query',
      },
    };
  },
};
```

`responsePolicy: 'deterministic_answer'`로 설정하면 supervisor가
LLM을 호출하지 않고 `fallback`을 바로 응답합니다.

---

## 체크리스트

새 도메인을 추가할 때 확인해야 할 항목:

- [ ] `constants.ts`에 도메인 ID와 capability ID 정의
- [ ] `domain-pack.ts`에서 `AssistantDomain` 구현
- [ ] `*-runtime-host.ts` 파일 생성 + `registerDomainHost()` 호출
- [ ] `agent-configs.ts`에 사이드이펙트 import 추가
- [ ] evidence provider 구현 (deterministic 응답이 필요한 경우)
- [ ] 테스트 작성 (domain-pack.contract.test.ts 패턴 참고)

---

## 참조

| 파일 | 역할 |
|------|------|
| `core/assistant-runtime/types.ts` | 모든 인터페이스 정의 |
| `services/ai-sdk/domain-registry.ts` | 레지스트리 구현 |
| `services/ai-sdk/monitoring-runtime-host.ts` | 모니터링 도메인 참조 구현 |
| `domains/monitoring/domain-pack.ts` | 도메인팩 참조 구현 |
| `test-fixtures/sample-domain-pack.ts` | 최소 구현 예시 |
