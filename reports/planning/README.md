# Planning Directory

작업 계획서의 기본 저장소입니다. SSOT는 `AGENTS.md`의 `Planning Docs Policy`를 따릅니다.

## 표준 구조

```text
reports/planning/
├── TODO.md                # 실행 우선순위/작업 큐
├── README.md              # 이 파일
├── *.md                   # 진행 중 계획서
├── refactoring/           # 리팩터링 전용 계획서(선택)
└── archive/               # 완료된 계획서 (Git 추적)
```

## 작성 기준

| 상황 | 계획서 권장 |
|------|-------------|
| 아키텍처 변경 | ✅ |
| 마이그레이션 | ✅ |
| 다단계 기능 구현 | ✅ |
| 단일 버그 수정 | 선택 |
| 소규모 리팩터링 | 선택 |

파일명은 `kebab-case` + `-plan.md`를 권장합니다.
- 예: `reports/planning/ai-engine-refactor-plan.md`

## 최소 템플릿

```markdown
# [주제] Plan

- 상태: 계획 수립 | 진행 중 | 완료
- 작성일: YYYY-MM-DD
- 목표: ...

## 배경
- ...

## 범위
- ...

## 단계
- [ ] Phase 1
- [ ] Phase 2

## 완료 기준
- [ ] ...
```

## 라이프사이클

```text
작성: reports/planning/*.md
진행: 상태 갱신 (계획 수립 → 진행 중)
완료: reports/planning/archive/ 로 이동 (상태: 완료)
```

## 운영 원칙

- `reports/history/`는 레거시 스냅샷 보관 경로이며 신규 완료본 저장 경로로 사용하지 않습니다.
- `docs/archived/`는 계획서 보관 위치로 사용하지 않습니다.
- API 키, 토큰, 시크릿, 실계정 식별자 등 민감정보를 기록하지 않습니다.
- Claude Code / Codex CLI / Gemini CLI 협업 시에도 최종 실행 계획서는 본 경로를 기준으로 유지합니다.

## 작업 이력 기록

- 전일 작업 회고/다음 방향 기록은 `reports/planning/archive/YYYY-MM-DD-work-history.md` 형식으로 작성합니다.
- 템플릿은 `reports/planning/work-history-template.md`를 사용합니다.

_Last Updated: 2026-02-14_
