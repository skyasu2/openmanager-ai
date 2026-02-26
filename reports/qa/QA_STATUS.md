# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-02-27 03:34:32 KST

## Summary

| Metric | Value |
|---|---:|
| Total Runs | 16 |
| Total Checks | 73 |
| Passed | 57 |
| Failed | 16 |
| Completed Items | 25 |
| Pending Items | 7 |
| Expert Domains Tracked | 6 |
| Expert Open Gaps | 2 |
| Completion Rate | 78.13% |
| Last Run | QA-20260227-0016 (2026-02-26T18:34:32.172Z) |

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260227-0016 (2026-02-26T18:34:32.172Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | no | 배포 채널별 동일 시나리오 반복 실행을 정기 게이트로 고정 |
| IT Monitoring & Observability SME | partially-appropriate | yes | Vercel 배포 ID와 런타임 커밋 매핑 로그에 시작 시도/성공률 지표를 연결 |
| AI Security & Reliability Architect | appropriate | no | 게스트 차단/지역 제한 이벤트를 보안 로그와 교차 검증 |
| DevOps / SRE Engineer | appropriate | no | 배포 완료 후 릴리스 게이트에 본 스위트를 추가 |
| Test Automation Architect | appropriate | no | 실패 항목 발생 시 재시도 정책과 실패 추적 규칙 문서화 |
| Data Quality & Metrics Analyst | partially-appropriate | yes | system-start metrics 게이트를 qa-tracker 항목으로 상향 |

## Expert Domain Open Gaps

- data-metrics-quality: Data Quality & Metrics Analyst (last QA-20260227-0016)
  next: system-start metrics 게이트를 qa-tracker 항목으로 상향
- observability-monitoring: IT Monitoring & Observability SME (last QA-20260227-0016)
  next: Vercel 배포 ID와 런타임 커밋 매핑 로그에 시작 시도/성공률 지표를 연결

## Pending Improvements

- [P1] feature-dod-login-copy-neutral: 로그인 정책 카피 중립성 지속성 (seen 1회, last QA-20260227-0015)
- [P1] metrics-drift-threshold-standard: 지표 드리프트 임계치 표준화 (seen 2회, last QA-20260227-0013)
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 3회, last QA-20260227-0013)
- [P1] security-attack-regression-pack: 보안 공격 시나리오 회귀팩 구축 (seen 3회, last QA-20260227-0013)
- [P2] ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (seen 1회, last QA-20260226-0005)
- [P2] release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (seen 1회, last QA-20260226-0005)
- [P2] system-start-metrics-gate: 시스템 시작 지연/실패율 KPI 기준 자동 수집 (seen 1회, last QA-20260227-0010)

## Completed Improvements

- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- auth-error-provider-copy: 인증 에러 라우트 메시지를 제공자-중립 표현으로 전환 (completed 1회, last QA-20260227-0010)
- feature-dod-lint-zero-error: Feature DoD: lint 0 에러 (completed 1회, last QA-20260226-0007)
- feature-dod-login-policy-copy: 로그인 정책 안내 카피가 GitHub/Google/이메일 중립 표현인지 (completed 2회, last QA-20260227-0012)
- feature-dod-release-response-time-check: Feature/Release DoD: 핵심 응답시간 합격 (completed 1회, last QA-20260226-0005)
- feature-dod-security-review: Feature DoD: 보안 검토(입력 검증/인증/OWASP) (completed 1회, last QA-20260226-0006)
- feature-dod-system-start-guard: 비로그인/제한 게스트 시스템 시작 가드 모달 동작 (completed 6회, last QA-20260227-0016)
- feature-dod-tsc-zero-error: Feature DoD: tsc noEmit 0 에러 (completed 1회, last QA-20260226-0007)
- feature-dod-unit-tests: Feature DoD: 신규 로직 단위 테스트 (completed 1회, last QA-20260226-0009)
- feature-dod-validation-health-endpoints: Feature/Release DoD: 헬스체크 엔드포인트 통과 검증 (completed 1회, last QA-20260226-0005)
- guest-login-visibility-toggle: 게스트 로그인 버튼 노출 옵션화 (completed 2회, last QA-20260227-0013)
- guest-pin-login-flow: 게스트 PIN 인증 후 시스템 시작 버튼 노출 (completed 3회, last QA-20260227-0016)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- landing-copy-alignment: 랜딩/로그인 정책 카피 정합성 (completed 4회, last QA-20260227-0016)
- login-copy-neutral: 로그인 정책 카피 중립성 개선 (completed 1회, last QA-20260227-0014)
- login-pin-form-structure: 게스트 PIN 입력 폼 구조 정리 (completed 1회, last QA-20260226-0001)
- modal-backdrop-close: 모달 백드롭 클릭 닫기 안정화 (completed 2회, last QA-20260226-0002)
- planning-backlog-clear: planning TODO 잔여 항목 정리 (completed 1회, last QA-20260226-0006)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-test-gate: Release DoD: validate:all (tsc + lint + test) 전체 통과 (completed 1회, last QA-20260226-0008)
- 게스트-pin-로그인-후-시스템-시작-버튼-노출: 게스트 PIN 로그인 후 시스템 시작 버튼 노출 (completed 1회, last QA-20260227-0010)
- 로그인-정책-카피-정합성: 로그인 정책 카피 정합성 (completed 1회, last QA-20260227-0010)
- 비로그인-시스템-시작-가드-모달-동작: 비로그인 시스템 시작 가드 모달 동작 (completed 1회, last QA-20260227-0010)

## Recent Runs

| Run ID | Time (UTC) | Title | Checks | Completed | Pending | Expert Gaps |
|---|---|---|---:|---:|---:|---:|
| QA-20260227-0016 | 2026-02-26T18:34:32.172Z | Vercel Playwright QA - 로그인 정책/시스템 시작 가드 재검증 | 2 | 3 | 0 | 2 |
| QA-20260227-0015 | 2026-02-26T18:11:05.996Z | Vercel Playwright QA - 랜딩 로그인 모달 카피 배포 정합성 재검증 | 2 | 2 | 2 | 3 |
| QA-20260227-0014 | 2026-02-26T18:03:30.997Z | Vercel Playwright QA - 로그인 정책/시스템 시작 가드 배포 검증 | 3 | 3 | 1 | 2 |
| QA-20260227-0013 | 2026-02-26T17:50:54.243Z | Vercel Playwright QA - 시스템 시작 가드/게스트 PIN 체험 흐름 재검증 | 2 | 2 | 3 | 2 |
| QA-20260227-0012 | 2026-02-26T17:46:29.032Z | Vercel Playwright QA - 로그인 정책/시스템 시작 UX 보강 (재기록) | 3 | 2 | 0 | 2 |
| QA-20260227-0011 | 2026-02-26T17:46:20.701Z | Vercel Playwright QA - 로그인 정책/시스템 시작 UX 보강 | 0 | 2 | 0 | 1 |
| QA-20260227-0010 | 2026-02-26T16:36:37.248Z | Vercel Playwright QA - 시스템 시작/게스트 PIN | 2 | 5 | 1 | 2 |
| QA-20260226-0009 | 2026-02-26T14:07:55.933Z | P1 Closeout — unit-tests / copy-alignment / nav-landmarks | 5 | 3 | 0 | 0 |
| QA-20260226-0008 | 2026-02-26T13:10:43.480Z | P1 Release DoD — test-gate / contract-test / cost-gate verified | 6 | 3 | 0 | 0 |
| QA-20260226-0007 | 2026-02-26T12:03:08.146Z | P0 DoD Closeout — tsc/lint zero-error verified | 3 | 2 | 0 | 0 |
| QA-20260226-0006 | 2026-02-26T12:00:38.039Z | Technical Debt Closeout - Admin Auth Role Validation | 4 | 3 | 0 | 4 |
| QA-20260226-0005 | 2026-02-26T11:25:45.950Z | DoD-Gap Analysis for Final QA Closeout | 10 | 2 | 9 | 4 |
| QA-20260226-0004 | 2026-02-26T11:24:21.055Z | Domain Fit Review vs Industry Best Practices | 8 | 0 | 3 | 4 |
| QA-20260226-0003 | 2026-02-26T11:15:22.325Z | Final QA Domain-Fit Review for Project Closure | 6 | 1 | 3 | 3 |
| QA-20260226-0002 | 2026-02-26T11:13:57.091Z | Vercel Playwright QA - Login/Modal/Copy Alignment | 12 | 1 | 2 | 0 |
| QA-20260226-0001 | 2026-02-26T10:50:26.077Z | Portfolio QA Tracking Setup + P0/P1 Fix Verification | 5 | 4 | 1 | 0 |

