> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant, monitoring, fact-pack, artifact, evidence-ui

# MonitoringFactPack Consumer Evidence UI Plan

- 상태: Completed
- 작성일: 2026-05-06
- TODO.md 연결: Active Tasks > `MonitoringFactPack consumer/evidence UI expansion`
- 출처: [archive/ai-assistant-architecture-evolution-plan.md](archive/ai-assistant-architecture-evolution-plan.md)의 "사실 경계 확장" Backlog 승격

## 목표

AI Engine이 이미 생성하는 `MonitoringFactPack`을 frontend monitoring artifact, evidence panel, download/export, deterministic answer-quality guard가 같은 사실 경계로 소비하게 한다.

핵심 계약은 다음과 같다.

- metric severity와 threshold 판단은 deterministic `MonitoringFactPack`이 책임진다.
- LLM/provider 출력은 explanation/formatting 전용으로 남긴다.
- `factPack`이 없는 기존 payload는 계속 렌더링되어야 한다.
- 신규 DB write, 신규 provider call, 신규 live telemetry backend는 만들지 않는다.

## 현재 상태

| 영역 | 파일 | 상태 |
|------|------|------|
| FactPack producer | `cloud-run/ai-engine/src/services/monitoring/monitoring-fact-pack.ts` | `sourceMode`, `queryAsOf`, `thresholds`, `summary`, `signals`, `evidenceRefs`를 deterministic하게 생성 |
| AI Engine type | `cloud-run/ai-engine/src/services/monitoring/monitoring-types.ts` | `MonitoringSnapshot.factPack?: MonitoringFactPack` 존재 |
| Frontend API type | `src/types/intelligent-monitoring.types.ts` | `riskSignals`, `evidenceRefs`는 있으나 `factPack` 없음 |
| Artifact parser | `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts` | Zod schema가 `factPack`을 검증/보존하지 않음 |
| Artifact metadata | `src/lib/ai/chat-artifacts/types.ts` | `ArtifactEvidence`는 public-safe 요약만 보존하며 full fact pack bridge 없음 |
| Evidence UI | `src/components/ai/MonitoringAnalysisArtifactCard.tsx` | `riskSignals`/`evidenceRefs` 직접 표시, fact-pack 우선순위 없음 |
| Monitoring page | `src/components/ai/pages/IntelligentMonitoringPage.tsx` | batch 결과를 `riskSignals` 기준으로 요약 |

## 범위

포함:

- `MonitoringBatchAnalysisResponse.factPack?: MonitoringBatchFactPack` 타입과 parser schema 추가
- `MonitoringBatchFactPack.signals`를 UI severity/ranking의 우선 source로 사용
- 기존 `riskSignals`/`evidenceRefs`는 backward-compatible fallback으로 유지
- artifact envelope metadata의 `evidence`에는 public-safe evidence summary만 매핑
- Monitoring artifact card 또는 공통 evidence panel에서 fact-pack signal/evidence를 표시
- JSON download/export에는 검증된 `factPack`을 포함하되 raw unsafe provider/tool payload는 포함하지 않음
- deterministic unit/contract test로 fact-pack 우선순위와 fallback을 고정

제외:

- AI Engine fact pack producer 재설계
- Supabase/RAG 저장소 변경
- 신규 LLM/provider 호출 또는 provider default 변경
- Cloud Run min instance, memory, CPU, live telemetry backend 변경
- Provider reasoning capability policy contract
- `/analyze-server`, `/incident-report` error contract 확장
- Streaming warmup `act(...)` warning cleanup

## 계약

### 변경 대상 파일

- `src/types/intelligent-monitoring.types.ts`
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`
- `src/lib/ai/chat-artifacts/types.ts`
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`
- `src/components/ai/ArtifactCards.test.tsx`
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.test.ts`
- 필요 시 `src/components/ai/pages/IntelligentMonitoringPage.tsx`
- 필요 시 `tests/ai` 또는 기존 artifact/eval test 경로

### 입출력 계약

| 항목 | 입력 | 출력/동작 | 에러 케이스 |
|------|------|-----------|-------------|
| `parseMonitoringBatchAnalysisResponse` | `unknown` Cloud Run/BFF `data` | `factPack`이 valid이면 typed response에 보존 | malformed `factPack`은 drop하고 legacy `riskSignals/evidenceRefs` parse를 유지 |
| `summarizeMonitoringAnalysis` | `MonitoringBatchAnalysisResponse` | `factPack.signals.length`를 위험 신호 수의 우선값으로 사용, 없으면 `riskSignals.length` fallback | `factPack` 없음은 정상 |
| `generateMonitoringAnalysisArtifact` | `/api/ai/intelligent-monitoring` success response | artifact `analysis.factPack` 보존, envelope `evidence`는 sanitized summary만 포함 | raw provider/tool payload는 metadata에 저장하지 않음 |
| `MonitoringAnalysisArtifactCard` | `MonitoringAnalysisArtifact` | fact-pack signals/evidence를 우선 렌더링, legacy payload fallback 유지 | `dangerouslySetInnerHTML`, renderer-side fetch/useEffect 금지 |
| JSON download | `MonitoringAnalysisArtifact` | 검증된 `artifact.analysis` JSON 포함 | fact-pack bridge가 secret-like string, raw error stack, provider token을 새로 포함하지 않아야 함 |

### Type Contract

Frontend public-safe subset은 AI Engine producer contract를 그대로 복제하되, frontend에서 필요한 필드만 명시한다.

```ts
type MonitoringBatchFactPack = {
  factPackVersion: string;
  dataSlot: string;
  sourceMode: 'replay-json' | 'live-otel';
  queryAsOf: string;
  thresholds: Record<'cpu' | 'memory' | 'disk' | 'network', {
    warning: number;
    critical: number;
  }>;
  summary: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  signals: Array<{
    id: string;
    serverId: string;
    serverName: string;
    serverType: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    value: number;
    threshold: number;
    thresholdLevel: 'warning' | 'critical';
    severity: 'warning' | 'critical';
    evidenceRefId?: string;
  }>;
  evidenceRefs: MonitoringBatchEvidenceRef[];
};
```

### UI/보안 제약

- Evidence renderer는 payload만 표시한다. 자체 `fetch`, `useEffect`, provider call 금지.
- `dangerouslySetInnerHTML` 금지.
- 표시 문자열은 기존 React escaping에 맡기고, metadata bridge는 기존 `readPublicString` redaction 범위를 통과한 public-safe summary만 사용한다.
- 카드 안에 중첩 카드 UI를 만들지 않고 기존 compact operational layout을 유지한다.
- 화면 copy는 fact source를 노출하되 사용법 설명문을 길게 추가하지 않는다.

### 비용/배포 제약

- 로컬 deterministic tests는 외부 LLM/네트워크 호출 금지.
- Cloud Run producer가 이미 `factPack`을 반환하므로 frontend-only 변경을 기본 가정한다.
- BFF가 `factPack`을 drop하는 것으로 확인될 때만 API pass-through 수정 여부를 별도 판단한다.
- production QA가 필요하면 Vercel 배포 후 artifact card/evidence surface targeted QA 1회로 제한한다.

## 테스트 시나리오

구현 전 아래 failing spec을 먼저 작성한다.

- [ ] Parser: valid `factPack` 포함 batch response를 parse하고 `factPack.signals/evidenceRefs`를 보존한다.
- [ ] Parser: malformed `factPack.signals[*].severity`는 `factPack`만 drop하고 legacy `riskSignals/evidenceRefs` parse를 유지한다.
- [ ] Artifact: `generateMonitoringAnalysisArtifact`가 `factPack`을 보존하고 envelope `evidence`에는 public-safe evidence summary만 매핑한다.
- [ ] UI: artifact card는 `factPack.signals`가 있으면 이를 위험 신호 count/list의 우선 source로 표시한다.
- [ ] UI fallback: `factPack`이 없는 legacy artifact는 기존 `riskSignals/evidenceRefs`로 동일하게 렌더링한다.
- [ ] Export: JSON download payload에는 validated `factPack`이 포함되고 fact-pack bridge가 raw unsafe metadata를 새로 추가하지 않는다.
- [ ] Eval/contract: displayed severity/ranking은 `factPack.signals`의 severity/threshold를 따른다.

## Task 목록

- [x] Task 0 — failing spec 작성 및 현재 실패 확인
  - 완료 기준: 위 테스트 시나리오 중 parser/artifact/UI 우선순위 spec이 구현 전 실패한다.
- [x] Task 1 — frontend type/schema와 artifact evidence bridge 구현
  - 완료 기준: `MonitoringBatchFactPack` 타입, Zod schema, sanitized envelope evidence mapping이 통과한다.
- [x] Task 2 — evidence UI fact-pack 우선 렌더링
  - 완료 기준: fact-pack signal/evidence 표시와 legacy fallback test가 통과한다.
- [x] Task 3 — deterministic eval/contract guard 추가
  - 완료 기준: severity/ranking source가 fact-pack임을 fixture 기반 test로 고정한다.
- [x] Task 4 — 검증, 코드리뷰, QA 판단
  - 완료 기준: targeted tests, `type-check`, `lint`, `test:quick`, 필요 시 `test:contract`, docs checks 통과. production QA 필요 여부 기록.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec): monitoring factpack consumer evidence ui specs` | 선택 | 아니오 | 아니오 |
| Task 1~3 | `feat: monitoring factpack consumer evidence ui` | 예 | 기본 아니오 | frontend QA 필요 시 예 |
| Task 4 | `test(qa): monitoring factpack evidence ui validation` 또는 TODO 완료 커밋 | 예 | API 변경 시만 | targeted QA 필요 시 예 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 후 | failing spec이 deterministic severity contract를 정확히 표현하는지 |
| Task 1 후 | parser가 unsafe raw payload를 넓히지 않는지, backward compatibility가 유지되는지 |
| Task 2 후 | UI가 fact source를 명확히 보여주되 과도한 설명/중첩 카드 없이 렌더링하는지 |
| Task 3 후 | eval guard가 LLM/provider 호출 없이 CI에서 deterministic하게 동작하는지 |
| 완료 전 | frontend-only 변경인지, 배포/QA 범위가 free-tier에 맞는지 |

## 완료 기준

- [x] TODO.md Active Task가 Completed 이력으로 이동한다.
- [x] plan 파일 Status가 Completed로 변경되고 archive로 이동한다.
- [x] fact-pack 포함 artifact와 legacy artifact가 모두 테스트로 보호된다.
- [x] 코드리뷰에서 보안, 비용, backward compatibility blocker가 없다.
- [x] QA tracker에 production targeted QA 필요 여부 또는 생략 사유가 기록된다.

## Completion Log

완료일: 2026-05-06

- Plan approval commit: `7ee1b3aff docs(planning): approve monitoring factpack evidence UI plan`
- Failing spec commit: `de9db6512 test(spec): add monitoring factpack consumer evidence specs`
- Implementation commit: `cc301affd feat(ai): consume monitoring factpack evidence in artifacts`
- QA record commit: `1a410e083 test(qa): record monitoring factpack evidence validation`
- QA run: [QA-20260506-0417](../../qa/runs/2026/qa-run-QA-20260506-0417.json)
- Production targeted QA: skipped. No Vercel or Cloud Run deployment was performed; Cloud Run producer contract was unchanged and this task only changed frontend parser/artifact/UI consumers.

Validation:

- `npx vitest run src/lib/ai/chat-artifacts/monitoring-analysis-artifact.test.ts src/components/ai/ArtifactCards.test.tsx`
- `npm run type-check`
- `npm run lint`
- `npm run test:quick`
- `npm run test:contract`
- `git diff --check`
