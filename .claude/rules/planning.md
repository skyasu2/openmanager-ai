# Planning Rules

## 작업 시작 전 필수 확인 (모든 AI 공통)

새 작업을 시작하기 전에 반드시 아래 순서로 확인한다.

```
1. reports/planning/TODO.md 읽기 → Active Task, Backlog 파악
2. reports/planning/*.md 목록 확인 → 관련 plan 파일 존재 여부
3. 기존 파일 있으면 수정, 없으면 신규 조건 충족 시만 생성
```

## 신규 계획서 생성 금지 조건

아래 중 하나라도 해당하면 신규 plan 파일을 만들지 않는다.

| 상황 | 대신 할 것 |
|------|-----------|
| 기존 plan 파일과 주제가 70%+ 겹침 | 기존 파일 Task 목록에 추가 |
| TODO.md Backlog에 이미 같은 항목 존재 | Backlog 항목을 plan 파일로 승격만 |
| 단일 버그 수정·소규모 리팩터링 | TODO.md Completed 1줄 기록으로 충분 |
| 이미 완료된 작업 재계획 | archive/ 확인 후 필요 시 참조만 |

## TODO.md ↔ plan 파일 중복 금지

- TODO.md: Active Task 요약 1줄 + plan 파일 링크
- plan 파일: 상세 범위, Task 목록, 검증 결과
- **같은 내용을 두 곳에 모두 쓰지 않는다**

## 계획서 소유권

- `Owner` 필드: 반드시 `project`. AI 이름 사용 금지.
- 어떤 AI든 동일한 plan 파일을 읽고 Task 상태를 갱신할 수 있다.

## 완료 처리

1. plan 파일 내 모든 Task `[x]` 체크
2. TODO.md Recent Completed에 요약 1줄 추가
3. plan 파일 → `reports/planning/archive/` 이동

## SDD 게이트 (구현 착수 전 필수)

plan 파일이 있는 작업은 아래 게이트를 통과해야 구현을 시작할 수 있다.

```
1. plan 파일 Status 확인
   - Draft       → 계약 섹션(Contract) 먼저 완성 후 Approved로 변경
   - Approved    → 구현 착수 가능
   - plan 없음   → 단순 작업: TODO.md 1줄 / 복잡 작업: plan 파일 생성(Draft→Approved)

2. Approved 확인 후 → 테스트 시나리오 failing test 먼저 커밋
   커밋 메시지: test(spec): [기능명] add failing tests before implementation

3. 그 다음 → 구현 커밋
   커밋 메시지: feat: [기능명] implement to pass specs
```

> ⚠️ **test(spec): 선행 누락 금지** — feat: 커밋을 `test(spec):` 없이 올리면 SDD 게이트가 발동되지 않은 것이다.
> Codex 위임 시에도 동일하게 적용된다. `test(spec):` 커밋을 먼저 올린 뒤 구현을 위임할 것.
> 단, "단일 버그 수정·소규모 리팩터링"은 예외 — failing test 선행 없이 fix + test 동시 커밋 허용.

**plan 파일 Status 허용 값**: `Draft` | `Approved` | `In Progress` | `Completed`
**금지 값**: `Active`, `Active Supporting` (→ 실제 상태에 따라 `Draft` 또는 `In Progress`로 변환)

**예외**: 단일 버그 수정·소규모 리팩터링은 게이트 없이 TODO.md 1줄 처리로 충분하다.

## 참조

- 계획서 운영 전체 규칙: `reports/planning/README.md`
- 현재 상태 SSOT: `reports/planning/TODO.md`
