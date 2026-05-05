> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-05
> Tags: qa,vercel,dashboard,ai-assistant,rag,web-search,auth,reporter

# v8.11.97 Broad QA Remediation Plan

- 상태: In Progress
- 작성일: 2026-05-05
- TODO.md 연결: Active Tasks > v8.11.97 broad QA remediation
- 근거 QA: `QA-20260505-0407` (`v8.11.97`, commit `1bdb98f4dae04032d9d3c94ab2271e9ac9c38bb2`)

## 목표

Vercel Playwright MCP broad QA에서 확인된 pending 개선 5건을 작은 코드 보정과 회귀 테스트로 정리한다. 새 provider, 새 DB write, 인프라 증설, Cloud Run 리소스 증설은 포함하지 않는다.

## 문제 목록과 원인 분석

| ID | 우선순위 | 증상 | 원인 판단 | 개선 방향 |
|---|---:|---|---|---|
| `dashboard-server-detail-metrics-tab-slot-drift-v81197` | P1 | 서버 상세 overview는 `api-was-dc1-01` CPU 84 / MEM 71 / DISK 31을 표시했지만 성능 분석 탭은 CPU 43 / MEM 57 / DISK 35를 표시 | overview는 dashboard current slot의 `safeServer` 값을 쓰고, 성능 탭은 24h history tail을 그대로 현재값처럼 표시 | chart history의 마지막 포인트를 현재 dashboard slot 값으로 정렬하거나 라벨을 분리한다. 이번 작업은 같은 화면의 현재값을 SSOT로 맞춘다. |
| `ai-rag-on-document-lookup-hallucination-v81197` | P1 | RAG On 내부 문서 경로 질의에 `/opt/otel/data/ssot/*.yaml` 같은 허위 경로를 응답 | 내부 문서/파일 경로 질의가 RAG 도구 사용을 강제하지 못하고, 근거 없을 때도 모델이 일반 지식처럼 답변 가능 | 내부 문서/파일 경로 질의는 `searchKnowledgeBase`를 우선 강제하고, 정확 경로 claim은 RAG 근거 없이는 답하지 않도록 지침과 테스트를 보강한다. |
| `ai-web-search-intent-and-answer-quality-v81197` | P1 | Web On 최신 Next.js 질의가 서버 scope clarification에 막혔고, skip 후 오래된/무출처 답변을 반환 | clarification generator가 외부 최신 문서 질의를 서버 질의로 오인하고, web 결과 인용 계약이 충분히 강하지 않음 | 최신/공식문서/web 질의는 clarification을 우회하고, `searchWeb` 사용 답변은 출처 URL과 최신성 근거를 요구한다. |
| `auth-success-legacy-route-404-v81197` | P2 | `/auth/success`가 체크리스트에 남아 있지만 production에서 404 | 현재 OAuth 성공 경로는 `/auth/callback`만 구현되어 있고 legacy success handoff route가 없음 | 체크리스트의 legacy surface와 제품을 맞추기 위해 `/auth/success`를 안전한 dashboard handoff route로 복원한다. |
| `reporter-download-action-visibility-v81197` | P2 | Reporter copy는 생성 및 다운로드를 약속하지만 생성 후 visible button set에서 다운로드/MD 복사 액션을 찾기 어려움 | `ReportCard`에는 액션이 있으나 QA 관점에서 생성 직후 primary action visibility가 약함 | 생성 결과 카드의 MD 복사/다운로드 버튼 접근성과 라벨을 명확히 하고, 테스트로 visible action을 고정한다. |

## 범위

- 포함:
  - dashboard 서버 상세 current metric alignment
  - frontend clarification bypass rule
  - Cloud Run supervisor RAG/Web tool forcing 및 답변 근거 지침 보강
  - `/auth/success` legacy handoff route
  - Reporter generated report action visibility 보완
  - 회귀 테스트 및 타입/린트/스모크 검증
- 제외:
  - 실제 서버 연결, 신규 telemetry backend, 신규 LLM/provider, vector DB schema 변경
  - GraphRAG 재도입, 항상 켜진 Cloud Run, CPU/memory 증설
  - broad Playwright 재QA 기록 갱신은 배포 후 별도 run에서 수행

## 계약 (Contract)

### 변경 대상 파일

- `src/components/dashboard/EnhancedServerModal.metrics.helpers.ts`
- `src/lib/ai/clarification-generator.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream-citations.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-web-search.ts`
- `src/app/auth/success/route.ts`
- `src/components/ai/pages/auto-report/ReportCard.tsx`
- 관련 테스트 파일

### 입출력 계약

| 표면 | 입력 | 기대 출력 |
|---|---|---|
| 서버 상세 성능 탭 | 같은 `Server` current slot + 24h history | `CPU/Memory/Disk` chart current 값은 overview current 값과 일치 |
| clarification | Web On 또는 최신/공식문서/버전 질의 | 서버 scope clarification을 만들지 않고 실행 경로로 통과 |
| Cloud Run supervisor | RAG On + 내부 문서/파일 경로 질의 | step 0에서 `searchKnowledgeBase` 우선 호출 |
| Cloud Run supervisor | Web On + 최신 버전/공식문서 질의 | step 0에서 `searchWeb` 우선 호출하고 최종 답변에 출처 요구 |
| Cloud Run stream | `searchWeb` 결과 URL은 있으나 본문 URL이 없음 | 스트림 말미에 최대 3개 참고 출처를 deterministic하게 추가 |
| `/auth/success` | GET | 404가 아니라 `/dashboard`로 redirect |
| Reporter 결과 | 생성된 report card | visible copy/download action이 접근 가능한 버튼으로 노출 |

### 테스트 시나리오

- [x] 대시보드: history tail이 stale이어도 성능 탭 current 값은 `server.cpu/memory/disk`를 따른다.
- [x] 대시보드: 서버 모달/상세/카드의 로그·네트워크·미니차트 current 값은 stale history tail이 아니라 current slot을 따른다.
- [x] clarification: `Next.js 최신 stable major 알려줘` 같은 web/current 질의는 scope clarification을 만들지 않는다.
- [x] supervisor routing: 내부 문서/파일 경로 질의 + RAG On은 `searchKnowledgeBase` toolChoice를 강제한다.
- [x] supervisor routing: latest/version/official docs 질의 + Web On은 `searchWeb` toolChoice를 강제한다.
- [x] auth: `/auth/success` GET은 dashboard로 redirect한다.
- [x] reporter: 생성된 report card에 MD 복사와 다운로드 버튼이 보인다.

## Task 목록

- [x] Task 0 — QA 실패 목록/원인/계약 문서화
- [x] Task 1 — 회귀 테스트 추가
- [x] Task 2 — dashboard metric alignment 구현
- [x] Task 3 — RAG/Web routing 및 grounding 지침 구현
- [x] Task 4 — auth success route 및 reporter action visibility 구현
- [x] Task 5 — targeted tests, type-check, lint, quick smoke 검증
- [x] Task 6 — 코드 리뷰와 배포/QA 판단 정리
- [x] Task 7 — dashboard/server-card metric numeric sweep
  - `ServerDetailView`의 성능/로그/네트워크 탭 `realtimeData` tail을 current slot으로 정렬
  - `EnhancedServerModal`의 로그/네트워크 탭 `realtimeData` tail과 로그 요약 수치를 current slot으로 정렬
  - `ImprovedServerCard` 미니 차트 history tail을 카드 current metric 값으로 정렬
  - `SystemOverviewSection` 시스템 리소스 평균은 `MetricsProvider.getSystemSummary()`와 동일하게 offline 서버의 0 메트릭을 제외

## 완료 기준

- [x] Pending 개선 5건의 로컬 회귀 테스트가 통과한다.
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] Cloud Run 변경이 있으므로 `cd cloud-run/ai-engine && npm run type-check` 및 관련 테스트 통과
- [x] `git diff --check` 통과
- [x] 대시보드/서버 카드 수치 drift 추가 회귀 테스트 통과
- [ ] 배포 후 Vercel Playwright MCP targeted QA에서 동일 5건을 재검증한다.
