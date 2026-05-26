# QA-20260526-0608 Codex Direct Retest

- Target: Vercel production `https://openmanager-ai.vercel.app/dashboard`
- Frontend: `8.12.46`
- Frontend commit: `fd0b0da6debd174ee30ba464c620907ee977a179`
- Frontend pipeline: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2552105899`
- AI Engine health: `status=ok`, `version=8.12.46`
- Method: Playwright MCP, guest session, AI sidebar
- Purpose: User-requested direct retest of recently fixed AI assistant improvements.

## Checks

### P4 / Q-NEW38 RCA Routing

Prompt:

```text
lb-haproxy-dc1-01 CPU가 높은 원인이 뭐야?
```

Observed result:

- Response rendered as `Cloud Run AI · 서버 실시간 데이터 분석`.
- Evidence panel rendered with `분석 근거`.
- Tool evidence rendered as `도구: 이상 징후 확인 · 기간: 최근 1시간`.
- The response corrected the live-data premise: `lb-haproxy-dc1-01의 CPU 사용률은 28%로, 임계값(80%) 대비 정상 범위`.
- The response continued with anomaly/RCA-style analysis for the detected memory anomaly and HAProxy causes.
- UI badge: `응답 느림`.

Verdict: PASS for the fixed routing behavior. The residual latency weakness remains, but exact latency was not measured in this retest.

### P13 / Q-NEW34 Multi-Metric 1:1 Comparison

Prompt:

```text
api-was-dc1-01과 api-was-dc1-02 CPU, 메모리, 디스크를 비교해줘
```

Observed result:

- Response title: `애플리케이션 서버 2대 CPU + 메모리 + 디스크 비교`.
- Evidence path rendered as `Cloud Run AI · 모니터링 도메인 근거`.
- Tool evidence rendered as `도구: monitoring-metric-current`.
- `api-was-dc1-01`: CPU 83%, memory 61%, disk 33%, warning.
- `api-was-dc1-02`: CPU 41%, memory 55%, disk 37%, online.
- UI badge: `응답 빠름`.

Verdict: PASS. The previous CPU-only regression did not reproduce.

## Network

Observed AI-related frontend requests during the retest:

- `POST /api/ai/wake-up` -> 200
- `POST /api/ai/nlq/extract-entities` -> 200
- `POST /api/ai/jobs` -> 201

## Result

Both directly retested recent improvements are working on production `v8.12.46`.
