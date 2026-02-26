# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-02-26 23:07:56 KST

## Summary

| Metric | Value |
|---|---:|
| Total Runs | 9 |
| Total Checks | 59 |
| Passed | 45 |
| Failed | 14 |
| Completed Items | 17 |
| Pending Items | 5 |
| Expert Domains Tracked | 6 |
| Expert Open Gaps | 4 |
| Completion Rate | 77.27% |
| Last Run | QA-20260226-0009 (2026-02-26T14:07:55.933Z) |

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260226-0009 (2026-02-26T14:07:55.933Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| - | - | - | - |

## Expert Domain Open Gaps

- ai-security-reliability: AI Security & Reliability Architect (last QA-20260226-0006)
  next: OWASP LLM Top 10 기반 공격 회귀 10건+ 운영 테스트화
- data-metrics-quality: Data Quality & Metrics Analyst (last QA-20260226-0006)
  next: 문서/지표 운영 규칙을 주기 자동화
- observability-monitoring: IT Monitoring & Observability SME (last QA-20260226-0006)
  next: precision/recall 주간 리포트 파이프라인을 문서화한 뒤 자동화
- test-automation: Test Automation Architect (last QA-20260226-0006)
  next: 단위/통합 테스트 최소 1건씩 DoD 게이트에 반영

## Pending Improvements

- [P1] metrics-drift-threshold-standard: 지표 드리프트 임계치 표준화 (seen 1회, last QA-20260226-0003)
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 2회, last QA-20260226-0004)
- [P1] security-attack-regression-pack: 보안 공격 시나리오 회귀팩 구축 (seen 2회, last QA-20260226-0004)
- [P2] ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (seen 1회, last QA-20260226-0005)
- [P2] release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (seen 1회, last QA-20260226-0005)

## Completed Improvements

- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- feature-dod-lint-zero-error: Feature DoD: lint 0 에러 (completed 1회, last QA-20260226-0007)
- feature-dod-release-response-time-check: Feature/Release DoD: 핵심 응답시간 합격 (completed 1회, last QA-20260226-0005)
- feature-dod-security-review: Feature DoD: 보안 검토(입력 검증/인증/OWASP) (completed 1회, last QA-20260226-0006)
- feature-dod-tsc-zero-error: Feature DoD: tsc noEmit 0 에러 (completed 1회, last QA-20260226-0007)
- feature-dod-unit-tests: Feature DoD: 신규 로직 단위 테스트 (completed 1회, last QA-20260226-0009)
- feature-dod-validation-health-endpoints: Feature/Release DoD: 헬스체크 엔드포인트 통과 검증 (completed 1회, last QA-20260226-0005)
- guest-login-visibility-toggle: 게스트 로그인 버튼 노출 옵션화 (completed 1회, last QA-20260226-0001)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- landing-copy-alignment: 랜딩 로그인 정책 카피 정합성 추가 점검 (completed 2회, last QA-20260226-0009)
- login-pin-form-structure: 게스트 PIN 입력 폼 구조 정리 (completed 1회, last QA-20260226-0001)
- modal-backdrop-close: 모달 백드롭 클릭 닫기 안정화 (completed 2회, last QA-20260226-0002)
- planning-backlog-clear: planning TODO 잔여 항목 정리 (completed 1회, last QA-20260226-0006)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-test-gate: Release DoD: validate:all (tsc + lint + test) 전체 통과 (completed 1회, last QA-20260226-0008)

## Recent Runs

| Run ID | Time (UTC) | Title | Checks | Completed | Pending | Expert Gaps |
|---|---|---|---:|---:|---:|---:|
| QA-20260226-0009 | 2026-02-26T14:07:55.933Z | P1 Closeout — unit-tests / copy-alignment / nav-landmarks | 5 | 3 | 0 | 0 |
| QA-20260226-0008 | 2026-02-26T13:10:43.480Z | P1 Release DoD — test-gate / contract-test / cost-gate verified | 6 | 3 | 0 | 0 |
| QA-20260226-0007 | 2026-02-26T12:03:08.146Z | P0 DoD Closeout — tsc/lint zero-error verified | 3 | 2 | 0 | 0 |
| QA-20260226-0006 | 2026-02-26T12:00:38.039Z | Technical Debt Closeout - Admin Auth Role Validation | 4 | 3 | 0 | 4 |
| QA-20260226-0005 | 2026-02-26T11:25:45.950Z | DoD-Gap Analysis for Final QA Closeout | 10 | 2 | 9 | 4 |
| QA-20260226-0004 | 2026-02-26T11:24:21.055Z | Domain Fit Review vs Industry Best Practices | 8 | 0 | 3 | 4 |
| QA-20260226-0003 | 2026-02-26T11:15:22.325Z | Final QA Domain-Fit Review for Project Closure | 6 | 1 | 3 | 3 |
| QA-20260226-0002 | 2026-02-26T11:13:57.091Z | Vercel Playwright QA - Login/Modal/Copy Alignment | 12 | 1 | 2 | 0 |
| QA-20260226-0001 | 2026-02-26T10:50:26.077Z | Portfolio QA Tracking Setup + P0/P1 Fix Verification | 5 | 4 | 1 | 0 |

