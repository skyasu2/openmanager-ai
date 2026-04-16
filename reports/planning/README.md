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

## 계획서 소유권 원칙

- **소유자: 프로젝트 (사람)**. AI는 편집 주체이지 문서 소유자가 아니다.
- `Owner` 필드는 항상 `project` 또는 담당자명. AI 이름(`Claude`, `Codex` 등) 금지.
- Claude, Codex, Gemini 누구든 계획서를 읽고 상태를 갱신할 수 있다.

## 문체 원칙

- 사실, 범위, 검증 결과, 완료 기준 중심으로 작성
- 도구/모델 개인 감상, 칭찬, 주관적 평가 금지
- 다른 AI가 이어받아도 문맥 없이 바로 실행 가능해야 함
- 같은 사실을 여러 문서에 중복 기록하지 않음

## SSOT 기준

| 내용 | 위치 |
|------|------|
| 현재 Active/Backlog/On Hold 요약 | `TODO.md` |
| 복잡한 작업의 상세 판단·범위·검증 | 개별 plan 파일 |
| 완료 후 상세 이력 | `archive/` |

## 라이프사이클

```
초안 작성 (어떤 AI든 가능)
  → 실행 중: 상태 갱신, 완료 항목 체크
  → 완료: TODO.md에 요약 1줄 + plan 파일 archive 이동
```

## 계획서 작성 기준

| 상황 | 계획서 권장 |
|------|-------------|
| 아키텍처 변경 | ✅ 필수 |
| 마이그레이션 | ✅ 필수 |
| 다단계 기능 구현 | ✅ 권장 |
| 단일 버그 수정 | 선택 |
| 소규모 리팩터링 | 선택 |

파일명: `kebab-case-plan.md` (예: `ai-engine-refactor-plan.md`)

## 최소 템플릿

```markdown
# [주제] Plan

- 상태: 계획 수립 | 진행 중 | 완료
- 작성일: YYYY-MM-DD

## 목표
...

## 범위
- 포함: ...
- 제외: ...

## Task 목록
- [ ] Task 1 — 완료 기준: ...
- [ ] Task 2 — 완료 기준: ...

## 완료 기준
- [ ] ...
```

## 운영 규칙

- API 키, 토큰, 시크릿, 실계정 식별자 기록 금지
- `docs/archived/`는 계획서 보관 위치로 사용하지 않음
- 작업 회고는 `archive/YYYY-MM-DD-work-history.md` 형식

_Last Updated: 2026-04-16_
