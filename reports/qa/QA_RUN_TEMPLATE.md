# QA Run Template (AI Agent Reference)

> AI 에이전트(Claude, Codex, Gemini)가 QA 실행 후 결과를 기록할 때 참조하는 템플릿.
> SSOT: `scripts/qa/record-qa-run.js` | 상태: `reports/qa/QA_STATUS.md`

## 실행 명령어

```bash
npm run qa:record -- --input <qa-run-input.json>
# 예: npm run qa:record -- --input /tmp/qa-run.json
```

실행 후 자동 생성: run JSON (`reports/qa/runs/YYYY/qa-run-QA-YYYYMMDD-NNNN.json`), tracker 갱신, `QA_STATUS.md` 갱신.

## 환경 요구사항

| 항목 | 기본값 | 비고 |
|------|--------|------|
| Frontend | Vercel Production (`openmanager-ai.vercel.app`) | AI 기능 검증 필수 |
| Backend | Cloud Run AI Engine | Cold start 최대 45s |
| 검증 도구 | Playwright MCP | `source: "playwright-mcp"` |
| 로컬 QA | 허용 (UI/레이아웃/인증만) | AI 기능 제외 |

## JSON Schema (필수/선택)

```jsonc
{
  // === 필수 ===
  "runTitle": "string",           // QA 실행 제목
  "owner": "string",             // "claude" | "codex" | "gemini" | "human"
  "checks": {
    "passed": 0,                  // 통과한 체크 수
    "failed": 0,                  // 실패한 체크 수
    "total": 0                    // 선택 (미지정 시 passed+failed)
  },

  // === 선택 ===
  "source": "string",            // "playwright-mcp" | "manual" | "script"
  "environment": {               // 실행 환경 메타데이터
    "frontend": "Vercel Production",
    "backend": "Cloud Run",
    "branch": "main"
  },
  "usageChecks": [               // 실환경 사용량 확인 근거
    {
      "platform": "vercel",
      "method": "cli",           // "cli" | "manual-dashboard" | "api"
      "status": "checked",       // "checked" | "skipped" | "failed"
      "checkedAt": "ISO-8601",
      "summary": "빌드/함수/대역폭 급증 없음",
      "evidence": "npm run check:usage:vercel",
      "url": "https://vercel.com/dashboard"
    }
  ],
  "completedImprovements": [],   // 완료된 개선 항목
  "pendingImprovements": [],     // 미완료 개선 항목
  "dodChecks": [],               // DoD 체크리스트 (grouped items 지원)
  "expertAssessments": [],       // 전문가 영역 평가 (6개 도메인)
  "notes": ["string"],           // 참고사항
  "links": [{ "label": "", "url": "" }]  // 관련 링크
}
```

## Improvement 항목 스키마

`completedImprovements`, `pendingImprovements` 배열 내 각 항목:

```jsonc
{
  "id": "string",               // 선택 (미지정 시 title에서 slugify)
  "title": "string",            // 필수
  "priority": "P0-P5",          // 선택 (기본 P2)
  "isBlocking": true,           // 선택 (기본: P0/P1=true, P2+=false)
  "evidence": "string",         // 검증 근거
  "note": "string",             // 추가 메모
  "owner": "string",            // 담당자
  "overengineeringScope": ""    // 과도 개선 범위 설명
}
```

## isBlocking 정책 (자동 처리)

| priority | isBlocking 미지정 시 | 결과 status |
|----------|---------------------|-------------|
| P0, P1 | `true` (기본) | pending 유지 |
| P0, P1 | 명시적 `false` | `deferred` |
| P2+ | `false` (기본) | `wont-fix` (자동) |
| P2+ | 명시적 `true` | pending 유지 |

**핵심 규칙**: P2 비차단 항목은 "포트폴리오 운영성 우선" 규칙으로 자동 WONT-FIX 처리.
과도한 개선을 방지하기 위한 정책이므로, 즉시 수정이 필요하면 `isBlocking: true`를 명시.

## Expert Assessment (6개 도메인)

```jsonc
{
  "expertAssessments": [
    {
      "domainId": "ai-quality-assurance",        // 필수
      "domainName": "AI Quality Assurance Specialist", // 선택 (catalog에서 자동 매칭)
      "fit": "appropriate",                      // "appropriate" | "partially-appropriate" | "inappropriate"
      "improvementNeeded": false,                // 선택 (fit != appropriate이면 true)
      "rationale": "검증 근거 설명",               // 판단 이유
      "nextAction": ""                           // 다음 액션 (improvementNeeded=true일 때)
    }
  ]
}
```

| domainId | domainName | 평가 기준 |
|----------|-----------|----------|
| `ai-quality-assurance` | AI Quality Assurance Specialist | AI Chat/Reporter/Analyst 응답 품질, 신뢰도 |
| `observability-monitoring` | IT Monitoring & Observability SME | Health API, 메트릭 갱신, 토폴로지 렌더링 |
| `ai-security-reliability` | AI Security & Reliability Architect | 인증, 보안 차단, prompt injection 방어 |
| `sre-devops` | DevOps / SRE Engineer | 배포 상태, 번들 크기, 성능, Free Tier 준수 |
| `test-automation` | Test Automation Architect | E2E 커버리지, 테스트 안정성 |
| `data-metrics-quality` | Data Quality & Metrics Analyst | OTel 데이터 무결성, 메트릭 현실성 |

## Usage Check 스키마

```jsonc
{
  "usageChecks": [
    {
      "platform": "vercel",              // 필수
      "method": "cli",                   // 선택, 기본 "manual-dashboard"
      "status": "checked",               // 선택, "checked" | "skipped" | "failed"
      "checkedAt": "2026-03-19T09:20:00+09:00",
      "summary": "빌드/함수/대역폭 급증 없음",
      "evidence": "npm run check:usage:vercel",
      "url": "https://vercel.com/dashboard"
    }
  ]
}
```

- Vercel 실환경 QA/배포 뒤에는 `usageChecks`에 최소 1건 남기는 것을 권장합니다.
- CLI가 불가능하면 `method: "manual-dashboard"`로 수동 확인 결과를 기록합니다.

## Normalization 규칙 (스크립트 자동 처리)

- **id**: title에서 slugify. KNOWN_VERIFICATIONS 패턴 매칭 시 stable id로 통합
- **priority**: `P0`~`P5` 정규화. 유효하지 않으면 `P2`
- **dodChecks**: `{ items: [...] }` 그룹 형태와 flat 항목 모두 지원
- **중복 id**: completed > pending > deferred > wont-fix 우선순위로 최종 status 결정
- **evidence**: title 내 `(...)` 괄호 내용 자동 추출 후 evidence에 병합

## 최소 QA Run JSON 예시

```json
{
  "runTitle": "Production smoke test",
  "owner": "codex",
  "checks": { "passed": 5, "failed": 0 },
  "usageChecks": [
    {
      "platform": "vercel",
      "method": "manual-dashboard",
      "status": "checked",
      "summary": "실환경 smoke 후 추가 비용 징후 없음"
    }
  ],
  "completedImprovements": [
    { "title": "Health API 200 정상" },
    { "title": "대시보드 15서버 렌더링" }
  ]
}
```

## 전체 QA Run JSON 예시

```json
{
  "runTitle": "Production 종합 QA - Frontend/AI/Performance 검증",
  "owner": "claude",
  "source": "playwright-mcp",
  "environment": {
    "frontend": "Vercel Production",
    "backend": "Cloud Run",
    "branch": "main"
  },
  "checks": { "total": 17, "passed": 16, "failed": 1 },
  "usageChecks": [
    {
      "platform": "vercel",
      "method": "cli",
      "status": "checked",
      "summary": "현재 billing period 기준 추가 비용 징후 없음",
      "evidence": "npm run check:usage:vercel"
    }
  ],
  "expertAssessments": [
    {
      "domainId": "ai-quality-assurance",
      "fit": "appropriate",
      "improvementNeeded": true,
      "rationale": "Reporter/Analyst 정상, Chat 빈 응답",
      "nextAction": "Chat supervisor 응답 품질 개선"
    },
    {
      "domainId": "observability-monitoring",
      "fit": "appropriate",
      "improvementNeeded": false,
      "rationale": "Health API healthy, 15대 메트릭 정상"
    },
    {
      "domainId": "sre-devops",
      "fit": "appropriate",
      "improvementNeeded": false,
      "rationale": "Vercel READY, 번들 219KB, Free Tier 준수"
    },
    {
      "domainId": "ai-security-reliability",
      "fit": "appropriate",
      "improvementNeeded": false,
      "rationale": "auth_proof 쿠키 정상, prompt injection 차단"
    },
    {
      "domainId": "test-automation",
      "fit": "appropriate",
      "improvementNeeded": false,
      "rationale": "Playwright MCP 17개 체크 포인트 커버"
    },
    {
      "domainId": "data-metrics-quality",
      "fit": "appropriate",
      "improvementNeeded": false,
      "rationale": "OTel 데이터 200 OK, 메트릭 현실적"
    }
  ],
  "completedImprovements": [
    {
      "id": "health-all-connected",
      "title": "Health API 전체 서비스 connected",
      "priority": "P0",
      "isBlocking": true,
      "evidence": "DB 2ms, Cache 1ms, AI 1ms"
    },
    {
      "id": "dashboard-15-servers",
      "title": "대시보드 15대 서버 모니터링 정상",
      "priority": "P0",
      "isBlocking": true,
      "evidence": "온라인 13, 경고 1, 위험 1"
    }
  ],
  "pendingImprovements": [
    {
      "title": "AI Chat 응답 품질 개선",
      "priority": "P1",
      "isBlocking": true,
      "evidence": "빈 응답 반환"
    }
  ],
  "notes": ["Chat만 빈 응답 - Reporter/Analyst는 정상"],
  "links": [
    { "label": "Production", "url": "https://openmanager-ai.vercel.app" }
  ]
}
```
