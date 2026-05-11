> Owner: project
> Status: Approved
> Last reviewed: 2026-05-11

# AI Assistant Domain Capability Resolver Plan

- 상태: Approved
- 작성일: 2026-05-11
- TODO.md 연결: Active Tasks > AI Assistant Domain Capability Resolver Phase 2

## 목표

AI Engine 공통 런타임이 provider 구현체 이름이나 monitoring 전용 정규식을 알지 않으면서도, 자연어 질의를 `domain/capability/intent frame` 기준으로 evidence provider에 전달할 수 있는 최소 계약을 추가한다.

이번 단계는 전체 라우팅 재작성이나 LLM parser 강제 도입이 아니라, 현재 `DomainEvidenceProvider` 구조에 portable `DomainCapabilityManifest`와 `DomainIntentFrame`을 얹어 이후 모의 주식, HR, 코드리뷰 같은 다른 도메인도 같은 방식으로 이식할 수 있게 만드는 Phase 2 기반 작업이다.

## 범위

- 포함:
  - AI Engine assistant runtime 타입에 domain-neutral capability manifest / intent frame 계약 추가
  - `resolveDomainEvidenceSupport`가 domain intent parser 또는 request metadata frame을 받아 provider에 전달
  - monitoring domain이 `metric_peak` capability를 manifest로 노출
  - monitoring peak evidence provider가 frame/capability 우선으로 처리하고 raw message fallback은 유지
  - sample non-monitoring domain으로 재사용성 회귀 테스트 유지
- 제외:
  - Root App과 AI Engine 간 wire protocol 전면 변경
  - LLM semantic parser를 AI Engine request path에 강제 삽입
  - 모든 monitoring provider를 capability 기반으로 일괄 이전
  - production live LLM 반복 QA

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.ts`
- `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts`
- `cloud-run/ai-engine/src/domains/monitoring/peak-metric-evidence-provider.ts`
- `cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts`
- 관련 테스트:
  - `cloud-run/ai-engine/src/core/assistant-runtime/assistant-runtime.contract.test.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.test.ts`
  - `cloud-run/ai-engine/src/core/assistant-runtime/sample-domain-portability.smoke.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `AssistantDomain.capabilities` | domain capability manifest | optional runtime metadata | 없으면 기존 동작 유지 |
| `AssistantDomain.intentParser.parse(context)` | `AssistantRequestContext` | `DomainIntentFrame | undefined` | parser 실패 시 undefined로 fallback |
| `DomainEvidenceRequest.intentFrame` | parsed/metadata frame | provider selection hint | invalid/unknown frame이면 provider raw fallback |
| `DomainEvidenceProvider.canHandle(request)` | request + optional `intentFrame`/`capability` | boolean | provider 내부 판단 유지 |
| `resolveDomainEvidenceSupport` | raw query + domain | evidence result | matched provider 없으면 null |

### `DomainIntentFrame` 최소 계약

```ts
interface DomainIntentFrame {
  domainId: string;
  intent: string;
  capabilityId?: string;
  scope: 'whole_fleet' | 'entity' | 'group' | 'unknown';
  targets: string[];
  metric?: string;
  timeWindow?: string;
  aggregation?: string;
  topN?: number;
  ambiguity: 'low' | 'medium' | 'high';
  confidence: number;
  slots?: Record<string, unknown>;
}
```

### 테스트 시나리오 (구현 전 확정)

- [ ] runtime public contract가 `DomainCapabilityManifest`, `DomainIntentFrame`, `DomainIntentParser`를 export한다.
- [ ] monitoring domain이 `monitoring.metric_peak` capability를 manifest로 노출한다.
- [ ] resolver는 `intentParser`가 만든 `metric_peak` frame을 provider request에 전달하고, provider는 raw query regex 없이도 frame으로 처리한다.
- [ ] resolver는 `metadata.intentFrame`이 있으면 parser보다 우선 사용한다.
- [ ] non-monitoring sample domain도 같은 capability/frame 계약으로 evidence를 resolve한다.
- [ ] capability/frame이 없는 기존 domain/provider는 raw message fallback으로 계속 동작한다.

## Task 목록

- [x] Task 0 — failing test 커밋: 위 테스트 시나리오를 구현 전 실패 상태로 추가
- [ ] Task 1 — assistant runtime capability/intent frame 타입 계약 추가
- [ ] Task 2 — resolver에 metadata frame / domain parser / capability lookup 흐름 추가
- [ ] Task 3 — monitoring + sample domain manifest/parser/provider 연결
- [ ] Task 4 — 문서/TODO 정리 및 targeted 검증

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 (failing test) | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~3 | `feat(ai-engine):` | ✅ | release/tag에서 판단 | ❌ |
| Task 4 | `docs:` 또는 구현 커밋 포함 | ✅ | ❌ | ❌ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 provider 이름 노출 없이 capability/frame 계약을 검증하는지 |
| 핵심 구현 Task 완료 후 | 공통 런타임에 monitoring 도메인 문자열/import가 새로 들어가지 않았는지 |
| 전체 완료 후 | 기존 raw message fallback과 sample domain portability가 유지되는지 |

## 완료 기준

- [ ] targeted AI Engine unit tests 통과
- [ ] AI Engine type-check 통과
- [ ] `git diff --check` 통과
- [ ] 공통 runtime이 domain-neutral 상태 유지
- [ ] production live QA는 release/tag 배포 후 필요 시 별도 QA gate에서 수행
