# AI Skill 운영 표준

> Codex, Claude Code, Gemini CLI 스킬 운영 기준
> Owner: project
> Status: Active Canonical
> Doc type: Guide
> Last reviewed: 2026-04-24
> Canonical: docs/guides/ai/skill-standards.md
> Tags: ai,skills,codex,claude,gemini

## 목적

이 문서는 OpenManager의 3-AI 스킬 운영 기준입니다. 공통 정책은 한 곳에서 관리하고, 각 AI는 자기 도구의 native discovery 경로와 frontmatter를 유지합니다.

## 경로 원칙

| 대상 | 경로 | 역할 |
|------|------|------|
| Codex | `.agents/skills/` | Codex 공식 repo-local skill 경로 |
| Claude Code | `.claude/skills/` | Claude Code project skill 경로, Claude 전용 frontmatter 유지 |
| Gemini CLI | `.agents/skills/` | 현재 Gemini workspace discovery에서 `.gemini/skills`보다 우선하는 공통 agent skill 경로 |
| Gemini-only overlay | `.gemini/skills/` | Gemini 전용 추가 skill만 허용. `.agents/skills`와 같은 이름 금지 |
| 공통 기준 | `config/ai/skill-baselines.json` | skill별 공통 의도, 핵심 불변조건, native adapter 경로 |

## 수정 규칙

1. 스킬 동작을 바꾸기 전에 `config/ai/skill-baselines.json`에서 해당 skill 기준을 먼저 확인합니다.
2. 변경이 특정 AI 전용이 아니면 baseline을 먼저 갱신합니다.
3. Codex/Gemini 공통 실행 규칙은 `.agents/skills/<skill>/SKILL.md`에 반영합니다.
4. Claude 전용 invocation, `allowed-tools`, subagent, shell execution 규칙은 `.claude/skills/<skill>/SKILL.md`에 반영합니다.
5. Gemini 전용 skill이 필요하면 `.gemini/skills/gemini-<name>/SKILL.md`처럼 `.agents/skills`와 충돌하지 않는 이름을 사용합니다.
6. `.gemini/skills/<same-name>`은 만들지 않습니다. Gemini CLI가 같은 tier에서 `.agents/skills`를 우선하므로 shadowed copy가 됩니다.
7. 스킬 변경 후 `npm run skills:check`를 실행해 baseline 참조, 경로, 중복 overlay를 검증합니다.

## Baseline과 Adapter의 책임 분리

- `config/ai/skill-baselines.json`: 무엇을 해야 하는지, 어떤 불변조건을 지켜야 하는지 정의합니다.
- `.agents/skills`: Codex와 Gemini가 실제로 쓰는 공통 adapter입니다.
- `.claude/skills`: Claude Code의 도구 권한과 invocation 제어를 포함하는 Claude adapter입니다.
- `.gemini/skills`: Gemini만 필요한 추가 skill을 위한 overlay입니다.

## Drift 방지

다음 변경은 같은 PR/커밋에서 함께 확인해야 합니다.

- skill 이름 추가/삭제
- 공통 workflow 순서 변경
- 검증 명령 변경
- 배포, QA, Git, 환경변수, 비용 정책 변경
- AI별 native frontmatter 변경

검사 명령:

```bash
npm run skills:check
```

검사 기준:

- baseline에 정의된 skill이 `.agents/skills`와 `.claude/skills`에 존재해야 합니다.
- 각 `SKILL.md`는 이 문서와 baseline 파일을 참조해야 합니다.
- `.gemini/skills`에는 `.agents/skills`와 같은 이름의 skill이 없어야 합니다.
- baseline에 없는 native skill은 명시적으로 추가하거나 제거해야 합니다.

## 외부 도구 사용 기준

- `skills-ref`나 `agentskills validate`는 보조 validator로 사용할 수 있습니다.
- 현재 OpenManager에는 legacy 호환을 위해 `git-clean-gone`의 frontmatter name alias가 남아 있으므로, 외부 validator 결과는 바로 hard gate로 쓰지 않고 `npm run skills:check`를 우선 gate로 사용합니다.
- 외부 skill installer를 사용할 때는 symlink보다 copy 또는 reviewed import를 선호합니다. 설치 후 baseline과 native adapter를 프로젝트 기준에 맞게 정리합니다.
