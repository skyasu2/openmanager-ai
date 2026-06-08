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

## 작업 계획서 및 SDD 게이트 규칙
작업 시작 전 반드시 아래 순서로 확인한다.
1. `reports/planning/TODO.md` 읽기 — Active Task, Backlog, On Hold 파악
2. `reports/planning/*.md` 목록 확인 — 관련 plan 파일 존재 여부
3. 기존 파일 있으면 수정, 없으면 신규 조건 충족 시만 생성

**신규 plan 파일 생성 금지 조건** (하나라도 해당하면 생성 안 함):
- 기존 plan 파일과 주제가 70%+ 겹침 → 기존 파일 Task 항목 추가
- TODO.md Backlog에 이미 동일 항목 존재 → 항목 승격만
- 단일 버그 수정 / 소규모 리팩터링 → TODO.md 1줄로 충분

**Owner 규칙**: plan 파일 `Owner` 필드는 항상 `project`. AI 이름 금지.

### SDD 게이트 (구현 착수 전 필수)
아래 작업에는 strict TDD/SDD를 적용한다.
- 신규 기능
- 대규모 리팩터링
- 계약 변경 (예: API shape, AI stream/tool schema, auth/session, monitoring pipeline, ai-engine tool/result schema)

plan 파일이 있는 작업은 아래 순서를 따른다.
1. plan 파일 Status 확인
   - Draft    → 계약 섹션(Contract) 완성 후 Approved로 변경
   - Approved → 구현 착수 가능
2. Approved 확인 후 → 테스트 시나리오 failing test 먼저 커밋
   커밋 메시지: `test(spec): [기능명] add failing tests before implementation`
3. 이후 → 구현 커밋
   커밋 메시지: `feat: [기능명] implement to pass specs`

단순 버그 수정·소규모 리팩터링·UI copy/docs 변경은 게이트 없이 TODO.md 1줄 처리로 충분하다.
가능하면 회귀 테스트를 추가하되, 테스트 추가가 비현실적이면 작업 보고에 이유를 명시한다.

## 서브 에이전트 활용 규칙
사용자가 명시적으로 허용하거나 병렬 검토를 요청한 경우 아래 기준으로 제한적으로 사용한다.
- **사용 권장 상황**:
  - 코드베이스 탐색, 회귀 위험 검토, 문서/API 확인처럼 서로 독립적인 read-heavy 작업을 병렬로 수행할 때
  - 대규모 구현을 파일/모듈 ownership 단위로 충돌 없이 분리할 수 있을 때
  - 브라우저 재현, 코드 경로 추적, 구현처럼 역할이 분명히 다른 작업을 병렬 또는 순차 협업으로 나눌 때
- **사용 금지/회피 상황**:
  - 단순 질문, 단일 파일 수정, 작은 문서/copy 변경
  - 현재 Gemini가 직접 처리해야 하는 blocking 작업
  - write scope가 겹쳐 merge conflict나 사용자 변경 되돌림 위험이 큰 작업
  - 토큰/시간 비용 대비 병렬화 이점이 불명확한 작업
- **위임 원칙**:
  - 기본 내장 agent는 `research`(read-only 조사), `self`(구현/수정)를 목적에 맞게 선택한다.
  - worker에게 코드 수정을 맡길 때는 담당 파일/모듈 ownership을 명시하고, 다른 작업자의 변경을 되돌리지 않도록 지시한다.
  - parent Gemini는 subagent 결과를 그대로 믿지 않고, 핵심 근거를 직접 검토하여 최종 판단을 책임진다.
  - 완료된 subagent thread는 더 필요 없으면 닫아서 자원을 관리한다.

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
