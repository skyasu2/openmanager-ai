# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-06-06
> Canonical: docs/development/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

Skills는 각 AI CLI가 재사용 가능한 워크플로우를 실행하는 자동화 레이어입니다. 기본 형식은 `SKILL.md` 기반 Agent Skills 패턴을 따르며, 이 저장소는 각 도구의 native discovery 경로를 유지하면서 공통 기준은 별도 baseline으로 관리합니다.

공통 운영 기준과 baseline 파일(`config/ai/skill-baselines.json`)이 skill별 의도·불변조건·adapter 경로를 관리합니다.

## 경로별 역할

| 경로 | 스캔 주체 | 역할 | 형식 |
|------|-----------|------|------|
| `.agents/skills/` | Codex CLI, Gemini CLI | Codex 공식 repo-local 경로이자 Gemini가 우선 발견하는 공통 adapter | `SKILL.md` + `agents/openai.yaml` + `references/` |
| `.claude/skills/` | Claude Code | Claude native project skill 경로 | `SKILL.md` + Claude 전용 frontmatter |
| `.gemini/skills/` | Gemini CLI | Gemini-only overlay. `.agents/skills`와 같은 이름 금지 | `SKILL.md` |
| `config/ai/skill-baselines.json` | 모든 AI | skill별 purpose, invariant, adapter 경로 SSOT | JSON |

> Gemini CLI는 workspace tier에서 `.agents/skills`와 `.gemini/skills`를 모두 발견하며, 같은 이름이면 `.agents/skills`가 우선합니다. 따라서 이 저장소에서는 Gemini 공통 skill을 `.agents/skills`에서 사용하고, `.gemini/skills`는 Gemini 전용 추가 skill에만 씁니다.

## Gemini 공식 자료와 프로젝트 기준

Gemini MCP처럼 skills discovery가 안정 문서 한 곳에 정리되어 있지는 않습니다. 현재 확인 가능한 공식 Gemini CLI 자료는 다음 범위로 해석합니다.

| 확인 근거 | 적용 판단 |
|---|---|
| Gemini CLI 공식 GitHub의 [Agent Skills epic](https://github.com/google-gemini/gemini-cli/issues/15327)은 `SKILL.md` format, progressive disclosure, project/user/extension tier를 목표로 명시합니다. | OpenManager는 `SKILL.md` 기반 구조를 유지하고, project-local skill을 우선합니다. |
| [Gemini CLI extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)는 extension이 context와 `mcpServers`를 제공할 수 있고, workspace configuration이 conflict에서 우선한다고 설명합니다. | OpenManager 공통 skill은 extension packaging 대상이 아닙니다. extension은 외부 배포 단위가 필요할 때만 사용합니다. |
| Gemini CLI 공식 repo 자체도 `.gemini/skills/<name>/SKILL.md` 형태의 skill 예시를 사용합니다. | `.gemini/skills` 경로는 Gemini-only overlay로 인정하되, 이 저장소의 공통 adapter 정본은 `.agents/skills`입니다. |

결론: 공식 MCP 설정은 `.gemini/settings.json` project scope를 따르고, OpenManager 공통 skills는 프로젝트 표준에 따라 `.agents/skills`에 둡니다. `.gemini/skills`는 Gemini-only overlay 전용이며 같은 이름의 공통 adapter를 만들지 않습니다.

## 현재 등록된 Skills

현재 공통 baseline에 등록된 스킬은 10개입니다.

| Skill | 목적 | Codex/Gemini adapter | Claude adapter |
|-------|------|:-------------------:|:--------------:|
| `ai-observability` | Langfuse 기반 AI routing, provider, latency, failure/fallback 관측 | ✅ | ✅ |
| `cloud-run` | Cloud Run 배포, 비용, rollback 검증 | ✅ | ✅ |
| `doc-management` | 문서 예산, 중복, stale, metadata 점검 | ✅ | ✅ |
| `env-sync` | `.env.local`, Vercel, Supabase, Cloud Run env drift 진단 | ✅ | ✅ |
| `git-clean-gone` | `[gone]` 브랜치 안전 정리 | ✅ | ✅ |
| `git-workflow` | GitLab canonical commit/push/CI 확인 | ✅ | ✅ |
| `lint-smoke` | 빠른 테스트/타입/린트 검증 | ✅ | ✅ |
| `qa-ops` | Vercel/로컬 QA 실행 및 누적 기록 | ✅ | ✅ |
| `qa-state` | 상태 진단 + QA 실행 + 결과 기록 통합 | ✅ | ✅ |
| `state-triage` | QA/런타임/배포/AI-path 상태 원인 분석 | ✅ | ✅ |

## 파일 구조

```text
.agents/skills/                 # Codex/Gemini common adapter
├── cloud-run/
│   ├── SKILL.md
│   ├── agents/openai.yaml      # Codex/OpenAI UI metadata
│   └── references/
└── ...

.claude/skills/                 # Claude native adapter
├── cloud-run/SKILL.md
└── ...

.gemini/skills/                 # Gemini-only overlay only
└── gemini-*/SKILL.md           # .agents/skills와 같은 이름 금지

# Codex user/project-local mirror 없음:
# ~/.codex/skills/<same-name> 및 .codex/skills/<same-name> 금지
```

## SKILL.md frontmatter 비교

```yaml
# .claude/skills/<name>/SKILL.md
---
name: git-workflow
description: ...
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit
disable-model-invocation: true
---

# .agents/skills/<name>/SKILL.md
---
name: git-workflow
description: ...
---
```

Claude adapter는 Claude Code 전용 권한/호출 제어를 유지합니다. Codex/Gemini 공통 adapter는 `name`과 `description`을 핵심 trigger metadata로 유지하고, Codex UI metadata는 `agents/openai.yaml`에 분리합니다.

## 수정 규칙

| 작업 | 절차 |
|------|------|
| 공통 동작 변경 | `config/ai/skill-baselines.json` 먼저 수정 |
| Codex/Gemini 공통 skill 수정 | `.agents/skills/<name>/SKILL.md` 수정 |
| Claude 전용 skill 수정 | `.claude/skills/<name>/SKILL.md` 수정 |
| Gemini-only skill 추가 | `.gemini/skills/gemini-<name>/SKILL.md` 추가 |
| drift 검사 | `npm run skills:check` |

모든 native `SKILL.md`는 이 문서와 `config/ai/skill-baselines.json`을 참조해야 합니다.

## 검증

```bash
# baseline, adapter path, reference, Gemini overlay 충돌 확인
npm run skills:check

# Codex는 .agents/skills를 직접 사용하므로 user-scope sync 없음
npm run skills:sync:codex

# Gemini adapter/user-scope drift 확인
npm run skills:check
```

`skills:check`는 다음을 hard gate로 검사합니다.

- baseline에 정의된 adapter 파일 존재
- `SKILL.md`의 `description` field 존재
- 각 adapter의 baseline 참조 문구 존재
- `.gemini/skills`에 `.agents/skills`와 같은 이름의 overlay 없음
- `.gemini/skills`가 git ignore로 차단되지 않음
- `~/.codex/skills`와 `.codex/skills`에 OpenManager 공통 skill 복사본 없음
- `~/.gemini/skills`에 OpenManager 공통 skill 복사본 없음
- `skills:sync:gemini` 또는 `scripts/skills/sync-gemini-skills.sh` 같은 Gemini user-scope mirror 경로 없음

`~/.codex/skills` 또는 `.codex/skills`에 OpenManager skill 복사본이 남아 있으면 프로젝트 `.agents/skills`와 같은 이름 충돌 경고가 발생합니다. `bash scripts/ai/setup-codex-project-scope.sh`는 이 복사본을 백업 위치로 격리하고, 프로젝트 공통 skill 정본은 `.agents/skills`에만 둡니다.

`~/.gemini/skills`에 OpenManager skill 복사본이 남아 있으면 프로젝트 `.agents/skills`와 같은 이름 충돌 경고가 발생합니다. `bash scripts/ai/setup-gemini-global.sh`는 이 user-scope 복사본을 백업 위치로 격리하고, 프로젝트 공통 skill 정본은 `.agents/skills`에만 둡니다. Gemini CLI 0.39.x의 headless skills-list subcommand는 trust/relaunch 차이로 타임아웃되거나 workspace skills를 누락할 수 있으므로 health gate로 쓰지 않습니다.

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

## 외부 도구 사용 기준

- `skills-ref`나 `agentskills validate`는 보조 validator로 사용할 수 있습니다.
- 현재 OpenManager에는 legacy 호환을 위해 `git-clean-gone`의 frontmatter name alias가 남아 있으므로, 외부 validator 결과는 바로 hard gate로 쓰지 않고 `npm run skills:check`를 우선 gate로 사용합니다.
- 외부 skill installer를 사용할 때는 symlink보다 copy 또는 reviewed import를 선호합니다. 설치 후 baseline과 native adapter를 프로젝트 기준에 맞게 정리합니다.

## 운영 원칙

- 공통 기준은 baseline JSON에 둡니다.
- AI별 실행 차이는 native adapter에 둡니다.
- symlink로 Claude/Gemini/Codex skill을 공유하지 않습니다.
- `.gemini/skills`는 Gemini-only 추가 skill만 허용합니다.
- `version` field는 현재 hard gate가 아닙니다. Claude adapter에서는 권장하고, Codex/Gemini common adapter에서는 선택입니다.

## 관련 문서

- [MCP 서버](./mcp-servers.md)
- [개발 워크플로우](./workflows.md)
- [개발 환경 허브](../README.md)
