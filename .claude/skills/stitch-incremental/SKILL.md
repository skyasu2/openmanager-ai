---
name: stitch-incremental
description: Stitch AI를 UI 증분 개선 가속기로 사용. 기존 컴포넌트 경계·데이터 흐름·API 계약·상태 아키텍처(TanStack Query + Zustand)를 보존하면서 1-2개 컴포넌트 단위 UI 개선에 활용. Use when the user asks to improve or add UI while keeping the existing architecture intact.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit, mcp__stitch__get_project, mcp__stitch__list_projects, mcp__stitch__list_screens, mcp__stitch__get_screen, mcp__stitch__generate_screen_from_text, mcp__stitch__generate_variants, mcp__stitch__edit_screens
disable-model-invocation: true
---

# Stitch Incremental

Stitch를 디자인 가속기로 활용합니다. 전체 UI 교체 수단이 아닙니다.

## Trigger Keywords

- "/stitch", "/stitch-incremental"
- "UI 개선", "컴포넌트 개선", "디자인 개선"
- "stitch로 개선", "incremental UI"

## 범위 제한 (Non-goals)

- 전체 페이지를 Stitch 결과물로 교체 금지
- state/data 레이어 재설계 금지 (스타일 변경을 위한)
- 레거시 Stitch 프로젝트를 구현 소스로 취급 금지
- 컴포넌트 2개 초과 동시 변경 금지

## Workflow

1. 범위가 컴포넌트 레벨(1-2개)인지 확인.
- 변경 대상 컴포넌트 파일 명시
- `git status --short` 로 현재 상태 확인

2. 현재 컴포넌트 구조 파악.
- 대상 파일 Read
- 데이터 흐름, API 계약, 상태 연결 확인

3. Stitch 프로젝트 연결.
- `mcp__stitch__list_projects` 로 OpenManager 프로젝트 확인
- 기존 화면이 있으면 `mcp__stitch__get_screen` 으로 현재 상태 확인

4. Stitch로 개선 아이디어 생성.
- `mcp__stitch__generate_screen_from_text` 또는 `mcp__stitch__edit_screens` 활용
- 여러 변형 비교 필요 시 `mcp__stitch__generate_variants`
- 프롬프트: `config/ai/stitch-improvement-prompt-template.md` 참조

5. 아이디어를 수동으로 기존 코드에 적용.
- Stitch 출력물을 직접 붙여넣기 금지
- 기존 컴포넌트 경계 유지
- 기존 API 및 데이터 페칭 흐름 유지
- 기존 상태 모델(TanStack Query + Zustand) 유지

6. 검증 실행.
- `npm run type-check`
- `npm run lint`
- 해당 컴포넌트 단위 테스트 실행 (있는 경우)

7. Stitch 사용 이력 등록.
- `config/ai/stitch-project-registry.json` 업데이트

## Output Format

```text
Stitch Incremental Results
- target: <컴포넌트 경로>
- stitch screen: <screen id or new>
- changes applied: <요약>
- architecture preserved: yes|no
- validation: type-check pass|fail, lint pass|fail
- registry updated: yes|no
```

## Related Skills

- `code-review` - 변경 후 리뷰
- `lint-smoke` - 최종 품질 확인
- Built-in `frontend-design` - 새 UI 생성 (Stitch 없이)

## References

- `docs/development/stitch-guide.md`
- `config/ai/stitch-improvement-prompt-template.md`
- `config/ai/stitch-project-registry.json`

## Changelog

- 2026-03-19: v1.0.0 - Codex openmanager-stitch-incremental 이식, Claude Code 포맷 적용
