# AI Assistant Off-Domain Guard Plan

**Status**: Completed  
**Owner**: project  
**Priority**: P2  
**Created**: 2026-05-10  
**Last Updated**: 2026-05-10  

## Context

Vercel AI Assistant edge QA에서 비 IT 질문 일부가 LLM 추측 응답으로 새어 나갔다.

- `QA-20260510-0458`: 7개 비 IT/경계 질문 중 2 FAIL, 1 WARN
- FAIL: 비트코인 현재가 질문에 근거 없는 정확한 금액 응답
- FAIL: 캘린더 연동 도구 없이 회의 일정을 등록한 것처럼 응답
- WARN: 지역 맛집 추천에서 최신 영업/리뷰 확인 한계를 충분히 고지하지 않음

현재 코드 상태에서는 `query-classifier`가 `off-domain`을 감지하지만,
`useQueryExecution`은 warning만 설정하고 요청을 계속 streaming/job 경로로 전송한다.

## Goal

AI Assistant가 서버 운영·모니터링 범위를 벗어난 질문에 대해 아래 원칙을 지키도록 한다.

1. 실시간 외부 사실을 현재값처럼 추측하지 않는다.
2. 캘린더/예약/메일 같은 외부 작업을 수행했다고 말하지 않는다.
3. 맛집/날씨/가격/뉴스 같은 최신성 의존 질문은 확인 한계를 먼저 고지한다.
4. 서버명, CPU, 메모리, 디스크, 장애, RAG/KRL 등 운영 질문은 기존 라우팅을 유지한다.

## Contract

### Input

- 사용자 자연어 질문
- 선택적 파일 첨부

### Deterministic Guard Categories

| Category | Examples | Required Behavior |
|----------|----------|-------------------|
| `live_fact` | 날씨, 뉴스, 환율, 주가, 비트코인 가격 | 실시간 조회 도구가 없음을 알리고 외부 확인 경로를 안내한다. LLM 호출 금지 |
| `external_action` | 일정 등록, 예약, 메일/문자 전송 | 직접 실행할 수 없음을 알리고 사용자가 복사할 수 있는 초안만 제공한다. LLM 호출 금지 |
| `local_recommendation` | 맛집, 병원, 장소 추천 | 최신 영업/리뷰 확인 불가를 고지하고 일반 선택 기준만 제공한다. LLM 호출 금지 |
| `personal_general` | 점심 메뉴, 운세 등 운영 무관 생활 질문 | 운영 AI 범위를 고지하고 일반 조언 수준으로 제한한다. LLM 호출 금지 |

### Exclusions

아래 신호가 있으면 off-domain guard를 적용하지 않는다.

- 등록 서버 ID 또는 서버명 패턴
- 서버/인프라/모니터링/장애/로그/CPU/MEM/DISK/네트워크 문맥
- topology, architecture, KRL/RAG, 운영 보고서 문맥
- 파일 첨부가 있는 Vision 분석 요청

### Output

- Guarded response는 한국어 deterministic 템플릿이다.
- `sendMessage`, `asyncQuery.sendQuery`, Cloud Run streaming/job 호출을 실행하지 않는다.
- UI에는 사용자 메시지와 assistant guard 응답을 남긴다.
- 상태는 `isLoading=false`, `warning`에 범위 제한 메시지를 남긴다.

## Tasks

- [x] Task 0: failing regression tests 추가
- [x] Task 1: off-domain guard utility 추가 및 classifier와 패턴 정렬
- [x] Task 2: `useQueryExecution`에서 guard hit 시 LLM/job 경로 short-circuit
- [x] Task 3: root app 검증 (`type-check`, `lint`, `test:quick`, 필요 시 `test:contract`)
- [x] Task 4: QA 기록 및 TODO/plan closure

## Validation

- Targeted DOM Vitest: `src/hooks/ai/core/useQueryExecution.test.ts` 14/14 PASS
- Targeted node Vitest: `src/lib/ai/off-domain-guard.test.ts`, `src/lib/ai/query-classifier.test.ts` 60/60 PASS
- `npm run type-check` PASS
- `npm run lint` PASS (기존 `qa-tracker.json` max-size info only)
- `npm run test:quick` PASS
- `npm run test:contract` PASS (24/24)
- `npm run docs:budget` PASS (active docs 72/90)
- `npm run docs:ai-consistency` PASS
- `git diff --check` PASS
- QA 기록: `QA-20260510-0459`
- 후속: semver tag 배포 이후 Vercel production 비 IT 질문 세트 재검증

## Non-Goals

- 실시간 웹 검색/거래소/날씨 API 신규 연결
- 캘린더/메일/예약 tool 신규 구현
- AI Assistant를 범용 챗봇으로 확장
