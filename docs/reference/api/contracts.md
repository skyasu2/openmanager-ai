# API Contracts (Contract-First Reference)

> API 엔드포인트 계약 중심 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/reference/api/contracts.md
> Tags: api,reference,contract,openapi

## 목적

`endpoints.md`는 코드에서 생성되는 엔드포인트/메서드 목록만 유지합니다. 본 문서는 실제 라우트 동작을 기준으로 요청 파라미터, 응답 코드, 주요 헤더, 에러 계약을 정리합니다.

포트폴리오 문서 예산상 모든 route의 상세 계약을 고객 납품형 명세처럼 완성하지 않습니다. 사용자/운영 안정성에 직접 영향이 큰 핵심 route를 우선 문서화하고, 나머지는 route test와 generated endpoint catalog를 기준으로 추적합니다.

## 계약 산출물

- 엔드포인트 카탈로그: [endpoints.md](./endpoints.md)
- OpenAPI 스펙(현재 축소판): [openapi-v1.yaml](./openapi-v1.yaml)
- 계약 테스트:
  - [tests/api/api-contract.test.ts](../../../tests/api/api-contract.test.ts)
  - [tests/api/cloud-run-contract.test.ts](../../../tests/api/cloud-run-contract.test.ts)
  - [tests/api/ai-supervisor-stream.contract.test.ts](../../../tests/api/ai-supervisor-stream.contract.test.ts)

## 엔드포인트 계약 격차(요약)

| Path | Method | 현재 문서 상태 | 핵심 갭 |
|---|---|---|---|
| `/api/health` | GET | GET/HEAD 기본 동작, `simple`/`service` 질의, 200/503/캐시 헤더 문서화됨 | 현재 파악된 미해결 갭 없음 |
| `/api/ai/artifact-intent` | POST | artifact intent local/LLM-gated classifier route test 존재 | OpenAPI 반영은 artifact schema registry 작업 시 검토 |
| `/api/ai/jobs` | GET, POST | 인증/레이트리밋/세션·limit 파라미터/상태코드(201/400/401/500/503/429) 문서화됨 | `limit` 파싱 정합성은 문서 1:1 기준 적용 완료 |
| `/api/ai/jobs/{id}` | GET, DELETE | 경로 파라미터, 상태코드(200/400/404/500/401), `X-Job-Status`, 캐시 헤더 정합 | 현재 문서 상태와 라우트 동작 모두 일치 |
| `/api/ai/jobs/{id}/retry` | POST | ownership/readiness/rate-limit route test 존재 | OpenAPI 스니펫 추가는 선택 |
| `/api/servers` | GET | `deprecated`, `/api/servers-unified?action=list` 위임 경로, 200/400/401/500 문서화됨 | 남은 갭 없음 |
| `/api/servers-unified` | GET, POST | `action`, 쿼리/바디, `X-RateLimit-*` 헤더, 200/400/404/500/401 문서화됨 | `details` 에러 페이로드 상세화는 선택(상세 디버그용) |
| `/api/ai/supervisor/stream/v2` | GET, POST | SSE 헤더/쿼리/상태코드(200/204/400/401/429/500/503) 정리됨 | 실패 응답 SSE/JSON 경로를 계약 기준으로 추가 반영 |
| `/api/security/csp-report` | GET, POST, OPTIONS | 200/204/400 분기, 헤더, preflight 동작 문서화됨 | 남은 갭 없음 |
| `/api/web-vitals` | POST | field metric 수집 route test 존재 | 운영 관측 route로 최소 계약 유지, OpenAPI 상세는 선택 |

## 다음 단계 권장

1. route 추가/삭제 시 `npm run docs:api:endpoints` 또는 `npm run docs:api:endpoints:check`로 catalog drift를 먼저 확인
2. 사용자-facing 또는 운영-critical route만 `openapi-v1.yaml`에서 상세 계약으로 승격
3. 계약 테스트의 응답 스키마를 라우트 구현 스키마와 1:1 매핑
4. 라우트 deprecation 처리(예: `/api/servers`)를 release note + `deprecated` 플래그로 명시
