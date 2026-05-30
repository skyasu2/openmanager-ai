# 프로젝트 현재 상태

> 프로젝트 버전별 변경 이력과 운영 상태 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-30
> Canonical: docs/status.md
> Tags: status,changelog,release

<!-- AUTO:version-header -->
**상태 스냅샷 기준일**: 2026-05-30 | **현재 버전 스냅샷**: v8.12.81
<!-- /AUTO:version-header -->

## 상태 문서 역할 분리

- 이 문서는 사람이 읽는 **프로젝트/릴리스 상태 스냅샷**입니다.
- 현재 작업 상태의 SSOT는 [`reports/planning/TODO.md`](../reports/planning/TODO.md)입니다.
- 최신 QA 운영 상태의 SSOT는 [`reports/qa/qa-tracker.json`](../reports/qa/qa-tracker.json)입니다.
- 최신 QA 대시보드는 자동 생성 문서 [`reports/qa/QA_STATUS.md`](../reports/qa/QA_STATUS.md)입니다.
- 따라서 **현재 QA 게이트 판정, 최근 run 수치, open gap 여부**는 `docs/status.md`가 아니라 `TODO.md` / `qa-tracker.json` / `QA_STATUS.md`를 기준으로 판단합니다.
- 이 문서는 버전 단위 변화, 상위 수준 진행도, 주요 릴리스 메모를 요약하는 데에만 사용합니다.

## 현재 스냅샷

- 제품 성격: synthetic 서버 모니터링 제품에 AI Assistant / Agent 모듈을 결합한 포트폴리오형 플랫폼
- Frontend: Next.js App Router 기반 UI를 Vercel에 배포
- AI Engine: Cloud Run 분리 배포
- 데이터 기준: `public/data/otel-data/` synthetic OTel snapshot SSOT
- 운영 데이터/인증: Supabase + Redis 계열 의존
- 핵심 사용자 흐름:
  - 랜딩 -> 인증 -> 대시보드
  - 서버 모니터링 core surface -> 서버 상세/로그/알림/토폴로지 탐색
  - 전역 AI Assistant sidebar 또는 `/dashboard/ai-assistant` -> 질의/분석/조치안/보고서
  - QA/운영 증거 누적 -> `reports/qa/`
- 로컬 개발 기준:
  - 현재 WSL2 `/mnt/d` 개발 경로는 `next dev --webpack`을 표준으로 사용합니다.
  - `node_modules`는 ext4 경로 symlink를 유지하고, Turbopack 진단은 ext4 내부 repo 또는 별도 trace 목적일 때만 사용합니다.
  - 근거: `QA-20260508-0421`/`QA-20260508-0422`에서 local dev blocked, `QA-20260508-0423`에서 webpack fallback preflight 복구 확인.

## 현재 기준 문서

| 질문 | 문서 |
|------|------|
| 프로젝트 개요 | [`README.md`](../README.md) |
| 실제 산출물 목록 | `README.md` + `src/`/`cloud-run/` 소스 구조 + API/architecture reference (WBS 삭제, git history 보존) |
| Done 판정 기준 (DoD) | [`docs/reference/project/definition-of-done.md`](reference/project/definition-of-done.md) |
| 지금 열린 작업 | [`reports/planning/TODO.md`](../reports/planning/TODO.md) |
| QA 상태 SSOT | [`reports/qa/qa-tracker.json`](../reports/qa/qa-tracker.json) |
| QA 대시보드 | [`reports/qa/QA_STATUS.md`](../reports/qa/QA_STATUS.md) |
| AI 설정 SSOT | [`config/ai/registry-core.yaml`](../config/ai/registry-core.yaml) |
| AI Engine 아키텍처 | [AI Engine Architecture](reference/architecture/ai/ai-engine-architecture.md) |
| v8.1.0 이전 이력 | `git log` (파일 삭제, git history로 보존) |

## 최근 주요 릴리스 스냅샷

<!-- AUTO:releases -->
- **v8.12.81** (2026-05-30) — Bug Fixes: ai-chat: normalize loose bold/hr markdown from AI Engine
- **v8.12.80** (2026-05-30) — Bug Fixes: ai-chat: replace custom markdown renderer with react-markdown; Bug Fixes: landing: generalize OTel dataset copy; Tests: qa: record v8.12.79 new-question evaluation (QA-20260530-0645)
- **v8.12.79** (2026-05-30) — Bug Fixes: ai-engine: route all-scope average metric queries; Tests: qa: record v8.12.78 release smoke
- **v8.12.78** (2026-05-30) — Tests: qa: close superseded Q5 metadata item; Tests: ai-engine: align stream routing history expectations; Tests: qa: record Q5 contextual follow-up QA + label-clarity fix verification
- **v8.12.77** (2026-05-29) — Code Refactoring: remove dead legacy files; Code Refactoring: remove unused exports; Bug Fixes: ops: guard cloud build dockerfile compatibility
<!-- /AUTO:releases -->

세부 변경 이력은 Git history와 관련 plan/archive 문서를 기준으로 확인합니다.

## 운영 규칙

- 이 문서는 **매 QA run마다 갱신하지 않습니다**.
- 다음 경우에만 갱신합니다.
  - release tag 또는 버전 스냅샷 정리 시점
  - 상위 아키텍처나 개발 방법론이 크게 바뀐 시점
  - 포트폴리오/외부 설명 기준 문구를 재정렬할 때
- 세부 수치, 최신 QA pass/fail, pending gap은 자동/누적 상태 문서에서 관리합니다.

## 문서 관리 메모

- `docs/status.md`는 live dashboard가 아니라 snapshot 문서입니다.
- 상세 상태를 이 문서에 다시 중복 기록하지 않습니다.
- 과거 상세 상태/스택/품질 수치는 Git history에서 추적 가능합니다.
