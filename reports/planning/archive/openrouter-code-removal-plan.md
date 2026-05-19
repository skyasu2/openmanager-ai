> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-19
> Tags: ai-engine,provider,vision,free-tier

# OpenRouter Code Removal Plan

- 상태: Completed
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > OpenRouter 코드 경로 제거 및 provider 상태 재확인

## 목표

OpenRouter를 더 이상 opt-in fallback으로도 유지하지 않고, runtime code path에서 제거한다.
Vision Agent는 `Gemini -> Z.AI`만 사용하고, 둘 다 사용할 수 없으면 기존처럼 Analyst fallback으로 degrade한다.

## 비목표

- Gemini/Z.AI 외 신규 vision provider 도입
- Cloud Run 리소스 증설
- 실제 이미지 분석을 여러 provider로 반복 호출하는 무거운 smoke 추가
- 과거 QA/archive 기록의 역사적 OpenRouter 언급 일괄 삭제

## 계약

| 경계 | 변경 전 | 변경 후 |
|------|---------|---------|
| Provider status | `openrouter` key/status 노출 가능 | runtime provider status에서 OpenRouter 제거 |
| Vision model selection | `Gemini -> Z.AI -> opt-in OpenRouter` | `Gemini -> Z.AI` |
| Provider metadata | OpenRouter disabled/red metadata 포함 | OpenRouter metadata 미노출 |
| Frontend provider config | OpenRouter provider card 가능 | OpenRouter provider card 제거 |
| Env example | `OPENROUTER_*` 예시 존재 | OpenRouter env 예시 제거 |
| Health check | opt-in OpenRouter health 가능 | Gemini/Z.AI/text providers만 확인 |

## 테스트 시나리오

- [x] Vision selector는 Gemini 성공 시 Gemini를 반환한다.
- [x] Gemini 실패/미구성 시 Z.AI Vision을 반환한다.
- [x] Gemini/Z.AI 모두 불가하면 null을 반환하고 OpenRouter를 시도하지 않는다.
- [x] Provider metadata/status/toggle 응답에 OpenRouter가 포함되지 않는다.
- [x] Config parser status에 OpenRouter가 포함되지 않는다.
- [x] 실환경 `/api/ai/providers`로 Gemini/Z.AI/text provider 상태를 확인한다.

## 작업

- [x] T1 — OpenRouter provider type/config/model factory 제거
- [x] T2 — Vision selector와 runtime policy를 Gemini/Z.AI 계약으로 정렬
- [x] T3 — provider metadata/status/API/frontend config에서 OpenRouter 제거
- [x] T4 — 테스트/문서/env example 정렬
- [x] T5 — type/test/live status 확인
