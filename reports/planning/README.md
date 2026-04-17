# Planning Directory

작업 계획서의 기본 저장소입니다.

## 디렉토리 구조

```text
reports/planning/
├── TODO.md          # 현재 상태 SSOT (Active/On Hold/Backlog/Recent Completed)
├── README.md        # 이 파일 — 운영 원칙
├── *.md             # 진행 중 상세 계획서
└── archive/         # 완료된 계획서 (Git 추적)
```

---

## 핵심 규칙 (모든 AI 공통)

### 작업 시작 전 반드시 확인

1. `TODO.md`를 읽어 현재 Active Task, Backlog, On Hold를 확인한다.
2. `reports/planning/*.md` 목록을 확인해 관련 plan 파일이 이미 있는지 확인한다.
3. 기존 파일이 있으면 **신규 파일을 만들지 않고** 기존 파일을 수정한다.

### 신규 계획서 생성 조건 (AND 조건)

아래 **세 가지를 모두 만족**해야 신규 plan 파일을 생성할 수 있다.

- [ ] TODO.md에 등록되지 않은 새로운 작업인가?
- [ ] 기존 plan 파일과 70% 미만 겹치는가?
- [ ] 단일 커밋/PR로 처리할 수 없는 다단계 작업인가?

세 조건 중 하나라도 불충족이면 **기존 plan 파일 수정** 또는 **TODO.md에 1줄 추가**로 대신한다.

### 중복 방지 체크리스트

신규 plan 파일을 만들기 전에 아래 질문에 답한다:

```
Q1. 같은 주제의 plan 파일이 reports/planning/에 이미 있는가?
    → 있으면: 해당 파일의 Task 목록에 항목 추가

Q2. 이미 완료된 작업을 다시 계획서로 쓰려는 것은 아닌가?
    → 완료된 작업: TODO.md Completed 항목 또는 archive/

Q3. TODO.md Backlog에 이미 같은 항목이 있는가?
    → 있으면: Backlog 항목을 plan 파일로 승격 (신규 생성 아님)
```

---

## 소유권 원칙

- **소유자: 프로젝트**. AI는 편집 주체이지 소유자가 아니다.
- `Owner` 필드: 항상 `project`. AI 이름(`Claude`, `Codex` 등) 사용 금지.
- Claude, Codex, Gemini 누구든 동일한 plan 파일을 읽고 상태를 갱신할 수 있다.

## 문체 원칙

- 사실, 범위, 검증 결과, 완료 기준 중심으로 작성
- 도구/모델 개인 감상, 주관적 평가 금지
- 다른 AI가 이어받아도 맥락 없이 바로 실행 가능해야 함
- 같은 사실을 여러 문서에 중복 기록하지 않음

---

## SSOT 기준

| 내용 | 위치 |
|------|------|
| 현재 Active/Backlog/On Hold 요약 | `TODO.md` |
| 복잡한 작업의 상세 판단·범위·검증 | 개별 plan 파일 |
| 완료 후 상세 이력 | `archive/` |

**금지**: TODO.md와 plan 파일에 같은 정보를 중복 기록하지 않는다.
- TODO.md: 상태 요약 1줄 + plan 파일 링크
- plan 파일: 상세 범위, Task 목록, 검증 결과

## SDD 게이트 — Status 워크플로우

plan 파일의 `Status` 필드는 아래 순서로만 전진한다.

```
Draft → Approved → In Progress → Completed
```

| Status | 의미 | 구현 착수 가능 여부 |
|--------|------|:------------------:|
| Draft | 배경·범위·계약 작성 중 | ❌ 불가 |
| Approved | 계약 섹션 완성 + AI 리드 확인 완료 | ✅ 가능 |
| In Progress | 구현 진행 중 | ✅ 진행 중 |
| Completed | 전체 Task [x] + QA 통과 | — archive 이동 |

**규칙**: Status가 `Approved` 이상이 아니면 구현 Task에 착수할 수 없다.

## 라이프사이클

```
TODO.md Backlog 등록
  → plan 파일 생성 (신규 기능/대규모 리팩터링/계약 변경 등 다단계 작업), Status: Draft
  → 계약 섹션 작성 완료 → Status: Approved
  → 구현 착수: 테스트 시나리오 failing test 먼저 커밋
  → 실행 중: plan 파일 Task 체크, TODO.md 상태 갱신, Status: In Progress
  → 완료: TODO.md에 요약 1줄 + plan 파일 archive 이동, Status: Completed
```

---

## 계획서 작성 기준

| 상황 | plan 파일 필요 여부 |
|------|-------------|
| 신규 기능 | ✅ 필수 |
| 대규모 리팩터링 | ✅ 필수 |
| 계약 변경 (API/AI/auth/monitoring/ai-engine schema) | ✅ 필수 |
| 아키텍처 변경 | ✅ 필수 |
| 마이그레이션 | ✅ 필수 |
| 다단계 기능 구현 (3 Task 이상) | ✅ 권장 |
| 단일 버그 수정 | ❌ TODO.md 1줄로 처리 |
| 소규모 리팩터링 | ❌ TODO.md 1줄로 처리 |
| UI copy / 문서 전용 변경 | ❌ TODO.md 1줄로 처리 |

파일명: `kebab-case-plan.md` (예: `ai-engine-refactor-plan.md`)

## 최소 템플릿

```markdown
> Owner: project
> Status: Draft | Approved | In Progress | Completed
> Last reviewed: YYYY-MM-DD

# [주제] Plan

- 상태: Draft
- 작성일: YYYY-MM-DD
- TODO.md 연결: Active Tasks > [항목명]

## 목표
...

## 범위
- 포함: ...
- 제외: ...

## 계약 (Contract)
> Status를 Approved로 올리기 전에 이 섹션을 완성해야 한다.

### 변경 대상 파일
- `src/path/to/file.ts`

### 입출력 계약
| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `functionName` | `InputType` | `OutputType` | `ErrorType` |

### 테스트 시나리오 (구현 전 확정)
- [ ] 시나리오 1: [정상 케이스] — 기대 결과: ...
- [ ] 시나리오 2: [에러 케이스] — 기대 결과: ...

## Task 목록
> 착수 전 Status가 Approved인지 확인한다.
- [ ] Task 0 — failing test 커밋 (테스트 시나리오 기반)
- [ ] Task 1 — 완료 기준: ...
- [ ] Task 2 — 완료 기준: ...

## 완료 기준
- [ ] 테스트 시나리오 전체 통과
- [ ] type-check 통과
- [ ] ...
```

## 운영 규칙

- API 키, 토큰, 시크릿 기록 금지
- `docs/archived/`는 계획서 보관 위치로 사용하지 않음
- 작업 회고는 `archive/YYYY-MM-DD-work-history.md` 형식
- 단일 버그 수정·소규모 리팩터링은 strict TDD/SDD 대상이 아니다.
- 단, 회귀 테스트를 쉽게 추가할 수 있는 경우에는 regression test를 우선한다.
- 회귀 테스트 추가가 비현실적이면 작업 보고에 간단한 justification을 남긴다.

_Last Updated: 2026-04-17 (strict TDD/SDD 적용 범위 명확화)_
