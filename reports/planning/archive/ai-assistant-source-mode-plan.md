> Owner: project
> Status: Completed
> Last reviewed: 2026-04-28

# AI Assistant Source Mode Contract Plan

## 1. 목적

AI Chat 입력창 도구 메뉴의 `RAG 검색`/`Web 검색`을 상용 AI의 source scope 패턴에 맞춰
기술 토글이 아니라 소스 사용 정책으로 정리한다.

사용자-facing 이름은 기존 용어를 유지하되 짧은 괄호 설명을 붙인다.

- `RAG 검색 (내부 지식)`
- `Web 검색 (외부 웹)`

## 2. 기준 계약

| UI 상태 | 요청 payload | 기대 동작 |
|---------|--------------|-----------|
| Auto | `enableRAG`/`enableWebSearch` 생략 | Cloud Run이 질의 성격으로 보수적으로 자동 판단 |
| On | 해당 옵션 `true` 전달 | 사용자가 명시적으로 도구 사용을 허용 |

`Off`는 이번 UI 범위에서 노출하지 않는다. Cloud Run의 `false` opt-out 계약은 backend/API 호환용으로 유지한다.

## 3. 구현 범위

- ChatInputArea 도구 메뉴를 `Auto / On` segmented control로 변경
- `RAG 검색`과 `Web 검색` 이름은 유지하고 괄호 설명을 추가
- Auto 상태에서 frontend가 `false`를 보내지 않도록 요청 옵션 생성 로직을 공통화
- Streaming, Job Queue, local dev fallback 경로의 source option 전달을 동일하게 정렬
- Web Auto는 backend의 기존 conservative auto-detection을 사용

## 4. 검증 기준

- ChatInputArea 테스트가 `Auto / On` UI와 parenthetical label을 고정한다.
- source option helper 테스트가 Auto일 때 옵션 생략, On일 때 `true` 전달을 고정한다.
- useQueryExecution 테스트가 Job Queue Auto 요청에서 source 옵션을 생략함을 고정한다.

## 5. 완료 결과

- `RAG 검색 (내부 지식)`, `Web 검색 (외부 웹)` parenthetical label 적용
- 입력창 도구 메뉴 source controls를 `Auto / On` segmented control로 변경
- Auto는 request flag를 생략하고 Cloud Run conservative auto-detection을 사용하도록 공통 helper 적용
- Streaming, Job Queue, local dev fallback, stream redirect Job Queue 경로의 source option 생성 방식 정렬
