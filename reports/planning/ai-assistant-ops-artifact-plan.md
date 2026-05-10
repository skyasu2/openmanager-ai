> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-10
> Tags: ai-assistant, artifact, runbook, alerting, ops

# AI Assistant Operational Artifact Plan

- 상태: Approved
- 작성일: 2026-05-10
- TODO.md 연결: Backlog > AI Assistant operational artifact hardening
- 관련 계획: [ai-chat-ux-improvement-plan.md](ai-chat-ux-improvement-plan.md), [ai-assistant-general-coding-boundary-plan.md](ai-assistant-general-coding-boundary-plan.md)
- 근거 테스트: AI 어시스턴트 스크립트 테스트 3건

## 목표

AI Assistant가 운영 스크립트, 알림 규칙, 로그 기반 대응 절차를 자유 텍스트 채팅이 아니라 구조화된 artifact로 생성·보존·수정하도록 한다.

현재 문제는 단순 응답 품질 문제가 아니라 산출물 계약 부재다.

1. `CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘`가 metrics 질의로 라우팅된다.
2. 명시적으로 스크립트를 요청하면 `filterServers` 같은 실제 bash에 없는 가상 함수를 생성한다.
3. `이 스크립트에서 임계치를 90%로 바꿔줘`가 기존 코드 수정이 아니라 새 metrics 질의로 재해석된다.
4. 로그 에러/경고 조회, RCA, 명령어 추천 도구는 존재하지만 "원인 → 대응 순서 → 확인 명령어"를 재사용 가능한 runbook 형태로 고정하지 못한다.

## 웹/외부 기준

- Vercel AI SDK는 tool input schema 검증과 tool result 기반 UI 렌더링을 공식 패턴으로 제공한다.
  - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
  - https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- Slack Incoming Webhook은 JSON POST 방식이며 webhook URL은 secret으로 취급해야 한다.
  - https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
- Prometheus는 alert rule과 Alertmanager receiver/routing을 분리한다. 운영 알림은 임시 polling script보다 Alertmanager 설정이 기본값이다.
  - https://prometheus.io/docs/prometheus/2.53/configuration/alerting_rules/
  - https://prometheus.io/docs/alerting/latest/alertmanager/
- Google SRE Workbook은 incident response를 구조화된 절차, 기록, 역할, 대응 흐름으로 관리할 것을 권장한다.
  - https://sre.google/workbook/incident-response/
  - https://sre.google/workbook/monitoring/

## 범위

- 포함:
  - 신규 logical artifact: 운영 절차 산출물
  - 물리 artifact kind는 `ops-procedure` 하나로 시작하고, 내부 `procedureType`으로 `runbook`, `alert-rule`, `script`를 구분
  - 운영 스크립트/Slack webhook/PromQL/Alertmanager/runbook intent 라우팅
  - script/runbook 생성 시 실제 데이터 소스와 안전성 검증
  - 이전 artifact를 대상으로 한 후속 수정 요청 처리
  - 로그 에러/경고 기반 대응 절차 artifact 생성
  - artifact workspace 저장/복원/비교와 기존 envelope 계약 연결
- 제외:
  - 범용 코딩 assistant 구현
  - Python/Node 실행기, shell 실행 sandbox, 원격 명령 실행 기능
  - 실제 Slack webhook 호출
  - Prometheus/Alertmanager 운영 배포 자동화
  - 외부 비용이 발생하는 실 LLM 자동 QA

## 아키텍처

```text
User Query
  |
  v
Intent Boundary
  |-- general coding        -> deterministic guard
  |-- current metric query   -> metrics tools
  |-- command guidance       -> recommendCommands
  |-- ops procedure request  -> ops-procedure artifact
                              |
                              v
                    evidence pack
                    - metrics
                    - logs
                    - KRL command/runbook hits
                    - current alerts
                              |
                              v
                    structured artifact schema
                              |
                              v
                    validators
                    - no fake functions
                    - no hardcoded secrets
                    - executable flag is honest
                    - safety level assigned
                              |
                              v
                    renderer / workspace / follow-up edit
```

## 계약 (Contract)

### 변경 대상 파일

예상 변경 범위다. Task 0에서 실제 import/use path를 다시 확인한다.

- `src/lib/ai/chat-artifacts/types.ts`
- `src/lib/ai/chat-artifacts/artifact-workspace-registry.ts`
- `src/lib/ai/domains/monitoring/artifact-registry.ts`
- `src/lib/ai/domain-renderers/artifact-renderer-registry.ts`
- `src/components/ai/domain-renderers/ArtifactRendererHost.tsx`
- `src/components/ai/OpsProcedureArtifactCard.tsx` 신규
- `src/components/ai/ArtifactCards.test.tsx`
- `src/app/api/ai/artifact-intent/route.ts`
- `src/hooks/ai/core/useQueryExecution.ts`
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/server-logs.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/rca-analysis.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-catalog.ts`
- 관련 테스트: artifact registry, route decision, supervisor routing, chat follow-up edit, renderer

### Artifact shape

```ts
interface OpsProcedureArtifact extends ArtifactContractMetadata {
  kind: 'ops-procedure';
  generatedAt: string;
  title: string;
  summary: string;
  procedureType: 'runbook' | 'alert-rule' | 'script';
  source: 'tool-result' | 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  inputs: {
    metric?: 'cpu' | 'memory' | 'disk' | 'network';
    threshold?: number;
    serverScope?: 'all' | 'group' | 'server';
    serverId?: string;
    group?: string;
    timeWindowMinutes?: number;
    notificationTarget?: 'slack-webhook' | 'none';
  };
  evidence: ArtifactEvidence[];
  runbook: {
    symptoms: string[];
    likelyCauses: string[];
    responseSteps: string[];
    validationSteps: string[];
    rollbackOrStopConditions: string[];
    limitations: string[];
  };
  codeBlocks: Array<{
    id: string;
    title: string;
    language: 'bash' | 'yaml' | 'promql' | 'markdown';
    content: string;
    executable: boolean;
    requiredEnv: string[];
    safetyLevel: 'read-only' | 'notification-only' | 'mutating';
    notes: string[];
  }>;
  validation: {
    noFakeFunctions: boolean;
    noHardcodedSecrets: boolean;
    requiresManualReview: boolean;
  };
}
```

### 입력 경계

| 입력 | 기대 라우팅 | 기대 결과 |
|------|-------------|-----------|
| `CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘` | `ops-procedure` / `script` | metrics evidence 포함, fake 함수 없는 bash 또는 `executable=false` 명시 |
| `CPU 80% 이상 서버 Slack 알림 Alertmanager 설정 만들어줘` | `ops-procedure` / `alert-rule` | Prometheus rule + Alertmanager receiver YAML artifact |
| `이 스크립트에서 임계치를 90%로 바꿔줘` | 기존 artifact edit | 새 metrics 질의가 아니라 artifact threshold/codeBlock 수정 |
| `로그 중 에러/경고 보고 원인과 대응 순서 알려줘` | `ops-procedure` / `runbook` | 관련 로그, 원인 후보, 대응 순서, 검증 명령어 artifact |
| `파이썬 피보나치 코드 짜줘` | general coding guard | ops artifact로 승격 금지 |
| `지금 CPU 높은 서버 TOP 3` | metrics | artifact 생성 금지 |

### 출력 계약

- Slack webhook URL은 하드코딩하지 않는다. `SLACK_WEBHOOK_URL` 같은 환경변수 placeholder만 허용한다.
- codeBlock에 `filterServers`, `getServerMetricsAdvanced` 같은 내부 tool/function 이름을 실행 가능한 shell처럼 출력하지 않는다.
- 실제 실행 가능한 데이터 소스가 없으면 `executable=false`와 제한 사항을 명시한다.
- 운영 알림 산출물은 기본적으로 Alertmanager/Prometheus 설정을 우선 제안하고, bash polling은 fallback 또는 예시로 제한한다.
- 위험한 명령(`rm`, service restart, package cleanup 등)은 `safetyLevel='mutating'`로 표시하고 자동 실행 기능과 연결하지 않는다.
- artifact evidence는 public-safe summary만 보존하고 secret/token/raw webhook URL은 저장하지 않는다.

## 테스트 시나리오

- [ ] `artifact type`: `ops-procedure`가 `ChatArtifact`, envelope, workspace registry, renderer registry를 통과한다.
- [ ] `intent`: Slack/bash/webhook/script/runbook/Alertmanager 요청은 metrics보다 먼저 `ops-procedure`로 분류된다.
- [ ] `no fake function`: Slack bash script artifact에 `filterServers(`, `getServerMetrics`, `searchKnowledgeBase` 같은 내부 tool call이 포함되지 않는다.
- [ ] `secret safety`: Slack webhook URL 예시가 실제 URL literal을 저장하지 않고 `SLACK_WEBHOOK_URL` placeholder만 사용한다.
- [ ] `follow-up edit`: `이 스크립트에서 임계치를 90%로 바꿔줘`가 직전 `ops-procedure.inputs.threshold`와 codeBlock을 갱신한다.
- [ ] `log runbook`: warning/error log 질의가 `getServerLogs` 또는 monitoring data source evidence를 포함한 runbook artifact를 만든다.
- [ ] `non-artifact guard`: `지금 CPU 높은 서버 TOP 3`와 일반 coding guard 케이스는 `ops-procedure`로 승격되지 않는다.
- [ ] `renderer`: card에서 목적, 입력, 증거, 코드, 검증/제한 사항, 복사/다운로드 동작이 깨지지 않는다.

## Task 목록

> Status가 Approved이므로 구현 착수 가능하다. 단, 현재 Active의 AI Chat UI/UX 작업이 같은 renderer/markdown 컴포넌트를 수정하므로 충돌 여부를 Task 0에서 먼저 확인한다.

- [ ] Task 0 — failing regression tests 추가
  - routing, artifact schema, renderer, follow-up edit, script validator 실패 케이스를 먼저 고정
- [ ] Task 1 — `ops-procedure` artifact contract 추가
  - `types.ts`, schema/workspace/renderer registry, unsupported fallback 유지
- [ ] Task 2 — intent/routing 우선순위 보강
  - script/bash/slack/webhook/alertmanager/runbook/log-response intent를 metrics보다 앞에 배치
  - 일반 coding guard와 운영 코드 예외가 충돌하지 않도록 테스트 고정
- [ ] Task 3 — generator/evidence/validator 구현
  - metrics/log/KRL evidence pack 구성
  - fake function, hardcoded secret, executable honesty validator 추가
  - Alertmanager YAML 우선, bash fallback 원칙 적용
- [ ] Task 4 — renderer/workspace/follow-up edit 연결
  - `OpsProcedureArtifactCard`
  - threshold 수정 같은 follow-up artifact patch 처리
  - copy/download/replay pack 비교 동작 확인
- [ ] Task 5 — 문서/QA 기록
  - QA template 또는 run notes에 ops artifact 시나리오 추가 여부 판단
  - local deterministic QA 기록
  - 배포 후 Vercel conversational QA에서 script/log/runbook 5문항 검증

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1 | `feat(ai):` | 예 | 아니오 | 예 |
| Task 2 | `fix(ai):` | 예 | 예 | 변경 시 |
| Task 3 | `feat(ai):` | 예 | 예 | 변경 시 |
| Task 4 | `feat(ai):` | 예 | 아니오 | 예 |
| Task 5 | `chore(qa):` | 예 | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 실제 QA 문제 3건과 log/runbook 요구를 정확히 재현하는지 |
| Task 1 완료 후 | artifact kind 추가가 기존 incident/monitoring/server-snapshot restore를 깨지 않는지 |
| Task 2 완료 후 | metrics ranking, command guidance, general coding guard와 routing 충돌 여부 |
| Task 3 완료 후 | secret redaction, fake function 차단, executable flag 정직성 |
| Task 4 완료 후 | 코드블록 렌더링, 복사/다운로드, replay pack compatibility |
| 전체 완료 후 | Vercel QA에서 script/log/runbook artifact가 실제로 생성·수정되는지 |

## 위험 및 대응

| 위험 | 대응 |
|------|------|
| artifact kind 증가로 renderer/restore 회귀 | schema registry contract test를 먼저 추가 |
| 운영 스크립트를 실제 실행 가능한 것처럼 과장 | `executable` flag와 limitations를 필수화 |
| Slack webhook secret 노출 | URL literal redaction + placeholder-only test |
| metrics 질의가 artifact로 과승격 | non-artifact guard 테스트 고정 |
| 현재 AI Chat UX 작업과 파일 충돌 | Task 0에서 변경 파일 diff 확인 후 renderer 작업 순서 조정 |
| Cloud Run 비용/쿼터 증가 | deterministic route/validator 우선, 실 LLM QA는 수동/최종 단계로 제한 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run test:quick` 통과
- [ ] AI/API 계약 변경 범위에 대해 `npm run test:contract` 통과
- [ ] Cloud Run 변경 시 `cd cloud-run/ai-engine && npm run type-check` 통과
- [ ] Cloud Run 변경 시 `cd cloud-run/ai-engine && npm run test` 또는 targeted equivalent 통과
- [ ] QA 기록 생성
- [ ] Production QA에서 script/log/runbook artifact 5문항 중 fail 0건
