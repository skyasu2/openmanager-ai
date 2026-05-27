# AGENTS.md - OpenManager Codex 실행 규칙

<!-- Last reviewed: 2026-05-20 | 프로젝트 버전 SSOT: docs/status.md (package.json) -->
**이 문서는 OpenManager AI 프로젝트 내에서 Codex 에이전트 전용 실행 규칙만 정의합니다.**

## 1) 정책 참조 구조 (SSOT)
- **모든 AI 에이전트 공통 규칙의 SSOT는 `docs/guides/ai/ai-standards.md` 입니다.**
- 공통 정책/에이전트 간 협업 규정은 이 파일에서 정의하지 않습니다.
- Codex 전용 동작 및 환경 규칙은 오직 이 문서(`AGENTS.md`)에서만 관리합니다.
  - Claude 전용: `CLAUDE.md`
  - Gemini 전용: `GEMINI.md`
- **충돌 우선순위**: `docs/guides/ai/ai-standards.md` > 요약된 에이전트 전용 문서 (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)

### 1.1 베스트 프랙티스 적용 기준
- Codex/AGENTS 동작의 **공식 기준**은 OpenAI Codex 문서와 `agents.md` open format 문서를 우선한다. 특히 scope/precedence, nested `AGENTS.md`, 검증 명령 실행 의무는 공식 기준을 따른다.
- 사용자 커뮤니티/실무 사례는 **보조 기준**으로만 사용한다. 적용 조건은 아래와 같다.
  - 추상 표현보다 정확한 명령, 파일 경로, 판단 기준을 더 명확하게 만들 때
  - 기존 SSOT(`docs/guides/ai/ai-standards.md`, `reports/planning/README.md`)와 충돌하지 않을 때
  - 문서 길이를 늘리는 대신 실행 실수를 줄이는 효과가 명확할 때
- 공식 기준과 커뮤니티 관행이 충돌하면 공식 기준과 이 저장소 SSOT를 우선한다.

## 2) Codex 실행 규칙

### 2.1 기본 동작 모드 및 행동 강령
- Codex는 기본적으로 구현/개선 중심으로 동작합니다.
- 사용자가 명시적으로 "리뷰만" 요청한 경우에만 리뷰 모드 중심으로 전환합니다.
- **객관성 및 정직성 (Objectivity & Honesty)**: 사용자의 기분을 맞추기 위한 아첨이나 근거 없는 낙관론을 제시하지 않습니다. 항상 코드 데이터와 공식 문서 등 검증 가능한 근거에 기반하여 답변하며, 모르는 것은 정직하게 밝히고 Hallucination 방지를 최우선으로 합니다. (공통 원칙 7 준수)

### 2.1.1 답변 형식 선호
- 아키텍처, 계층, 흐름, 의존성, 상태 전이처럼 관계를 설명할 때는 짧은 ASCII 다이어그램이나 코드블록을 우선 활용합니다.
- 단순 확인, 짧은 상태 보고, 한두 문장으로 충분한 답변에는 ASCII도 생략할 수 있습니다.

### 2.2 AGENTS 탐색 규칙
- 전역 계층: `~/.codex/AGENTS.override.md` 우선, 없으면 `~/.codex/AGENTS.md`
- 프로젝트 계층: 루트부터 현재 디렉토리까지 각 디렉토리에서 아래 순서로 최대 1개 파일 채택
  - `AGENTS.override.md` → `AGENTS.md` → `project_doc_fallback_filenames`
- 하위 디렉토리 지침이 상위 지침보다 우선합니다.
- 직접 전달된 system/developer/user 지침은 `AGENTS.md`보다 우선합니다.
- 최종 패치에서 수정하는 모든 파일은 해당 파일 경로를 포함하는 `AGENTS.md` scope의 지침을 따라야 합니다.
- 지침 체인은 실행 시작 시점에 구성되므로 지침 파일 수정 후 세션 재시작으로 반영 확인합니다.

### 2.2.1 스킬 위치 규칙 (3-AI 아키텍처)

| 경로 | 역할 | AI |
|------|------|-----|
| `.agents/skills/` | repo-local canonical path (`SKILL.md` + `agents/openai.yaml` + `references/`). Codex 공식 경로이며 Gemini에서도 같은 tier의 `.gemini/skills/`보다 우선 | Codex CLI + Gemini CLI |
| `.gemini/skills/` | Gemini-only overlay path. `.agents/skills/`와 같은 이름의 skill 생성 금지 | Gemini CLI |
| `.claude/skills/` | Claude project path. `allowed-tools`, `disable-model-invocation` 등 Claude 전용 frontmatter 유지 | Claude Code |
| `config/ai/skill-baselines.json` | skill별 공통 기준, 불변조건, native adapter 경로 | All AI |

> **Codex 스킬 동작**: 최신 공개 문서 기준 Codex는 repo `.agents/skills/`를 직접 발견합니다.
> OpenManager 공통 skill은 `.agents/skills/`에만 두며, `~/.codex/skills/` 또는 `.codex/skills/`에 같은 이름의 복사본을 만들지 않습니다.
>
> **Gemini 스킬 동작**: 최신 Gemini CLI는 `.agents/skills/`와 `.gemini/skills/`를 모두 스캔하며 같은 workspace tier에서는 `.agents/skills/`를 우선합니다.
> 이 저장소에서는 Gemini가 `.agents/skills/`를 공통 adapter로 사용하고, `.gemini/skills/`는 Gemini-only 추가 skill에만 사용합니다.

**동기화 규칙:**
- 공통 동작 변경 시 → `config/ai/skill-baselines.json` 먼저 수정
- Codex/Gemini 공통 adapter 반영 → `.agents/skills/<skill>/`
- Claude 전용 adapter 반영 → `.claude/skills/<skill>/`
- Gemini-only 추가 skill → `.gemini/skills/gemini-<name>/` 사용, `.agents/skills`와 같은 이름 금지
- 변경 후 → `npm run skills:check`
- 상세 기준: `docs/development/vibe-coding/skills.md`

### 2.3 MCP 운영 규칙 (Codex)
- MCP 서버 목록 SSOT는 `.codex/config.toml`의 `[mcp_servers.*]`입니다.
- 상태 점검 스크립트는 하드코딩 목록이 아닌 설정 파일 파싱 기반으로 동작해야 합니다.
- OpenAI API, ChatGPT Apps SDK, Codex 또는 OpenAI 공식 문서 기준 확인이 필요한 작업은 먼저 `openaiDeveloperDocs` MCP 서버를 사용합니다. 해당 MCP가 사용할 수 없을 때만 `developers.openai.com`, `platform.openai.com`, `help.openai.com` 같은 공식 OpenAI 도메인으로 폴백합니다.
- 변경/배포 전 최소 점검:
  - `bash scripts/mcp/codex-local.sh mcp list`
  - `bash scripts/mcp/mcp-health-check-codex.sh`
- 가능하면 서버별 최소 1회 도구 호출로 실동작을 확인합니다.

### 2.4 워크스페이스 경계 및 기본 검증
- Root App(`src` 중심) 변경 시 기본 검증:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - AI/API 계약 변경이 포함되면 `npm run test:contract`
- AI Engine(`cloud-run/ai-engine`) 변경 시 별도 검증:
  - `cd cloud-run/ai-engine && npm run type-check`
  - `cd cloud-run/ai-engine && npm run test`

#### 빠른 검증 매트릭스

| 변경 범위 | 우선 실행 | 추가 실행 |
|-----------|-----------|-----------|
| 문서/계획만 | `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` | active `docs/` 링크 변경 시 `npm run docs:links:internal` |
| Root App `src/**` | `npm run type-check`, `npm run lint`, `npm run test:quick` | API/AI/auth/env 계약 변경 시 `npm run test:contract` |
| AI Engine `cloud-run/ai-engine/**` | `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npm run test` | root 계약 표면 영향 시 `npm run test:contract` |
| MCP 설정/도구 | `bash scripts/mcp/codex-local.sh mcp list`, `bash scripts/mcp/mcp-health-check-codex.sh` | 가능하면 변경 서버별 최소 1회 tool call |
| Skill 변경 | `npm run skills:check` | 공통 기준 변경이면 `config/ai/skill-baselines.json` 먼저 갱신 |

### 2.5 최종 QA 운영 규칙 (Codex)
- 현재 프로젝트의 QA 상태 기준선은 `reports/qa/qa-tracker.json`과 `reports/qa/QA_STATUS.md`를 함께 참조합니다. 과거 QA baseline 리포트는 Git history의 historical evidence로만 확인합니다.
- 자동 CI와 로컬 기본 게이트에서는 **실 LLM/외부 서비스 호출을 금지**합니다. 대신 `test:quick`, `test:contract` 같은 deterministic local test를 우선 사용합니다.
- 최종 QA(릴리즈 게이트)는 기본적으로 **Vercel 실환경 + Playwright MCP**에서 수행합니다.
- AI 기능 검증이 불필요한 QA(예: 레이아웃/카피/일반 인증 동선)는 로컬 개발 서버 기반 QA로 전환할 수 있습니다.
- 모든 QA 실행 결과는 누적 추적을 위해 반드시 기록합니다.
  - 입력 템플릿: `reports/qa/templates/qa-run-input.example.json`
  - 기록: `npm run qa:record -- --input <json>`
  - 상태 확인: `npm run qa:status`
  - 증거 무결성 감사: `npm run qa:evidence:audit` (고아 파일·누락 참조·부채 런 탐지)

#### AI 어시스턴트 평가 기록 규약
- **SSOT 파일**: Claude memory `ai-assistant-evaluation.md` (상단 스코어카드 테이블)
- **포트폴리오 기준선: 90/100** — 이 이상이면 치명적이거나 간단한 항목 외 수정 보류
- Codex가 AI 어시스턴트를 직접 평가한 경우 반드시 스코어카드 테이블의 `Codex` 행을 갱신한다
  - 갱신 항목: 차수, 버전, 점수(N/100), 날짜, 비고(수정 확인·신규 약점 한 줄 요약)
  - 위치: `~/.claude/projects/-mnt-d-dev-openmanager-ai/memory/ai-assistant-evaluation.md`
- 잔여 약점 판정 기준
  - 치명적(응답 불가·데이터 오류): 즉시 수정
  - 간단(패턴 1줄 추가): 즉시 수정
  - 그 외: 90/100 이상이면 보류(`🔕 wont-fix` 또는 `🔶 검토 중` 표기)
- QA 런 기록은 별도로 `npm run qa:record -- --input <json>` 으로 누적한다

### 2.6 저장소/배포 토폴로지 (Codex)
- **정본 개발 저장소는 `gitlab` remote** 입니다. 전체 이력/테스트/문서/QA 자산을 유지합니다.
- **Vercel Git Integration은 해제되어 있으며**, Frontend production 배포 권한은 GitLab CI semver tag `deploy` job이 보유합니다.
- **GitHub public remote의 기본 이름은 `github-public`** 입니다. 공개용 frontend-only snapshot 으로만 취급하며, Vercel에 노출되는 프론트엔드/공개 자산만 공유합니다. `.github/`, `docs/`, `tests/`, `scripts/`, `reports/`, `cloud-run/`, 내부 agent 설정은 공개 snapshot에 포함하지 않습니다. `origin`은 legacy fallback 으로만 허용합니다.
- private canonical repo와 GitHub public snapshot은 히스토리가 다를 수 있으므로 `github-public/main` 또는 `origin/main`을 기준 브랜치처럼 다루지 않습니다.
- Codex는 push/fetch/rebase 전에 항상 `git remote -v`를 확인하고, 기본 push 대상은 `gitlab` 으로 선택합니다.
- GitHub 공개 스냅샷 동기화는 `npm run sync:github` 으로만 수행합니다 (`scripts/sync/github-sync.sh`, 포함 목록: `.github-export-include`, 안전 제외 목록: `.github-export-ignore`). `git push origin` 또는 `git push github-public` 직접 실행 금지.
- GitLab CI는 **활성** 상태입니다. 현재 `.gitlab-ci.yml`은 branch/main `validate(frontend + ai-engine)`와 semver tag `deploy(frontend) → deploy_ai_engine(cloud-run) → smoke(frontend/ai-engine)` 파이프라인으로 동작합니다. docs/reports 전용 push는 CI 스킵(분 예산 보존).
- `git push gitlab ...` 이후에는 `GITLAB_TOKEN`(env 또는 `.env.local`)이 있으면 `npm run gitlab:pipeline:head -- --wait`로 pushed `HEAD` pipeline을 확인하고, final 답변에 `pipeline id/status/url`를 반드시 보고합니다.
- pipeline 확인 결과가 `note=pipeline_not_terminal_after_wait`이거나 `status=created|pending|running|waiting_for_resource`로 남으면 `npm run gitlab:pipeline:inspect -- --pipeline <id>`로 jobs/resource queue를 확인한 뒤 원인을 보고합니다.
- **배포 권한은 GitLab CI가 보유**합니다. Frontend는 `deploy` job에서 `vercel build --prod` 후 `vercel deploy --prebuilt --prod`, AI Engine은 `deploy_ai_engine` job에서 `cloud-run/ai-engine/deploy.sh`를 통해 Cloud Run production 배포를 수행합니다. validate 실패 시 각 배포가 차단됩니다.
- **배포 전 runner 상태 확인**: `bash scripts/ci/runner-health-check.sh`
  - 이 스크립트는 로컬 `gitlab-runner`/Docker 가용성만 확인합니다. `exit 0`은 GitLab scheduler, pipeline 생성, runner tag matching, `resource_group` 배정 성공을 의미하지 않습니다.
  - `exit 0` → tag/push 후 GitLab pipeline 상태를 별도 확인합니다.
  - `exit 1` → runner 미가동으로 CI 배포 불가. runner를 복구한 뒤 tag pipeline을 재시도/재확인합니다.
- production `resource_group`을 stale pipeline이 점유하는 경우에는 실제 배포/QA가 별도 완료됐거나 사용자 승인이 있을 때만 cancel/clear합니다.
- 로컬 전체 검증 표준 경로는 `npm run ci:local:docker` (SSOT 유지, CI와 별개)입니다.

## 2.7 작업 계획서 규칙 (Codex)

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
- 계약 변경
  - 예: API shape, AI stream/tool schema, auth/session, monitoring pipeline, ai-engine tool/result schema

plan 파일이 있는 작업은 아래 순서를 따른다.

```
1. plan 파일 Status 확인
   - Draft    → 계약 섹션(Contract) 완성 후 Approved로 변경
   - Approved → 구현 착수 가능

2. Approved 확인 후 → 테스트 시나리오 failing test 먼저 커밋
   커밋 메시지: test(spec): [기능명] add failing tests before implementation

3. 이후 → 구현 커밋
   커밋 메시지: feat: [기능명] implement to pass specs
```

단순 버그 수정·소규모 리팩터링·UI copy/docs 변경은 게이트 없이 TODO.md 1줄 처리로 충분하다.
가능하면 회귀 테스트를 추가하되, 테스트 추가가 비현실적이면 작업 보고에 이유를 명시한다.

상세 규칙: `reports/planning/README.md`

<!-- OPENMANAGER_SUBAGENTS_GUIDANCE_BEGIN
Rollback: 이 블록 전체를 삭제하고 `.codex/backups/subagents-20260430-before.md`의 해당 내용을 참고하면 적용 전 subagent guidance 상태로 복구됩니다. 문서 버전은 `docs/status.md` / `package.json` SSOT를 따르며, 이 파일에 고정 버전을 재도입하지 않습니다.
Backup note: .codex/backups/subagents-20260430-before.md
-->
## 2.8 서브 에이전트 활용 규칙 (Codex)

Codex는 공식 subagent workflow를 사용할 수 있습니다. 이 저장소에서는 사용자가 "서브 에이전트를 활용", "병렬 에이전트로 검토", "각 영역을 나눠 조사/구현"처럼 명시적으로 허용하거나 요청한 경우 아래 기준으로 제한적으로 사용합니다.

- **사용 권장 상황**
  - 코드베이스 탐색, 회귀 위험 검토, 문서/API 확인처럼 서로 독립적인 read-heavy 작업을 병렬로 수행할 때
  - 대규모 구현을 파일/모듈 ownership 단위로 충돌 없이 분리할 수 있을 때
  - 브라우저 재현, 코드 경로 추적, 구현처럼 역할이 분명히 다른 작업을 병렬 또는 순차 협업으로 나눌 때

- **사용 금지/회피 상황**
  - 단순 질문, 단일 파일 수정, 작은 문서/copy 변경
  - 현재 Codex가 직접 처리해야 하는 blocking 작업
  - write scope가 겹쳐 merge conflict나 사용자 변경 되돌림 위험이 큰 작업
  - 토큰/시간 비용 대비 병렬화 이점이 불명확한 작업

- **위임 원칙**
  - 기본 내장 agent는 `explorer`(read-heavy 조사), `worker`(구현/수정), `default`(일반 작업) 순으로 목적에 맞게 선택합니다.
  - worker에게 코드 수정을 맡길 때는 담당 파일/모듈 ownership을 명시하고, 다른 작업자의 변경을 되돌리지 않도록 지시합니다.
  - parent Codex는 subagent 결과를 그대로 믿고 끝내지 않고, 핵심 근거를 검토한 뒤 통합/최종 판단을 책임집니다.
  - 완료된 subagent thread는 더 필요 없으면 닫아 열린 thread 수와 토큰 사용을 관리합니다.
<!-- OPENMANAGER_SUBAGENTS_GUIDANCE_END -->

## 3) 공통 지식 및 유지보수 메모
- **[필독] 프로젝트 3대 원칙 (Free Tier, 배포 환경 인지, OTel 데이터 SSOT)** 등 모든 AI 에이전트가 완벽히 숙지해야 할 핵심 규칙은 `docs/guides/ai/ai-standards.md` 파일에 정의되어 있습니다. 작업을 시작하기 전 해당 문서를 반드시 참조하세요.
- 이 문서는 주로 "Codex 전용 실행 환경 및 MCP 설정" 등에 대한 규칙만 제한적으로 유지합니다.
- 공통 정책이 변경되는 경우 이 파일이 아닌 `docs/guides/ai/ai-standards.md`를 갱신해야 합니다.

---
_Last reviewed: 2026-05-20 | 버전 SSOT: [`docs/status.md`](docs/status.md)_
