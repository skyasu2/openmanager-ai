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

## 참조

- 계획서 운영 전체 규칙: `reports/planning/README.md`
- 현재 상태 SSOT: `reports/planning/TODO.md`
