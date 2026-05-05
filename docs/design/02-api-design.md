# API 상세 설계

> Next.js BFF route와 Cloud Run AI Engine API 계약을 설명하는 상세 설계
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/02-api-design.md
> Tags: design,api,bff,contract

---

## 담당 범위

API 설계는 route 존재 여부보다 책임 경계와 계약 보존을 우선합니다. 엔드포인트 목록은 [API Endpoints](../reference/api/endpoints.md), 요청/응답 계약은 [API Contracts](../reference/api/contracts.md)를 기준으로 봅니다.

## 주요 API 그룹

| 그룹 | 대표 route | 책임 |
|---|---|---|
| Health/Version | `/api/health`, `/api/version` | 배포 상태, Cloud Run soft health, version evidence |
| Dashboard data | `/api/servers-unified`, `/api/metrics`, `/api/monitoring/report` | OTel data를 UI 친화 shape로 변환 |
| AI stream | `/api/ai/supervisor/stream/v2` | Cloud Run UIMessageStream proxy, auth/security/context shaping |
| AI facade | `/api/ai/ask` | 기존 stream/job/artifact route를 wrapper-only로 감싸는 opt-in facade |
| AI job | `/api/ai/jobs/**` | Redis job state, SSE polling, Cloud Tasks dispatch trigger |
| AI artifacts | `/api/ai/incident-report`, `/api/ai/intelligent-monitoring`, `/api/ai/artifact-intent` | artifact intent와 deterministic/LLM-gated artifact 생성 |
| Auth/Security | `/api/auth/**`, `/api/csrf-token`, `/api/security/csp-report` | 인증, CSRF, CSP reporting |

## 설계 원칙

- Vercel route는 BFF/proxy/contract preservation 역할에 집중합니다.
- Cloud Run route는 AI execution과 job worker 역할에 집중합니다.
- `/api/ai/ask`는 독립 구현이 아니라 기존 route 위임 facade입니다.
- route 추가/삭제는 API catalog와 architecture 문서를 같이 갱신합니다.
- 실패 응답은 code/source/requestId/recoverable 같은 진단 가능한 metadata를 유지합니다.

## 하면 안 되는 것

- BFF route에서 장시간 multi-agent 작업을 직접 완료하려고 하지 않습니다.
- stream route와 job route의 의미를 섞어 progress/result contract를 깨지 않습니다.
- artifact intent가 불확실한 요청을 자동으로 LLM-heavy artifact pipeline으로 승격하지 않습니다.
- auth/session/security 처리를 우회하는 내부 route를 새로 만들지 않습니다.

## 상세 문서

- [API Endpoints](../reference/api/endpoints.md)
- [API Contracts](../reference/api/contracts.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [Runtime Architecture](../architecture/02-runtime-architecture.md)
