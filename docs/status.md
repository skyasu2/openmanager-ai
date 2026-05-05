# 프로젝트 현재 상태

> 프로젝트 버전별 변경 이력과 운영 상태 요약
> Owner: documentation
> Status: Active
> Doc type: Status
> Last reviewed: 2026-05-05
> Canonical: docs/status.md
> Tags: status,changelog,release

**상태 스냅샷 기준일**: 2026-05-05 | **문서 역할 재정리**: 2026-05-05 | **현재 버전 스냅샷**: v8.11.97 | **완성도**: 97.5%+ 정성 기준 (→ [재평가 상세](../reports/planning/archive/completion-review.md#추록-v820--v8119-재평가))

## 상태 문서 역할 분리

- 이 문서는 사람이 읽는 **프로젝트/릴리스 상태 스냅샷**입니다.
- 현재 작업 상태의 SSOT는 [`reports/planning/TODO.md`](../reports/planning/TODO.md)입니다.
- 최신 QA 운영 상태의 SSOT는 [`reports/qa/qa-tracker.json`](../reports/qa/qa-tracker.json)입니다.
- 최신 QA 대시보드는 자동 생성 문서 [`reports/qa/QA_STATUS.md`](../reports/qa/QA_STATUS.md)입니다.
- 따라서 **현재 QA 게이트 판정, 최근 run 수치, open gap 여부**는 `docs/status.md`가 아니라 `TODO.md` / `qa-tracker.json` / `QA_STATUS.md`를 기준으로 판단합니다.
- 이 문서는 버전 단위 변화, 상위 수준 진행도, 주요 릴리스 메모를 요약하는 데에만 사용합니다.

## 현재 스냅샷

- 제품 성격: AI 기반 서버 모니터링 플랫폼
- Frontend: Next.js App Router 기반 UI를 Vercel에 배포
- AI Engine: Cloud Run 분리 배포
- 데이터 기준: `public/data/otel-data/` synthetic OTel snapshot SSOT
- 운영 데이터/인증: Supabase + Redis 계열 의존
- 핵심 사용자 흐름:
  - 랜딩 -> 인증 -> 대시보드
  - AI Assistant 질의 -> 분석 -> 조치안/보고서
  - QA/운영 증거 누적 -> `reports/qa/`

## 현재 기준 문서

- 프로젝트 개요: [`README.md`](../README.md)
- 작업 현재 상태 SSOT: [`reports/planning/TODO.md`](../reports/planning/TODO.md)
- QA 상태 SSOT: [`reports/qa/qa-tracker.json`](../reports/qa/qa-tracker.json)
- QA 대시보드: [`reports/qa/QA_STATUS.md`](../reports/qa/QA_STATUS.md)
- AI 설정 SSOT: [`config/ai/registry-core.yaml`](../config/ai/registry-core.yaml)
- AI Engine 아키텍처: [AI Engine Architecture](reference/architecture/ai/ai-engine-architecture.md)
- OTel 데이터 아키텍처: [OTel 데이터 아키텍처](reference/architecture/data/otel-data-architecture.md)

## 최근 주요 릴리스 스냅샷

- **v8.11.97** (2026-05-05)
  - broad QA remediation 진행 중, AI 응답/metric drift/formatting follow-up 보정 근거가 `reports/qa`에 누적됨
  - 설계/운영 문서 구조를 `architecture`, `design`, `operations`, `adr`, `reference` 기준으로 재정렬
- **v8.11.88~v8.11.96** (2026-05-03~2026-05-04)
  - AI streaming UI, `/api/ai/ask` facade, planner shadow, `MonitoringFactPack`, deterministic recovery/fallback 품질 보강
- **v8.11.9** (2026-04-10)
  - 툴링 정비, artifact 정책 강화, QA 인프라 정리
  - 완성도 재평가: `97.5%`
- **v8.11.0** (2026-04-07)
  - release/tag 정리, node suite 최적화, 공개 snapshot 동기화
- **v8.10.10** (2026-04-06)
  - targeted production smoke QA pass, release evidence 경로 강화
- **v8.9.2** (2026-03-17)
  - observability tracing 강화, feedback trace/status 안정화

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
