# Project Evolution Retrospective - 2026-05-15

> Git history based project evolution analysis from the initial commit to v8.11.156.
> Owner: project
> Status: Historical
> Doc type: Explanation
> Last reviewed: 2026-05-15
> Canonical: reports/docs/project-evolution-retrospective-2026-05-15.md
> Tags: project-history,retrospective,ux,ai,dashboard

## Scope

This report summarizes the observable direction of OpenManager AI from Git history, tags, deleted files, and current source topology. It is not a new implementation plan. Its purpose is to identify:

- what improved over time
- what likely regressed or became harder to understand
- which removed ideas may still be worth reintroducing in a current-compatible form
- which directions should be avoided because they reintroduce old complexity

## Evidence Baseline

| Check | Result |
|---|---:|
| Current branch | `main` |
| Current release tag inspected | `v8.11.156` |
| `HEAD` commit count | `8,304` |
| all refs commit count | `8,338` |
| first canonical root commit | `9bd7ee8490075043bad9f6b38bd9878001b0b36c` |
| first canonical commit date | `2025-05-23T21:41:07+09:00` |
| latest inspected commit | `ac42ad481d4ab5b1f612fa8c2e3a23cd27ecb8d1` |

Key commands used:

```bash
git rev-list --count HEAD
git rev-list --count --all
git rev-list --max-parents=0 HEAD
git for-each-ref --sort=creatordate --format='%(creatordate:iso-strict)%09%(refname:short)%09%(objectname:short)%09%(subject)' refs/tags
git log --all --diff-filter=D --name-status --format='commit %H %ad %s' --date=short
git diff --shortstat v5.44.3..v8.11.156
git diff --shortstat v8.0.0..v8.11.156
```

## AI Transition Timeline (git-verified)

This section is based on direct commit hash inspection, not inference.

| Phase | Period | AI Substance | Key Evidence |
|---|---|---|---|
| **1. Fake AI** | 2025-05-23 ~ 2025-06-09 | Korean NLP + rule-based response. No LLM calls. | Commit message: *"LLM 없이도 AI처럼 응답", "0$ LLM 비용"* (`4a981555`) |
| **2. First LLM attempt (unstable)** | 2025-06-10 ~ 2025-06-18 | Google Gemini API connected via `GoogleAIService.ts`. 9 days only. | `04f810c1` feat: Google AI Studio beta integration |
| **3. Regression to rules** | 2025-06-19 ~ 2025-11-25 | Reverted to local fallback. Korean NLP, GCP Functions, Transformers.js experiments. | `c9831a80`: *"Google AI 의존성 제거, 오프라인에서도 100% 작동 보장"* |
| **4. Real LLM stable** | **2025-11-26 ~** | Vercel AI SDK v6, `streamText()`, `AISidebarV4`. First production-grade LLM path. | `54f28a8f` feat: integrate Vercel AI SDK |
| **5. Multi-agent** | **2025-12-14 ~** | Cloud Run LangGraph: Supervisor(Groq) → NLQ(Gemini) → Analyst(Mistral) → Reporter(Cerebras) | `9237e171` feat: add Cloud Run LangGraph multi-agent backend |
| **6. Contract-first** | **2026-01 ~** | Vercel AI SDK v6 best practices, resumable streams, artifact contracts, KRL | `3d8a1ee0`, `da389778` |

**Key finding**: The project was "fake AI" for the first 6 months (2025-05 to 2025-11). Real LLM calls became stable only on 2025-11-26. Multi-agent architecture started 2025-12-14. The current production system is the result of ~6 months of real AI operation (2025-11 to present).

## Timeline

```text
2025-05 initial project
  Next.js/TypeScript project, landing page, API experiments, AI demo surfaces.
  AI responses were entirely rule-based and Korean NLP pattern matching.

2025-06 to 2025-11 v5 mid
  Feature explosion: AI sidebar/modal, thinking viewers, prediction pages.
  Many surface UX components built, but all backed by local/mock responses.
  First real Gemini API connection attempted June 10, reverted June 19.

2025-11 to 2026-01 v5 late
  First stable LLM calls via Vercel AI SDK (Nov 26).
  Cloud Run LangGraph multi-agent backend added Dec 14.
  Groq/Gemini/Mistral/Cerebras provider chain established Dec 26.
  AI Engine and versioned release discipline appear.

2026-01 to 2026-02 v6/v7/v8 baseline
  Product identity shifts from OpenManager Vibe to OpenManager AI.
  UI, auth, dashboard, and AI Assistant surfaces consolidated.
  AI SDK v6 best practices, resumable streams.

2026-04 to 2026-05 v8.11
  Strong contract-first stabilization: GitLab canonical delivery, QA tracker,
  Vercel/Cloud Run release gates, artifact workspace, Knowledge Retrieval Lite,
  evidence metadata, semantic routing, and line-guard refactors.
```

## Size And Shape

| Ref | Files | AI/dashboard related files |
|---|---:|---:|
| initial root commit | 34 | n/a |
| `v5.44.3` | 1,365 | 371 |
| `v5.80.0` | 1,602 | 287 |
| `v6.0.0` | 1,278 | 277 |
| `v7.0.0` | 1,339 | 278 |
| `v8.0.0` | 1,356 | 290 |
| `v8.10.0` | 1,930 | 425 |
| `v8.11.0` | 2,124 | 421 |
| `v8.11.156` | 3,488 | 575 |

Diff scale:

```text
v5.44.3..v8.11.156 (raw)
  4,759 files changed, 929,186 insertions, 491,188 deletions

v5.44.3..v8.11.156 (filtered: excluding package-lock.json, otel-data, qa/evidence)
  3,577 files changed, 510,874 insertions, 472,533 deletions
```

The raw diff numbers are misleading. Approximately 45% of reported insertions come from `package-lock.json`, `public/data/otel-data/**` (pre-generated OTel fixtures), and `reports/qa/evidence/**` (QA screenshot/artifact records). Filtered numbers better reflect actual source code and documentation changes.

The project did not simply grow linearly. It repeatedly added broad feature surfaces, then pruned or consolidated them into narrower production paths. The current tree is larger because it contains more tests, QA evidence metadata, Cloud Run AI Engine modules, artifacts, and contract boundaries.

## Improvements

### 1. Runtime Architecture Became More Defensible

Early `v5.44.3` had many AI/API entry points under `src/app/api/ai/**`, `src/app/api/ai-agent/**`, MCP routes, smart fallback routes, thinking routes, prediction routes, and test routes. That made the product expressive, but the runtime contract was difficult to reason about.

Current `v8.11.156` has clearer canonical surfaces:

```text
Frontend stream path
  /api/ai/supervisor/stream/v2

AI Engine
  cloud-run/ai-engine/src/routes/*
  cloud-run/ai-engine/src/services/ai-sdk/*
  cloud-run/ai-engine/src/domains/monitoring/*

Knowledge retrieval
  Knowledge Retrieval Lite + evidence metadata
```

This is a net improvement. The system now favors stable contracts and explicit fallback behavior over many parallel demo endpoints.

### 2. Testing And QA Became A First-Class Design Constraint

The recent commit pattern repeatedly pairs:

```text
test(spec): add failing tests
feat/fix/refactor: implement behavior
docs(plan)/test(qa): record closure
```

This is materially better than the early history, where many commits describe broad feature completion, emergency routing fixes, and deployment trial-and-error. Current work leaves a stronger evidence trail and reduces regressions in AI stream, artifact, routing, dashboard, and QA state.

### 3. Dashboard UX Became More Operational

The dashboard moved from broad demo/admin surfaces toward repeated operational workflows:

- server cards
- server detail pages
- alert and log panels
- Korean label consistency
- status-first sorting
- responsive overflow fixes
- server card peek/fade and density tuning

Current files such as `src/components/dashboard/ServerDashboard.tsx`, `ImprovedServerCard.tsx`, and `EnhancedServerModal.*` reflect a more work-focused monitoring tool than early demo pages.

### 4. AI Output Became More Auditable

Recent artifact and evidence work improved the traceability of AI responses:

- artifact envelope metadata
- replay pack export/import/compare
- artifact guidance CTA
- evidence source grouping
- KRL evidence rendering
- semantic routing trace

This is a major improvement over early RAG/MCP/Google AI displays that were visually rich but often less contract-bound.

## Regressions Or Risks

### 1. Product Expressiveness Was Reduced — With Caveats

The four candidate components were not removed for product strategy reasons. Git history shows each was dead code at the time of deletion:

| Component | Deletion date | Deletion commit message |
|---|---|---|
| `SixWPrincipleDisplay.tsx` | 2025-12-09 | "no imports found" (dead code cleanup, 15 components) |
| `RealTimeThinkingViewer.tsx` | 2025-11-24 | "was dead code (not imported anywhere)" |
| `MultiAIThinkingViewer.tsx` | ~2025-07 | Built for MCP/RAG/Google AI arch; moved to `backup-removed-features/` then deleted |
| `IncidentHistoryPage.tsx` | 2026-05-02 | Deliberate removal for free-tier contract simplification |

The expressiveness regression is real, but the cause is not that the system traded narrative for reliability. The components became disconnected from the active architecture before they were deleted. `MultiAIThinkingViewer` was explicitly designed for `MCP Engine / RAG Engine / Google AI` — labels that no longer exist. `SixWPrincipleDisplay` expected a typed `SixWPrincipleResponse` with `who/what/when/where/why/how` fields that the AI pipeline no longer emits.

Current UI is more reliable, but some of the visible reasoning around AI work is less prominent. The gap is architectural (no current emitted trace surface for the UI to bind to), not intentional.

### 2. Complexity Moved From UI Sprawl To Runtime Sprawl

The old system had too many visible routes and UI panels. The current system has fewer public surfaces, but more internal orchestration:

```text
supervisor
  routing
  semantic metadata
  stream recovery
  provider fallback
  artifact generation
  evidence providers
  reporter/advisor/nlq/vision roles
```

The recent line-guard and helper extraction work is necessary, but it does not fully eliminate cognitive load. It mostly makes the complexity navigable.

### 3. Commit Volume Is High But Partially Structural

`v8.11.0` to `v8.11.156` spans 38 days with 1,345 total commits. That sounds like extreme churn, but the composition matters:

| Type | Count | Note |
|---|---:|---|
| `chore(release)` | 157 | One per patch tag — mechanical |
| `test(spec)` | 131 | SDD mandatory pre-implementation specs |
| `(qa)` scope | 171 | QA recording commits |
| `docs` | 267 | Architecture maps, plans, evidence |
| `fix` + `feat` | 352 | Actual functional changes (26%) |

The 352 functional commits over 38 days (~9/day) is high but plausible for active stabilization. The SDD process itself generates mandatory `test(spec):` commits before every `feat:`, doubling the commit count for each feature cycle. The "156 patch versions" headline is misleading — it is mainly a consequence of automated release tagging after every merge to main, not 156 distinct feature drops.

For future releases, grouping related changes into clearer release themes would make project history easier to audit.

### 4. Some Deletions Were Correct, Some Need Product Review

Clearly positive removals:

- Sentry runtime integration removal, given current observability direction
- AI feedback feature removal, given limited product value and extra surface area
- GraphRAG/vector compatibility cleanup, given KRL consolidation
- Recharts removal, given Nivo/SVG replacement and visual QA
- many unused shadcn primitives and stale API routes

Review-worthy removals:

- incident report history UI
- structured 5W1H response UI
- real-time thinking/debug viewer
- visible multi-agent thinking timeline

These should not be restored as old code. If restored, they should be rebuilt on top of current artifacts, evidence, and stream contracts.

## Revival Candidates (Re-analyzed)

**Important framing correction**: All four deleted components were dead code at deletion time — not removed for product strategy. They became disconnected as the AI architecture evolved. The value is the *concept*, not the code. Each candidate below is assessed against what the current system actually emits.

### Assessment Framework

Before any revival, two questions must be answered:

1. **Does the current system already emit the data this UI needs?** If not, the UI would require new backend work, not just frontend.
2. **Is there a current component that partially covers this?** If so, extend it rather than adding a new surface.

---

### P0 (실질적 복구 가능): Multi-Agent Execution Timeline

**Historical source**: `MultiAIThinkingViewer.tsx` (MCP/RAG/Google AI 전용, 재사용 불가)

**현재 시스템 확인 결과**:

현재 `AnalysisBasisBadge` → `AnalysisBasisProcessPanel`이 이미 `handoffHistory[]`를 받아서 "실행 경로"를 텍스트로 표시한다. 데이터는 이미 흐르고 있다.

```
supervisor stream
  -> handoffHistory: [{agent, model, provider, durationMs}]
  -> handoffCount, providerAttempts, usedFallback
  -> toolResultSummaries[]
```

**Gap**: 이 데이터가 AnalysisBasisBadge 내 접힌 텍스트 목록으로만 표시됨. 시각적 타임라인이 없음.

**복구 방향**: `AnalysisBasisProcessPanel` 내부에 `handoffHistory`를 수평 스텝 타임라인으로 렌더링하는 서브컴포넌트 추가. 새 API 없음, 새 데이터 없음, 기존 컴포넌트 확장만 필요.

**공수**: 소 (컴포넌트 1개, 기존 props 재사용)

---

### P1 (실질적 복구 가능): 운영 요약 카드 (5W1H 구조)

**Historical source**: `SixWPrincipleDisplay.tsx` (구 `SixWPrincipleResponse` 타입 의존, 재사용 불가)

**현재 시스템 확인 결과**:

구 `SixWPrincipleResponse`는 LLM이 `{who, what, when, where, why, how}` 구조화 JSON을 직접 반환해야 했다. 현재 LLM은 이 포맷을 반환하지 않는다.

그러나 현재 `IncidentReportArtifactCard`가 렌더링하는 `IncidentReport` 구조에는 이미 필요한 데이터가 있다:

```typescript
IncidentReport {
  title, severity, timestamp         // When, What
  affectedServers[]                  // Where
  rootCause, description             // Why, What
  immediateActions[], recommendations[] // How
  systemSummary { uptimePercent }    // Impact
}
```

**Gap**: `IncidentReportArtifactCard`가 이 데이터를 섹션 리스트로 표시하지만, 5W1H 프레임으로 재배치하면 운영자 스캔 효율이 올라간다.

**복구 방향**: `IncidentReport` 데이터를 5W1H 레이아웃으로 재배치하는 뷰 레이어 추가. 새 LLM 포맷 불필요. `IncidentReportArtifactCard` 내 선택적 "요약 카드" 뷰 모드로 구현.

**공수**: 소~중 (IncidentReportArtifactCard 확장, LLM 변경 없음)

---

### P2 (저장소 결정 필요): Artifact/Report History View

**Historical source**: `IncidentHistoryPage.tsx` (free-tier 단순화로 의도적 제거)

**현재 시스템 확인 결과**:

현재 `ArtifactWorkspacePanel`이 `replayPacks[]`를 Zustand `persist`로 **localStorage**에 저장한다. 즉 세션 간 유지되지만 브라우저/디바이스 단위다. 크로스 세션 공유나 서버 저장은 없다.

`IncidentHistoryPage`가 제거된 이유는 이 저장소 제약 때문이었다. 페이지로 만들면 "저장된 것처럼" 보이지만 실제로는 해당 브라우저에만 존재한다.

**실질적 Gap**: localStorage 기반이면 사용자가 다른 기기나 시크릿 모드에서 열면 기록이 없다. Supabase 영구 저장 없이는 "히스토리 페이지"가 오해를 유발한다.

**결정**: 구현 보류. Supabase artifact 저장 테이블 없이는 "히스토리 페이지"가 오해를 유발한다. 저장소 결정(Supabase schema + migration) 후 재평가.

---

### P3 (현재 이미 존재 — 제거): Admin Debug Trace Panel

**Historical source**: `RealTimeThinkingViewer.tsx`

**결정**: 신규 구현 불필요. `AnalysisBasisBadge`의 "detail" 탭이 이미 `provider`, `modelId`, `providerAttempts`, `usedFallback`, `fallbackReason`, `ttfbMs`, `traceId`를 표시하며 이것이 사실상 admin trace panel이다. `ThinkingProcessVisualizer`도 스트리밍 중 `steps[]`를 sidebar/workspace에서 렌더링한다. 추가 복구 항목 없음.

## Direction Assessment

| Area | Direction | Assessment |
|---|---|---|
| deployment authority | improved | GitLab canonical delivery and CI state reporting are clearer |
| frontend dashboard | improved | more operational, less demo-heavy |
| AI runtime | improved but complex | stronger contracts, more internal layers |
| QA discipline | strongly improved | tracker, evidence, contract tests, production QA |
| knowledge retrieval | improved | KRL is simpler and more auditable than GraphRAG runtime sprawl |
| user-facing AI explainability | mixed | evidence improved, visible narrative partly reduced |
| design consistency | improved | fewer one-off pages and primitives |
| release readability | mixed | many precise patches, but high churn |

## Revival Status (2026-05-15)

| Candidate | Decision | Status |
|---|---|---|
| P0: Multi-agent execution timeline | **구현 완료** | `AnalysisBasisProcessPanel`에 `AgentTimeline` 컴포넌트 추가. `handoffHistory[]` 데이터를 컬러 pill + 화살표 시각 타임라인으로 렌더링. |
| P1: 5W1H 운영 요약 카드 | **구현 완료** | `IncidentReportArtifactCard`에 `SixWGrid` 추가. 기존 `IncidentReport` 데이터를 누가/무엇을/언제/어디서/왜/어떻게 6열 그리드로 재배치. LLM 변경 없음. |
| P2: Artifact/Report history view | **보류** | `ArtifactWorkspacePanel`이 localStorage만 사용. 크로스 세션 저장 없이는 오해 유발. Supabase schema 결정 후 재평가. |
| P3: Admin debug trace panel | **불필요** | `AnalysisBasisBadge` detail 탭이 이미 provider/model/fallback trace를 표시. `ThinkingProcessVisualizer`도 streaming 중 steps를 렌더링. 추가 복구 항목 없음. |

## Development Efficiency Analysis (1년 평가)

### 총평

| 항목 | 측정치 |
|---|---|
| 총 기간 | 2025-05-23 ~ 2026-05-15 (약 12개월) |
| 총 커밋 수 | 8,304 (HEAD 기준) |
| 실 AI 동작 기간 | 2025-11-26 ~ 현재 (약 6개월) |
| 현재 프로덕션 수준 | multi-agent LLM, contract-first, QA-tracked |
| 개발자 규모 | 솔로 개발 |

**결론: 전체적으로 1년은 길었다. 그러나 단순히 느린 게 아니라 아키텍처 도박 사이클이 원인이다.**

솔로 개발자가 프로토타입에서 multi-agent LLM + 프로덕션 QA 수준까지 올리는 데 12개월은 표면적으로 합리적이다. 그러나 내부를 보면 **실질 AI 개발은 2025-11-26부터 시작**되었다. 즉 앞 6개월(2025-05 ~ 2025-11)은 실제 LLM 없이 UI를 구축하고 여러 AI 프레임워크를 시도했다가 버린 기간이다. 실제 생산 가능한 코드가 누적된 시간은 약 6개월이며, 나머지 6개월은 탐색·실험·폐기의 반복이었다.

---

### 월별 커밋 분포

| 월 | 전체 커밋 | 실질 작업 커밋¹ | 비율 | 비고 |
|---|---:|---:|---:|---|
| 2025-05 | 389 | ~180 | ~46% | Fake AI 시작, TensorFlow.js 시도·제거 |
| 2025-06 | 996 | ~415 | ~42% | Transformers/TF/MCP 실험, GCP Functions 도입 준비 |
| 2025-07 | 567 | ~252 | ~46% | GCP Functions 적극 개발 (이후 전량 삭제) |
| 2025-08 | 548 | ~380 | ~69% | React Error #310 순환 수정, GCP Functions 계속 |
| 2025-09 | 362 | ~287 | ~79% | GCP Functions 한국 리전 이전, AI 실체 없음 |
| 2025-10 | 486 | ~182 | ~38% | E2E auth 반복 실패, AI mode 전환 churn |
| **2025-11** | 476 | ~142 | **28%** | Vercel AI SDK 첫 안정 연동 (26일) |
| **2025-12** | 797 | ~404 | **52%** | GCP Functions 전량 삭제, multi-agent 구축 |
| **2026-01** | 755 | ~457 | **63%** | v6/v7 identity shift, SDK v6 best practices |
| **2026-02** | 675 | ~292 | **43%** | v8 baseline, dashboard 정리 |
| **2026-03** | 707 | ~290 | **41%** | QA tracker, KRL, artifact contracts |
| **2026-04** | 953 | ~333 | **35%** | GitLab delivery, 패키지 업그레이드 사이클 |
| 2026-05 (부분) | 593 | — | — | dead code cleanup, retrospective |

> ¹ 2025-07 ~ 2025-10은 이모지 커밋 스타일(`🚀 feat:`, `🐛 fix:`) 사용. 이후는 conventional commits. 비율 기준이 달라 직접 비교 시 주의.

---

### 주요 낭비 구간 3개

#### 낭비 1: AI 프레임워크 순환 실험 (2025-05 ~ 2025-06, 2개월)

| 라이브러리 | 도입 | 제거 | 기간 |
|---|---|---|---|
| TensorFlow.js | 2025-05 | 2025-06 | ~4주 |
| @xenova/transformers | 2025-06 | 2025-06 | ~2주 |
| FastAPI (Python hybrid) | 2025-06 | 2025-06 | ~1주 |
| GCP Functions (Node 시작) | 2025-06 말 | 2025-12-14 | **5.5개월** |

TF.js는 Vercel 서버리스 환경에서 번들 크기 문제로 실패, Transformers.js도 같은 이유로 제거, FastAPI는 인프라 복잡성으로 제거. 이 기간에 "AI"라는 이름으로 코드가 쌓였지만 실제 LLM 추론은 단 한 건도 없었다.

**손실 추정**: 동일한 6주를 Vercel AI SDK 직접 연동에 쓰면 2025-07부터 실제 LLM 동작이 가능했다. 실제 연동은 2025-11-26 달성.

#### 낭비 2: GCP Functions 사이클 (2025-07-08 ~ 2025-12-14, 5개월)

```text
2025-07-08  GCP Functions 도입
2025-08-01  배포 스크립트 최적화
2025-09-13  한국 리전 이전 "100% 실제 클라우드 구현 완료"
2025-11-20  6개 GCP Functions 배포 완료
2025-11-20  feat(ai): 옵션 A 구현 - GCP Functions 유지 + Vercel 최적화
2025-12-08  fix(gcp): Cloud Functions → Cloud Run 마이그레이션 완료
2025-12-14  chore: remove legacy GCP Functions and Docker infrastructure  ← 전량 삭제
```

5개월 동안 구축한 GCP Functions 전체가 단 한 커밋으로 제거되었다. 현재 코드베이스에 GCP Functions의 흔적은 없다. Cloud Run 선택은 옳았지만 도달 경로가 5개월 우회였다.

**직접 비용**: Cloud Build 유료 머신 타입(`E2_HIGHCPU_8`) 실수로 2026-01 약 20,000 KRW 청구. GCP Functions 개발 중 인프라 실험이 습관화된 결과.

#### 낭비 3: E2E 인증 싱크홀 (2025-10 ~ 2026-02, 집중 구간)

```text
2025-10  fix(e2e): add missing Vercel bypass header
2025-10  fix(e2e): add missing x-vercel-protection-bypass header (또 추가)
2025-10  fix(e2e): implement test mode authentication bypass
2025-10  fix(e2e): resolve 403 authentication regression
2025-10  fix(e2e): resolve dashboard-container visibility timeout
2025-11  fix(auth): preserve test mode cookies during guest login
2025-11  fix(e2e): add explicit navigation to /dashboard after guest login
2025-11  fix(e2e): resolve cookie timing issue
2026-01  fix(login): remove isClient hydration guard to fix E2E 48 failures
2026-02  fix(e2e): skip system-start button on Vercel to prevent login redirect timeout
```

동일한 Playwright cookie/bypass 문제가 4개월간 반복적으로 회귀했다. 한 번에 근본 해결하지 않고 증상 패치가 반복된 패턴이다. 현재(2026-02 이후)는 안정화되었으나 이 구간에 소비된 커밋이 약 20건.

---

### 올바른 결정들

낭비만 있었던 건 아니다. 되돌아보면 정확한 판단이었던 선택들:

| 결정 | 시점 | 이유 |
|---|---|---|
| Recharts → Nivo | 2025-12 | 번들 크기 + SVG 제어 |
| GCP Functions → Cloud Run | 2025-12 | 냉각 시간, 언어 제약 해소 |
| LangGraph 포기 → custom orchestrator | 2026-01 | Vercel 서버리스 비호환 |
| Sentry 제거 | 2026-01 | 무료 계정 쿼터 + 현재 로깅으로 충분 |
| SDD gate 도입 | 2026-02 | 회귀 반복 차단 |
| GitLab canonical delivery | 2026-03 | Vercel Git Integration 제거로 CI 권위 명확화 |
| GraphRAG → KRL | 2026-04 | free-tier 비용 + 운영 복잡성 |

---

### 시기별 효율 요약

```
2025-05 ~ 2025-11 (6개월): 탐색기
  - 가짜 AI 위에 UI 구축 → 일부 UI는 나중에 재활용
  - 여러 AI 프레임워크 시도·폐기 → 누적 비용: 약 4~5개월 순 손실
  - GCP Functions 개발 → 5개월 후 전량 삭제

2025-11 ~ 2026-01 (2개월): 전환기
  - 첫 실제 LLM 연동, multi-agent 구축
  - GCP Functions 정리, v5 → v6/v7 identity 전환
  - 가장 높은 실질 작업 비율 (52~63%)

2026-01 ~ 현재 (4개월): 안정화기
  - contract-first, QA tracker, artifact system
  - 실질 작업 비율 유지 (35~43%)
  - 기술 부채 상환 병행
```

---

### 결론

1년은 솔로 개발 기준 **약 4개월 길었다**. 만약 2025-07부터 Vercel AI SDK + Cloud Run으로 바로 갔다면 현재 수준을 2026-01에 달성할 수 있었다. 실제 2026-01이 가장 높은 실질 작업 비율(63%)을 기록한 시점이라는 사실이 이를 지지한다.

낭비의 근본 원인은 속도가 아니라 **아키텍처 확신 부재**였다:
- "LLM 없이 AI처럼 보이게" → 결국 실제 LLM 필요
- "GCP Functions로 서버리스 AI" → 결국 Cloud Run 필요
- "여러 AI 모드 지원" → 결국 단일 경로 필요

현재 아키텍처(Vercel AI SDK v6 + Cloud Run multi-agent + Supabase)는 처음부터 선택 가능했던 조합이다. 탐색 비용이 컸지만 그 과정에서 dashboard UI, QA 규율, 배포 파이프라인이 성숙했다는 점이 유일한 상쇄 요인이다.

## Recommended Next Steps

1. Dead code cleanup: completed on 2026-05-16. Deprecated utility files and matching tests were removed, with production startup `TEST_API_KEY` validation inlined in `instrumentation.ts`. (계획서: `reports/planning/dead-code-cleanup-plan.md`)
2. Artifact history view: Supabase `artifacts` 테이블 설계 후 P2 재개.
3. Line-guard와 module-boundary cleanup을 AI Engine과 frontend chat 코드에 지속.
4. High-frequency patch series는 릴리스 노트 그룹핑으로 가독성 개선 검토.

## Bottom Line

The project is moving in a healthier engineering direction: fewer uncontrolled feature surfaces, stronger contracts, better QA, and clearer deployment authority. The "expressiveness gap" identified in this report was caused by dead code accumulation, not intentional product trade-offs. Two targeted UI improvements (P0, P1) were implemented using existing data contracts with no backend changes.
