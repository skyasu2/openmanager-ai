> Owner: project
> Status: Draft
> Doc type: How-to
> Last reviewed: 2026-05-17
> Tags: portability, refactor, ai-artifacts, domain-pattern

# AI 어시스턴트 이식성 개선 계획

## 목적

현재 프로젝트를 **다른 도메인의 AI 어시스턴트를 만들 때 참조할 수 있는 수준**으로 정리한다.  
같은 앱에 두 번째 도메인을 추가하는 것이 목표가 아니며, 하네스(Harness) 개선도 대상 외다.

---

## 현황 진단

### 백엔드 (Cloud Run AI Engine) — 이미 이식 가능

`core/assistant-runtime/types.ts`의 `AssistantDomain` 인터페이스가 완전히 도메인 중립으로 설계되어 있고,  
`sample-domain-portability.smoke.test.ts`가 모니터링 코드 없이 외부 도메인을 런타임에 연결할 수 있음을 증명한다.  
`domains/monitoring/`은 이 인터페이스를 구현한 하나의 플러그인이며, 백엔드 측 개선은 **불필요**하다.

### 프론트엔드 — 3곳에 모니터링 하드코딩

| # | 파일 | 문제 |
|---|------|------|
| P1 | `src/lib/ai/chat-artifacts/types.ts` | `ChatArtifact` 유니온 타입이 모니터링 5종 아티팩트 직접 열거 |
| P2 | `src/components/ai/domain-renderers/ArtifactRendererHost.tsx` | `switch(artifactKind)` 가 모니터링 5종 렌더러 하드코딩 |
| P3 | `src/hooks/ai/core/chat-artifact-execution.ts` | `case 'server-snapshot':` 등 모니터링 kind 직접 분기 |

이 세 곳 외에 `artifact-renderer-registry.ts`가 P2의 지원 파일로 함께 변경 범위에 포함된다.

---

## 계약 (Contract)

### 변경 후 보장 조건

1. `ChatArtifact` 타입을 import하는 코드가 모니터링 도메인 없이도 컴파일된다.
2. 모니터링 아티팩트 카드 5종의 렌더 동작이 변경 전과 동일하다.
3. 새 도메인이 레지스트리에 렌더러 1개를 등록하면 별도 공유 파일 수정 없이 UI에 표시된다.
4. 기존 테스트 전체(`npm run test:quick`)가 통과한다.

### 테스트 시나리오

```
S1: 기존 모니터링 아티팩트 렌더 회귀
    Given: 채팅 메시지에 incident-report 아티팩트 메타데이터 포함
    When: ArtifactRendererHost 렌더
    Then: IncidentReportArtifactCard 표시 (기존 동작 동일)

S2: 알 수 없는 kind 폴백
    Given: 등록되지 않은 kind의 아티팩트 메타데이터
    When: ArtifactRendererHost 렌더
    Then: UnsupportedArtifactFallback 표시 (기존 동작 동일)

S3: 도메인 독립 타입 컴파일
    Given: ChatArtifact 기본 타입만 import한 파일
    When: tsc 실행
    Then: 모니터링 타입 import 없이 컴파일 성공

S4: 레지스트리 동적 등록
    Given: 테스트 전용 'mock-report' kind 렌더러를 레지스트리에 등록
    When: 해당 kind의 아티팩트를 ArtifactRendererHost에 전달
    Then: 등록된 렌더러 컴포넌트 출력
```

---

## 작업 목록

### T1 — `ChatArtifact` 타입 제너릭화

**대상 파일**
- `src/lib/ai/chat-artifacts/types.ts`
- `src/lib/ai/domains/monitoring/artifact-registry.ts` (모니터링 타입 이동 목적지)

**작업 내용**

1. `ChatArtifact` 유니온 타입을 도메인 독립 베이스 타입으로 교체한다.

```typescript
// Before
export type ChatArtifact =
  | IncidentReportArtifact
  | MonitoringAnalysisArtifact
  | ServerMonitoringAnalysisArtifact
  | ServerSnapshotArtifact
  | OpsProcedureArtifact;

// After — 공유 파일 (chat-artifacts/types.ts)
export interface ChatArtifact extends ArtifactContractMetadata {
  kind: string;
  generatedAt: string;
}

// 모니터링 특화 유니온은 domains/monitoring/ 내부로 이동
// src/lib/ai/domains/monitoring/artifact-registry.ts
export type MonitoringChatArtifact =
  | IncidentReportArtifact
  | MonitoringAnalysisArtifact
  | ServerMonitoringAnalysisArtifact
  | ServerSnapshotArtifact
  | OpsProcedureArtifact;
```

2. `ArtifactEnvelope<TArtifact extends ChatArtifact>` 제약은 그대로 유지된다.
3. 모니터링 특화 아티팩트 인터페이스(`IncidentReportArtifact` 등)는 `types.ts`에 남겨 기존 임포트를 유지한다. 유니온 타입만 이동한다.
4. `createArtifactEnvelope`, `readArtifactEnvelope` 함수 시그니처 변경 없음.

**검증**: `npm run type-check` 통과, `test:quick` 통과.

- [ ] T1 구현
- [ ] T1 테스트 통과 확인

---

### T2 — `ArtifactRendererHost` 레지스트리 전환

**대상 파일**
- `src/lib/ai/domain-renderers/artifact-renderer-registry.ts`
- `src/components/ai/domain-renderers/ArtifactRendererHost.tsx`
- `src/lib/ai/domains/monitoring/` (모니터링 렌더러 등록 초기화 파일 신규)

**작업 내용**

1. `artifact-renderer-registry.ts`에 렌더러 등록/조회 API를 추가한다.

```typescript
// src/lib/ai/domain-renderers/artifact-renderer-registry.ts 에 추가
type ArtifactRendererFn = (artifact: ChatArtifact) => React.ReactNode;

const _rendererMap = new Map<string, ArtifactRendererFn>();

export function registerArtifactRenderer(kind: string, renderer: ArtifactRendererFn) {
  _rendererMap.set(kind, renderer);
}

export function resolveArtifactRenderer(kind: string): ArtifactRendererFn | undefined {
  return _rendererMap.get(kind);
}
```

2. 모니터링 렌더러 등록 파일을 신규 작성한다.

```typescript
// src/lib/ai/domains/monitoring/register-renderers.ts (신규)
import { registerArtifactRenderer } from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import { IncidentReportArtifactCard } from '@/components/ai/IncidentReportArtifactCard';
// ... 나머지 4종 import

export function registerMonitoringArtifactRenderers() {
  registerArtifactRenderer('incident-report', (a) => <IncidentReportArtifactCard artifact={a as IncidentReportArtifact} />);
  // 나머지 4종 등록
}
```

3. `ArtifactRendererHost`의 switch 문을 레지스트리 조회로 교체한다.

```typescript
// Before
switch (entry.artifactKind) {
  case 'incident-report': return <IncidentReportArtifactCard ... />;
  // ...
}

// After
const renderer = resolveArtifactRenderer(entry.artifactKind);
if (!renderer) return <UnsupportedArtifactFallback entry={entry} />;
return renderer(entry.artifact);
```

4. 앱 진입점(`_app.tsx` 또는 layout.tsx 등)에서 `registerMonitoringArtifactRenderers()`를 호출한다.

**검증**: S1~S4 시나리오 테스트 작성 후 통과.

- [ ] T2 테스트 시나리오 S1~S4 작성 (`test(spec):` 커밋)
- [ ] T2 구현
- [ ] T2 테스트 통과 확인

---

### T3 — `chat-artifact-execution.ts` 실행기 일반화

**대상 파일**
- `src/hooks/ai/core/chat-artifact-execution.ts`
- `src/lib/ai/domains/monitoring/` (모니터링 실행기 등록 파일 신규 또는 T2 등록 파일에 통합)

**작업 내용**

1. 아티팩트 실행기 레지스트리를 추가한다.

```typescript
// src/lib/ai/chat-artifacts/artifact-executor-registry.ts (신규)
type ArtifactExecutorFn = (intent: ArtifactIntent, options: ArtifactExecutionOptions) => Promise<ChatArtifact | null>;

const _executorMap = new Map<string, ArtifactExecutorFn>();

export function registerArtifactExecutor(kind: string, executor: ArtifactExecutorFn) {
  _executorMap.set(kind, executor);
}

export function resolveArtifactExecutor(kind: string): ArtifactExecutorFn | undefined {
  return _executorMap.get(kind);
}
```

2. `chat-artifact-execution.ts`의 kind별 switch를 레지스트리 조회로 교체한다.

```typescript
// Before
case 'server-snapshot': return generateServerSnapshotArtifact(...);
case 'monitoring-analysis': ...

// After
const executor = resolveArtifactExecutor(artifactKind);
if (!executor) return null;
return executor(intent, options);
```

3. 모니터링 실행기를 등록 파일에 추가한다 (T2 등록 파일과 통합 가능).

**검증**: `chat-artifact-execution.test.ts` 기존 테스트 전체 통과, `type-check` 통과.

- [ ] T3 구현
- [ ] T3 테스트 통과 확인

---

### T4 — 참조용 문서 작성

**대상 파일**
- `docs/reference/architecture/ai/domain-portability.md` (신규)

**작업 내용**

이 프로젝트를 참조해 다른 AI 어시스턴트를 만들 때 필요한 정보를 정리한다.

```
포함 내용:
- 백엔드 AssistantDomain 플러그인 패턴 설명
- 새 도메인 추가 시 작성해야 할 5개 파일 목록
- 프론트엔드 레지스트리 등록 흐름 (T1~T3 결과 기반)
- 도메인 포팅 예시 (주식 도메인 / 코드 리뷰 도메인 쉘)
- 현재 기술 스택 (Next.js, Vercel AI SDK v6, Hono, BaseAgent 등)
```

- [ ] T4 문서 작성

---

## 작업 순서

```
T1 (타입 분리)
  ↓
T2 (렌더러 레지스트리) — T1 완료 후 착수
  ↓
T3 (실행기 레지스트리) — T1 완료 후 T2와 병렬 가능
  ↓
T4 (참조 문서) — T1~T3 완료 후 작성
```

---

## 변경 범위 요약

| 파일 | 변경 유형 | 비고 |
|------|-----------|------|
| `src/lib/ai/chat-artifacts/types.ts` | 수정 | 유니온 타입만 제거, 개별 인터페이스는 유지 |
| `src/lib/ai/domains/monitoring/artifact-registry.ts` | 수정 | 모니터링 유니온 타입 추가 |
| `src/lib/ai/domain-renderers/artifact-renderer-registry.ts` | 수정 | register/resolve API 추가 |
| `src/components/ai/domain-renderers/ArtifactRendererHost.tsx` | 수정 | switch → 레지스트리 조회 |
| `src/lib/ai/domains/monitoring/register-renderers.ts` | 신규 | 모니터링 렌더러 등록 |
| `src/lib/ai/chat-artifacts/artifact-executor-registry.ts` | 신규 | 실행기 레지스트리 |
| `src/hooks/ai/core/chat-artifact-execution.ts` | 수정 | switch → 레지스트리 조회 |
| `docs/reference/architecture/ai/domain-portability.md` | 신규 | 참조 문서 |

**백엔드(Cloud Run) 변경 없음.**

---

## 예상 공수

| 작업 | 예상 시간 |
|------|----------|
| T1 | 1~2시간 |
| T2 | 2~3시간 (테스트 포함) |
| T3 | 2~3시간 |
| T4 | 1~2시간 |
| **합계** | **6~10시간** |

---

## 주의사항

- `IncidentReportArtifact` 등 개별 인터페이스는 `types.ts`에 유지한다. 기존 임포트 경로를 깨지 않기 위함이다.
- T2 레지스트리는 모듈 사이드이펙트(등록 호출)에 의존한다. 등록 시점이 렌더 전에 보장되어야 하므로 앱 초기화 순서를 확인한다.
- 문서 예산 확인: `npm run docs:budget` — T4 신규 파일 추가 전 여유 확인 필요.
