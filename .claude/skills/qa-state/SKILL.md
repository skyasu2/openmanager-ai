---
name: qa-state
description: 통합 QA 및 상태 분석 스킬. 최근 QA/런타임 상태를 진단하고(Triage), Vercel/로컬 환경에서 QA를 실행하여(Ops), 결과를 reports/qa에 누적 기록합니다(Tracking). state-triage + qa-ops를 순서대로 실행해야 할 때 사용.
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__lighthouse_audit
disable-model-invocation: true
---

# QA State (통합)

상태 진단 → QA 실행 → 기록을 한 번에 수행합니다. `state-triage` 후 `qa-ops`를 바로 이어야 할 때 사용하세요.

## Trigger Keywords

- "/qa-state"
- "현재 상태 점검해줘", "QA 실행해줘"
- "배포 후 정상인지 확인해줘", "로그 분석해줘"

## Workflow

### 1단계: 상태 진단 (Triage)

1. 증거 우선 로드.
- `npm run qa:status`
- `cat reports/qa/QA_STATUS.md`
- `cat reports/qa/qa-tracker.json | python3 -m json.tool | head -60`

2. AI provider 상태 확인 (AI 관련 장애 시).
- Cloud Run health: `curl -s https://ai-engine-490817238363.asia-northeast1.run.app/health`

3. 실패 유형 분류.
- `availability`: health fail, 5xx, env drift
- `logic-or-quality`: HTTP 200인데 내용/UI 잘못됨
- `latency-or-cold-start`: 첫 호출 지연, retry 후 회복
- `ai-provider-quota`: AI 빈 응답, rate limit

### 2단계: QA 실행 (Ops)

1. 환경 결정.
- AI 검증 필요: **Vercel Production + Playwright MCP**
- UI/레이아웃만: **로컬 dev 서버** (3000)
- 성능/메모리: **Chrome DevTools MCP**

2. 시나리오 수행.
- Core: landing → login → dashboard
- AI 필수: AI sidebar → chat → 분석 응답
- Parity 체크: `GET /api/health?service=parity` → slotIndex ±1 이내

### 3단계: 결과 기록 (필수)

- `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- JSON 편집 후: `npm run qa:record -- --input /tmp/qa-run-input.json`
- `npm run qa:status`

## Output Format

```text
QA State Report
- status: Healthy | Degraded | Broken
- symptom: <현상>
- run id: QA-YYYYMMDD-XXXX
- scope: smoke | targeted | broad
- checks: <total> (pass <n> / fail <n>)
- next: <code-fix | deploy-and-qa | wont-fix>
```

## Related Skills

- `state-triage` — 진단만 필요할 때
- `qa-ops` — QA 실행/기록만 필요할 때
- `env-sync` — env drift 의심 시
