> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-19
> Tags: qa,latency,ai,observability

# AI Latency Rollup Plan

- 작성일: 2026-04-19
- TODO.md 연결: Active Tasks > AI latency rollup 리포트 (`avg/p95` by agent/provider)

## 목표

QA tracker에 구조화된 AI latency observation을 추가하고, `QA_STATUS.md` 및 `latest-qa-trends.json`/`QA_TRENDS.md`에서 최근 24시간 기준 `agent/provider`별 `avg/p95` latency를 바로 읽을 수 있게 한다.

## 범위

- 포함:
  - `qa:record` 입력 JSON에 `aiLatencyObservations` 스키마 추가
  - tracker run 저장 구조에 structured latency observation 반영
  - `qa-trends` snapshot에 최근 24h latency rollup 추가
  - `QA_STATUS.md`와 `QA_TRENDS.md`에 latency rollup 섹션 추가
  - 템플릿/README/테스트 갱신
- 제외:
  - 기존 historical run free-form note 파싱/backfill
  - 실제 production 재QA 실행 및 latency 실측 수집
  - Langfuse/Vercel/Cloud Run 외부 API 연동 자동 수집

## 계약 (Contract)

### 변경 대상 파일

- `reports/qa/templates/qa-run-input.example.json`
- `reports/qa/README.md`
- `scripts/qa/qa-record-normalizers.js`
- `scripts/qa/record-qa-run.js`
- `scripts/qa/qa-tracker-run-apply.js`
- `scripts/qa/qa-trends.js`
- `scripts/qa/qa-status-markdown.js`
- `tests/unit/qa/qa-trends.test.ts`
- `tests/unit/qa/qa-scripts.test.ts`

### 입력 스키마

`aiLatencyObservations?: Array<{
  surface: string;
  agent: string;
  provider: string;
  model?: string;
  route?: string;
  source?: string;
  latencyMs: number;
  ttfbMs?: number;
  processingTimeMs?: number;
}>`

- `surface`, `agent`, `provider`, `latencyMs`는 필수
- `latencyMs`, `ttfbMs`, `processingTimeMs`는 0 이상의 수치만 허용
- run의 `recordedAt`을 observation 시각 anchor로 사용하며, observation별 timestamp는 이번 slice 범위에서 추가하지 않음

### 출력 계약

- run JSON과 tracker `runs[]`는 `aiLatencyObservations` 배열을 그대로 보존
- `qa-trends` snapshot은 `aiLatencyRollup24h`를 추가
- rollup은 최신 recorded run 시각을 anchor로 최근 24시간 window를 계산
- bucket key는 `agent + provider`
- 각 bucket은 최소 아래 필드를 가진다
  - `agent`, `provider`
  - `sampleCount`
  - `runCount`
  - `countedRunCount`
  - `avgLatencyMs`, `p95LatencyMs`
  - `avgTtfbMs`, `p95TtfbMs`
  - `avgProcessingTimeMs`, `p95ProcessingTimeMs`
  - `latestRunId`, `latestRecordedAt`

### 테스트 시나리오

- [ ] `qa-trends`가 최근 24h observation만 집계하고 `agent/provider`별 `avg/p95`를 계산한다
- [ ] `qa-trends` markdown/json이 latency rollup 섹션을 출력한다
- [ ] `qa:record`가 `aiLatencyObservations`를 run JSON과 tracker에 보존한다
- [ ] `qa:status`가 latest dashboard에 latency rollup 섹션을 출력한다
- [ ] malformed observation(`latencyMs<0`, missing required field)은 입력 단계에서 거부한다

## Task 목록

- [x] Task 0 — failing test: `qa-trends` / `qa-scripts` latency rollup 계약 추가
- [x] Task 1 — normalizer + record/tracker schema 반영
- [x] Task 2 — `qa-trends` snapshot/markdown rollup 구현
- [x] Task 3 — `QA_STATUS` latency section 구현
- [x] Task 4 — 템플릿/README 문서 반영
- [x] Task 5 — targeted tests + `npm run qa:status -- --write` 검증

## 완료 기준

- [x] `tests/unit/qa/qa-trends.test.ts` 통과
- [x] `tests/unit/qa/qa-scripts.test.ts` 통과
- [x] `npm run qa:status -- --write` 통과
- [x] TODO.md Active/Completed 상태 갱신
