# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-04-24
> Canonical: docs/development/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

Skills는 각 AI CLI가 재사용 가능한 워크플로우를 실행하는 자동화 레이어입니다. 기본 형식은 `SKILL.md` 기반 Agent Skills 패턴을 따르며, 이 저장소는 각 도구의 native discovery 경로를 유지하면서 공통 기준은 별도 baseline으로 관리합니다.

공통 운영 기준은 [AI Skill 운영 표준](../../guides/ai/skill-standards.md)과 `config/ai/skill-baselines.json`이 담당합니다.

## 경로별 역할

| 경로 | 스캔 주체 | 역할 | 형식 |
|------|-----------|------|------|
| `.agents/skills/` | Codex CLI, Gemini CLI | Codex 공식 repo-local 경로이자 Gemini가 우선 발견하는 공통 adapter | `SKILL.md` + `agents/openai.yaml` + `references/` |
| `.claude/skills/` | Claude Code | Claude native project skill 경로 | `SKILL.md` + Claude 전용 frontmatter |
| `.gemini/skills/` | Gemini CLI | Gemini-only overlay. `.agents/skills`와 같은 이름 금지 | `SKILL.md` |
| `~/.codex/skills/` | Codex CLI | 선택적 user-scope mirror | 로컬 복사본 |
| `config/ai/skill-baselines.json` | 모든 AI | skill별 purpose, invariant, adapter 경로 SSOT | JSON |

> Gemini CLI는 workspace tier에서 `.agents/skills`와 `.gemini/skills`를 모두 발견하며, 같은 이름이면 `.agents/skills`가 우선합니다. 따라서 이 저장소에서는 Gemini 공통 skill을 `.agents/skills`에서 사용하고, `.gemini/skills`는 Gemini 전용 추가 skill에만 씁니다.

## 현재 등록된 Skills

현재 공통 baseline에 등록된 스킬은 10개입니다.

| Skill | 목적 | Codex/Gemini adapter | Claude adapter |
|-------|------|:-------------------:|:--------------:|
| `cloud-run` | Cloud Run 배포, 비용, rollback 검증 | ✅ | ✅ |
| `code-review` | 6관점 severity-first 코드 리뷰 | ✅ | ✅ |
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

~/.codex/skills/                # Optional Codex user-scope mirror
└── ...                         # npm run skills:sync:codex 결과
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
| Codex user mirror 갱신 | 선택 시 `npm run skills:sync:codex` |
| drift 검사 | `npm run skills:check` |

모든 native `SKILL.md`는 `docs/guides/ai/skill-standards.md`와 `config/ai/skill-baselines.json`을 참조해야 합니다.

## 검증

```bash
# baseline, adapter path, reference, Gemini overlay 충돌 확인
npm run skills:check

# Codex user-scope mirror 갱신이 필요한 경우
npm run skills:sync:codex

# Gemini 실제 discovery 확인
 gemini skills list
```

`skills:check`는 다음을 hard gate로 검사합니다.

- baseline에 정의된 adapter 파일 존재
- `SKILL.md`의 `description` field 존재
- 각 adapter의 baseline 참조 문구 존재
- `.gemini/skills`에 `.agents/skills`와 같은 이름의 overlay 없음
- `.gemini/skills`가 git ignore로 차단되지 않음

## 운영 원칙

- 공통 기준은 baseline JSON에 둡니다.
- AI별 실행 차이는 native adapter에 둡니다.
- symlink로 Claude/Gemini/Codex skill을 공유하지 않습니다.
- `.gemini/skills`는 Gemini-only 추가 skill만 허용합니다.
- `version` field는 현재 hard gate가 아닙니다. Claude adapter에서는 권장하고, Codex/Gemini common adapter에서는 선택입니다.

## 관련 문서

- [AI Skill 운영 표준](../../guides/ai/skill-standards.md)
- [MCP 서버](./mcp-servers.md)
- [개발 워크플로우](./workflows.md)
- [개발 환경 허브](../README.md)
