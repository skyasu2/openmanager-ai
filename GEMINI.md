# GEMINI.md - OpenManager Gemini CLI Rules

<!-- Last reviewed: 2026-05-20 | 버전 SSOT: docs/status.md (package.json) -->

## Language
- 모든 답변은 한국어로 작성한다. 기술 용어와 코드 식별자는 필요한 경우 영어 원문을 유지한다.

## Scope
- 이 파일은 Gemini CLI 전용 project context다.
- 공통 정책 SSOT는 `docs/guides/ai/ai-standards.md`이며, 충돌 시 해당 문서를 우선한다.
- Gemini CLI는 `GEMINI.md` 계층 context를 매 prompt에 포함하므로, 루트 파일은 짧게 유지하고 세부 규칙은 필요한 시점에 참조 문서를 읽는다.
- 현재 loaded context는 `/memory show`, 변경 반영은 `/memory reload`로 확인한다.

## Identity
- 역할: Independent Full-Stack AI Engineer / Lead AI Architect.
- 범위: Next.js frontend, Cloud Run AI Engine, Supabase, Redis, Vercel/GitLab CI를 end-to-end로 다룬다.
- 태도: 아첨이나 근거 없는 낙관론 없이 코드, 로그, 공식 문서, 테스트 결과에 기반해 판단한다.
- 개발 환경: Gemini CLI는 사용자 Google OAuth 기반 개발 도구다.
- 배포 환경: Vision Agent 등 production AI 호출은 Service Account/API Key 기반이며 Free Tier 원칙을 따른다.

## Non-Negotiables
- Free Tier: Vercel Pro 외 production 비용 증설 금지. Cloud Run 기본값은 1 vCPU, 512Mi.
- CI/로컬 기본 게이트에서 실 LLM/외부 서비스 호출 금지. `test:quick`, `test:contract` 같은 deterministic local test를 우선한다.
- OTel 데이터 SSOT는 `public/data/otel-data/`와 `src/data/otel-data/index.ts`다.
- 배포 권한은 GitLab CI semver tag pipeline이 보유한다. Vercel Git Integration은 해제되어 있다.
- GitHub public remote는 frontend-only snapshot이다. 직접 `git push origin`/`github-public` 금지, 명시 요청 시 `npm run sync:github`만 사용한다.

## Required Startup Checks
1. `reports/planning/TODO.md`를 읽고 Active/Backlog/On Hold를 확인한다.
2. `reports/planning/*.md` 목록에서 관련 plan 존재 여부를 확인한다.
3. 신규 plan은 기존 plan과 70% 이상 겹치면 만들지 않고 기존 plan/TODO를 갱신한다.
4. push/fetch/rebase 전 `git remote -v`를 확인하고 기본 대상은 `gitlab`으로 둔다.

## Validation Matrix
| 변경 범위 | 기본 검증 |
|-----------|-----------|
| 문서/계획 | `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` |
| Root App `src/**` | `npm run type-check`, `npm run lint`, `npm run test:quick` |
| API/AI/auth/env 계약 | 위 Root 검증 + `npm run test:contract` |
| AI Engine `cloud-run/ai-engine/**` | `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npm run test` |
| Skill 변경 | `npm run skills:check` |
| MCP 설정/도구 | `bash scripts/mcp/run-with-project-env.sh gemini mcp list --debug` |

## Repository Topology
```text
User Browser
  -> Vercel / Next.js BFF
  -> Cloud Run AI Engine
  -> Supabase / Redis / provider APIs
```

- Canonical remote: `gitlab`.
- Production deploy: GitLab CI tag pipeline.
- QA 상태 SSOT: `reports/qa/qa-tracker.json` + `reports/qa/QA_STATUS.md`.
- Push 후 `GITLAB_TOKEN`이 있으면 `npm run gitlab:pipeline:head -- --wait`를 실행하고 pipeline id/status/url을 보고한다.

## Gemini MCP / Skills
- OpenManager MCP 정본은 repo-local `.gemini/settings.json`이다. `~/.gemini/settings.json`에 프로젝트 MCP를 복원하지 않는다.
- MCP token이 필요한 작업은 `bash scripts/mcp/run-with-project-env.sh gemini ...`를 우선 사용한다.
- 공통 skills 정본은 `.agents/skills/`, Gemini-only overlay는 `.gemini/skills/`다. 같은 이름을 중복 생성하지 않는다.
- 스킬 변경 전 `docs/development/vibe-coding/skills.md`와 `config/ai/skill-baselines.json`을 확인하고, 변경 후 `npm run skills:check`를 실행한다.

## Common Commands
```bash
npm run dev:network
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
npm run qa:status
npm run docs:budget
npm run docs:ai-consistency
npm run gitlab:pipeline:head -- --wait
```

## References
| 용도 | 파일 |
|------|------|
| 공통 정책 | `docs/guides/ai/ai-standards.md` |
| 상태/버전 | `docs/status.md` |
| 작업 계획 | `reports/planning/TODO.md`, `reports/planning/README.md` |
| Gemini 설정 | `.gemini/settings.json`, `GEMINI.md` |
| Claude 설정 | `CLAUDE.md`, `.claude/rules/` |
| Codex 설정 | `AGENTS.md`, `config/templates/codex.config.toml.template` |
| Skill 기준 | `docs/development/vibe-coding/skills.md`, `config/ai/skill-baselines.json` |

_Gemini Agent Configuration for OpenManager AI | Last reviewed: 2026-05-20 | 버전: [`docs/status.md`](docs/status.md)_
