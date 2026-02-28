# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-02-28 14:58:32 KST

## Summary

| Metric | Value |
|---|---:|
| Total Runs | 29 |
| Total Checks | 129 |
| Passed | 111 |
| Failed | 18 |
| Completed Items | 37 |
| Pending Items | 0 |
| Wont-Fix Items | 5 |
| Expert Domains Tracked | 6 |
| Expert Open Gaps | 2 |
| Completion Rate | 100% |
| Last Run | QA-20260228-0029 (2026-02-28T05:58:33.745Z) |

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260228-0029 (2026-02-28T05:58:33.745Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| - | - | - | - |

## Expert Domain Open Gaps

- data-metrics-quality: Data Quality & Metrics Analyst (last QA-20260227-0018)
  next: system-start KPI를 QA 체크 메타 항목으로 상향해 run 메트릭을 보강합니다.
- observability-monitoring: IT Monitoring & Observability SME (last QA-20260227-0018)
  next: system-start API 시도/성공률/실패률/지연 시간을 qa-tracker checks로 반영합니다.

## Pending Improvements

- None

## Wont-Fix Improvements

- [P1] metrics-drift-threshold-standard: 지표 드리프트 임계치 표준화 (seen 2회, last QA-20260227-0013)
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 3회, last QA-20260227-0013)
- [P1] security-attack-regression-pack: 보안 공격 시나리오 회귀팩 구축 (seen 3회, last QA-20260227-0013)
- [P2] ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (seen 1회, last QA-20260226-0005)
- [P2] system-start-metrics-gate: 시스템 시작 지연/실패율 KPI 기준 자동 수집 (seen 3회, last QA-20260227-0018)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)

## Completed Improvements

- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- ai-math-tools: AI 계산 도구(수식/통계/용량) 셋업 완료 (completed 1회, last QA-20260228-0023)
- auth-error-provider-copy: 인증 에러 라우트 메시지를 제공자-중립 표현으로 전환 (completed 1회, last QA-20260227-0010)
- feature-dod-e2e-critical: E2E 크리티컬 흐름 통과 (completed 1회, last QA-20260228-0029)
- feature-dod-lint-zero-error: lint 0 에러 (completed 3회, last QA-20260228-0028)
- feature-dod-login-copy-neutral: 로그인 정책 카피 중립성 지속성 (completed 1회, last QA-20260227-0017)
- feature-dod-login-policy-copy: 로그인 정책 카피 중립성 지속성 (completed 3회, last QA-20260227-0018)
- feature-dod-release-response-time-check: Feature/Release DoD: 핵심 응답시간 합격 (completed 1회, last QA-20260226-0005)
- feature-dod-security-review: Feature DoD: 보안 검토(입력 검증/인증/OWASP) (completed 1회, last QA-20260226-0006)
- feature-dod-system-start-guard: 비로그인 시스템 시작 가드 모달 동작 (completed 7회, last QA-20260227-0018)
- feature-dod-tsc-zero-error: tsc --noEmit 0 에러 (completed 3회, last QA-20260228-0028)
- feature-dod-unit-tests: 전체 단위/통합 테스트 통과 (completed 3회, last QA-20260228-0028)
- feature-dod-validation-health-endpoints: 헬스/버전 API 검사 (Vercel) (completed 2회, last QA-20260227-0018)
- feature-dod-vitals-integration: vitals:integration 통합 실행 통과 (completed 1회, last QA-20260228-0028)
- guest-login-visibility-toggle: 게스트 로그인 버튼 노출 옵션화 (completed 2회, last QA-20260227-0013)
- guest-pin-login-flow: 게스트 PIN 인증 후 시스템 시작 버튼 노출 (completed 4회, last QA-20260227-0018)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- landing-copy-alignment: 랜딩/로그인 정책 카피 정합성 (completed 4회, last QA-20260227-0016)
- login-copy-neutral: 로그인 정책 카피 중립성 개선 (completed 1회, last QA-20260227-0014)
- login-pin-form-structure: 게스트 PIN 입력 폼 구조 정리 (completed 1회, last QA-20260226-0001)
- math-tool-implementation-validation: AI 계산 툴 라우팅/실행 검증 (completed 1회, last QA-20260228-0027)
- modal-backdrop-close: 모달 백드롭 클릭 닫기 안정화 (completed 2회, last QA-20260226-0002)
- planning-backlog-clear: planning TODO 잔여 항목 정리 (completed 1회, last QA-20260226-0006)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- rag-engine-doc-link-repair: RAG, Vercel fair-use 문서 링크 경로 갱신 (completed 1회, last QA-20260228-0026)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (completed 1회, last QA-20260228-0025)
- release-dod-test-gate: Release DoD: validate:all (tsc + lint + test) 전체 통과 (completed 1회, last QA-20260226-0008)
- system-start-login-modal: 비로그인 상태에서 시스템 시작 클릭 시 로그인 모달 노출 (completed 1회, last QA-20260227-0021)
- system-start-login-modal-redirect: 로그인 모달에서 로그인 페이지로 이동 (completed 1회, last QA-20260227-0022)
- vitals-log-suppression: Web Vitals 통합 테스트 로그 억제 옵션 추가 (completed 1회, last QA-20260228-0028)
- 게스트-pin-로그인-후-시스템-시작-버튼-노출: 게스트 PIN 로그인 후 시스템 시작 버튼 노출 (completed 1회, last QA-20260227-0010)
- 로그인-정책-카피-정합성: 로그인 정책 카피 정합성 (completed 1회, last QA-20260227-0010)
- 비로그인-시스템-시작-가드-모달-동작: 비로그인 시스템 시작 가드 모달 동작 (completed 1회, last QA-20260227-0010)
- 비로그인-시스템-시작-버튼-노출-유지: 비로그인 사용자 시스템 시작 버튼 노출 유지 (completed 2회, last QA-20260227-0020)
- 비로그인-시스템-시작-클릭-로그인-모달: 비로그인 사용자 시스템 시작 클릭 시 로그인 모달 경유 (completed 2회, last QA-20260227-0020)

## Recent Runs

| Run ID | Time (UTC) | Title | Checks | Completed | Pending | Wont-Fix | Expert Gaps |
|---|---|---|---:|---:|---:|---:|---:|
| QA-20260228-0029 | 2026-02-28T05:58:33.745Z | Critical E2E validation with local server | 11 | 1 | 0 | 0 | 0 |
| QA-20260228-0028 | 2026-02-28T05:16:29.599Z | Web Vitals integration log suppression + full validation | 5 | 5 | 0 | 0 | 0 |
| QA-20260228-0027 | 2026-02-27T16:34:47.012Z | AI Math Tools & Routing Verification (Type-check + targeted tests) | 3 | 1 | 0 | 0 | 0 |
| QA-20260228-0026 | 2026-02-27T16:23:32.022Z | Docs full-link health after infrastructure and Vertex RAG URL repair | 1 | 1 | 0 | 0 | 0 |
| QA-20260228-0025 | 2026-02-27T16:02:07.173Z | Docs QA Gate Repair for Dead Link and Ordered List | 2 | 1 | 0 | 0 | 0 |
| QA-20260228-0024 | 2026-02-27T15:51:09.352Z | Release DoD Evidence: Type/Lint/Unit Checks for AI Math Tools | 3 | 3 | 0 | 0 | 0 |
| QA-20260228-0023 | 2026-02-27T15:50:59.689Z | Vercel Playwright + AI Math Tool Verification | 17 | 1 | 3 | 0 | 1 |
| QA-20260227-0022 | 2026-02-27T12:22:13.317Z | Vercel Playwright MCP: 로그인 모달에서 로그인 페이지 이동 | 1 | 1 | 0 | 0 | 0 |
| QA-20260227-0021 | 2026-02-27T12:12:23.798Z | Vercel Playwright MCP: 비로그인 시스템 시작 로그인 모달 | 1 | 1 | 0 | 0 | 0 |
| QA-20260227-0020 | 2026-02-27T12:00:06.421Z | Vercel Playwright MCP QA - 비로그인 시작 CTA 노출/모달 재검증 | 2 | 2 | 0 | 0 | 0 |
| QA-20260227-0019 | 2026-02-27T11:53:49.388Z | Vercel Playwright MCP QA - 비로그인 시작 CTA 가시성 및 모달 확인 | 2 | 2 | 0 | 0 | 0 |
| QA-20260227-0018 | 2026-02-27T11:13:35.120Z | Vercel Playwright MCP QA - 시스템 시작 가드 및 게스트 인증 경로 재확인 | 6 | 4 | 0 | 1 | 2 |
| QA-20260227-0017 | 2026-02-26T19:25:22.388Z | Vercel Playwright QA - 로그인 정책 카피 지속성 및 시스템 시작 가드 재확인 | 2 | 1 | 1 | 0 | 2 |
| QA-20260227-0016 | 2026-02-26T18:34:32.172Z | Vercel Playwright QA - 로그인 정책/시스템 시작 가드 재검증 | 2 | 3 | 0 | 0 | 2 |
| QA-20260227-0015 | 2026-02-26T18:11:05.996Z | Vercel Playwright QA - 랜딩 로그인 모달 카피 배포 정합성 재검증 | 2 | 2 | 2 | 0 | 3 |
| QA-20260227-0014 | 2026-02-26T18:03:30.997Z | Vercel Playwright QA - 로그인 정책/시스템 시작 가드 배포 검증 | 3 | 3 | 1 | 0 | 2 |
| QA-20260227-0013 | 2026-02-26T17:50:54.243Z | Vercel Playwright QA - 시스템 시작 가드/게스트 PIN 체험 흐름 재검증 | 2 | 2 | 3 | 0 | 2 |
| QA-20260227-0012 | 2026-02-26T17:46:29.032Z | Vercel Playwright QA - 로그인 정책/시스템 시작 UX 보강 (재기록) | 3 | 2 | 0 | 0 | 2 |
| QA-20260227-0011 | 2026-02-26T17:46:20.701Z | Vercel Playwright QA - 로그인 정책/시스템 시작 UX 보강 | 0 | 2 | 0 | 0 | 1 |
| QA-20260227-0010 | 2026-02-26T16:36:37.248Z | Vercel Playwright QA - 시스템 시작/게스트 PIN | 2 | 5 | 1 | 0 | 2 |

