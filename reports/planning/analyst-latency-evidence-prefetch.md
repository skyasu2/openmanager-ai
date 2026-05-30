> Owner: project
> Status: Approved
> Last reviewed: 2026-05-30

# Analyst Latency Evidence Prefetch Plan

- 상태: Approved
- 작성일: 2026-05-30
- TODO.md 연결: Active Tasks > Analyst evidence prefetch로 RCA 첫 LLM step 단축

## 목표

Analyst Agent의 전체/불특정 RCA 질의에서 첫 LLM step이 `detectAnomaliesAllServers` 호출 판단에 소비되는 지연을 줄인다. 라우팅이 Analyst로 확정된 뒤, LLM 호출 전에 전체 서버 anomaly scan을 결정론적으로 수행하고 압축 evidence를 system prompt의 기존 `domainEvidencePrompt` 슬롯에 주입한다.

## 범위

- 포함:
  - `detectAnomaliesAllServers` 내부 전체 서버 스캔 로직을 재사용 가능한 shared 함수로 추출
  - Analyst 사전 evidence prompt 빌더 추가
  - non-streaming `executeForcedRouting` 경로와 streaming `executeAgentStream` 경로의 Analyst evidence 주입
  - Analyst instructions에 "사전 evidence 제공 시 전체 스캔 재호출 금지" 규칙 추가
  - deterministic unit/contract tests 추가
- 제외:
  - `maxSteps` 하향
  - 도구 병렬화
  - provider 순서 변경
  - production 직접 배포 스크립트 실행

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-detect-all.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/analyst-evidence-prefetch.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts`
- 관련 test 파일

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|-----------|-------------|
| `runAllServerAnomalyScan` | `{ metricType, externalServers? }` | 기존 `detectAnomaliesAllServers.execute` 성공 payload와 동등 | 호출자가 catch 가능한 `Error` |
| `buildAnalystEvidencePrefetchPrompt` | 성공 scan payload | `string` | `undefined` 없음, 입력 payload 기준 deterministic |
| `maybeBuildAnalystEvidencePrefetchPrompt` | `{ agentName, existingPrompt? }` | `Promise<string \| undefined>` | 내부 오류는 log 후 `undefined` 반환 |
| `executeForcedRouting` | 기존 인자 | 기존 response 계약 유지 | prefetch 실패 시 기존 LLM tool-loop로 fallback |
| `executeAgentStream` | 기존 인자 | 기존 stream event 계약 유지 | prefetch 실패 시 기존 LLM tool-loop로 fallback |

### 테스트 시나리오 (구현 전 확정)

- [ ] 공유 스캔 동치성: `runAllServerAnomalyScan({ metricType: "all" })` 결과가 기존 tool execute 결과와 주요 계약 필드에서 동등하다.
- [ ] evidence prompt 포맷: prompt에 `Analyst precomputed anomaly evidence`, `anomalyCount`, `risingTrendScan`, `Do not call detectAnomaliesAllServers again`가 포함되고 길이가 제한된다.
- [ ] Analyst 게이트: `maybeBuildAnalystEvidencePrefetchPrompt`는 `Analyst Agent`에서만 prompt를 반환하고, 다른 agent나 기존 prefetch prompt가 있는 경우 반환하지 않는다.
- [ ] non-streaming 주입: Analyst forced routing system prompt에 prefetch prompt가 포함된다.
- [ ] streaming 주입: Analyst stream system prompt에 prefetch prompt가 포함된다.
- [ ] 실패 격리: prefetch 오류는 main response/stream을 실패시키지 않는다.

## Task 목록

- [ ] Task 0 — failing test 커밋: 위 테스트 시나리오를 구현 전 계약으로 추가
- [ ] Task 1 — shared scan 추출: tool execute가 `runAllServerAnomalyScan`을 재사용
- [ ] Task 2 — evidence prompt builder 추가: 압축 마크다운과 게이트/실패 격리 구현
- [ ] Task 3 — routing 주입: non-streaming/streaming Analyst 경로에 prefetch evidence 합류
- [ ] Task 4 — instructions 갱신: 사전 evidence가 있으면 전체 스캔 재호출 금지
- [ ] Task 5 — 검증/커밋: targeted tests, ai-engine type/test, root smoke/contract 필요 범위 실행

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1-4 | `feat:` | 예 | GitLab CI tag pipeline 기준 | 아니오 |
| Task 5 | `test(qa):` 또는 구현 커밋 포함 | 예 | GitLab CI 기준 | 아니오 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `cd cloud-run/ai-engine && npm run type-check` 통과
- [ ] `cd cloud-run/ai-engine && npm run test` 통과
- [ ] root `npm run test:contract` 통과
- [ ] root `npm run type-check`, `npm run lint`, `npm run test:quick` 또는 `npm run ci:local` 결과 보고
- [ ] GitLab push 시 pipeline id/status/url 보고
- [ ] QA 지연 before/after는 실제 배포 후 별도 QA record로 누적
