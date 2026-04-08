# AGENTS.md - OpenManager Codex 실행 규칙

<!-- Version: 6.1.2 -->
**이 문서는 OpenManager AI 프로젝트 내에서 Codex 에이전트 전용 실행 규칙만 정의합니다.**

## 1) 정책 참조 구조 (SSOT)
- **모든 AI 에이전트 공통 규칙의 SSOT는 `docs/guides/ai/ai-standards.md` 입니다.**
- 공통 정책/에이전트 간 협업 규정은 이 파일에서 정의하지 않습니다.
- Codex 전용 동작 및 환경 규칙은 오직 이 문서(`AGENTS.md`)에서만 관리합니다.
  - Claude 전용: `CLAUDE.md`
  - Gemini 전용: `GEMINI.md`
- **충돌 우선순위**: `docs/guides/ai/ai-standards.md` > 요약된 에이전트 전용 문서 (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)

## 2) Codex 실행 규칙

### 2.1 기본 동작 모드 및 행동 강령
- Codex는 기본적으로 구현/개선 중심으로 동작합니다.
- 사용자가 명시적으로 "리뷰만" 요청한 경우에만 리뷰 모드 중심으로 전환합니다.
- **객관성 및 정직성 (Objectivity & Honesty)**: 사용자의 기분을 맞추기 위한 아첨이나 근거 없는 낙관론을 제시하지 않습니다. 항상 코드 데이터와 공식 문서 등 검증 가능한 근거에 기반하여 답변하며, 모르는 것은 정직하게 밝히고 Hallucination 방지를 최우선으로 합니다. (공통 원칙 7 준수)

### 2.2 AGENTS 탐색 규칙
- 전역 계층: `~/.codex/AGENTS.override.md` 우선, 없으면 `~/.codex/AGENTS.md`
- 프로젝트 계층: 루트부터 현재 디렉토리까지 각 디렉토리에서 아래 순서로 최대 1개 파일 채택
  - `AGENTS.override.md` → `AGENTS.md` → `project_doc_fallback_filenames`
- 하위 디렉토리 지침이 상위 지침보다 우선합니다.
- 지침 체인은 실행 시작 시점에 구성되므로 지침 파일 수정 후 세션 재시작으로 반영 확인합니다.

### 2.2.1 Codex 스킬 위치 규칙
- 저장소에 공유되는 Codex 스킬의 정본 위치는 `.agents/skills/` 입니다.
- `.codex/` 는 로컬 런타임/세션 자산이므로 git ignore 대상이며, 팀 공용 스킬 SSOT로 취급하지 않습니다.
- 스킬을 개선하거나 추가할 때는 먼저 `.agents/skills/` 를 수정하고, 필요할 때만 로컬 `.codex/skills/` 사본을 맞춥니다.

### 2.3 MCP 운영 규칙 (Codex)
- MCP 서버 목록 SSOT는 `.codex/config.toml`의 `[mcp_servers.*]`입니다.
- 상태 점검 스크립트는 하드코딩 목록이 아닌 설정 파일 파싱 기반으로 동작해야 합니다.
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

### 2.5 최종 QA 운영 규칙 (Codex)
- 현재 프로젝트의 QA 기준선은 `reports/qa/production-qa-2026-02-25.md`와 `reports/qa/qa-tracker.json`을 함께 참조합니다.
- 자동 CI와 로컬 기본 게이트에서는 **실 LLM/외부 서비스 호출을 금지**합니다. 대신 `test:quick`, `test:contract` 같은 deterministic local test를 우선 사용합니다.
- 최종 QA(릴리즈 게이트)는 기본적으로 **Vercel 실환경 + Playwright MCP**에서 수행합니다.
- AI 기능 검증이 불필요한 QA(예: 레이아웃/카피/일반 인증 동선)는 로컬 개발 서버 기반 QA로 전환할 수 있습니다.
- 모든 QA 실행 결과는 누적 추적을 위해 반드시 기록합니다.
  - 입력 템플릿: `reports/qa/templates/qa-run-input.example.json`
  - 기록: `npm run qa:record -- --input <json>`
  - 상태 확인: `npm run qa:status`
  - 증거 무결성 감사: `npm run qa:evidence:audit` (고아 파일·누락 참조·부채 런 탐지)

### 2.6 저장소/배포 토폴로지 (Codex)
- **정본 개발 저장소는 `gitlab` remote** 입니다. 전체 이력/테스트/문서/QA 자산을 유지하며, Vercel Frontend Git 배포 소스도 GitLab `main` 입니다.
- **GitHub public remote의 기본 이름은 `github-public`** 입니다. 공개용 frontend-focused snapshot 으로만 취급하며, Vercel에 노출되는 프론트엔드/공개 자산만 공유합니다. `origin`은 legacy fallback 으로만 허용합니다.
- private canonical repo와 GitHub public snapshot은 히스토리가 다를 수 있으므로 `github-public/main` 또는 `origin/main`을 기준 브랜치처럼 다루지 않습니다.
- Codex는 push/fetch/rebase 전에 항상 `git remote -v`를 확인하고, 기본 push 대상은 `gitlab` 으로 선택합니다.
- GitHub 공개 스냅샷 동기화는 `npm run sync:github` 으로만 수행합니다 (`scripts/sync/github-sync.sh`, 포함 목록: `.github-export-include`, 안전 제외 목록: `.github-export-ignore`). `git push origin` 또는 `git push github-public` 직접 실행 금지.
- GitLab CI는 **활성** 상태입니다. 현재 `.gitlab-ci.yml`은 `validate(frontend + ai-engine) → deploy(frontend) → deploy_ai_engine(cloud-run) → smoke(frontend)` 다단계 파이프라인으로 동작합니다. docs/reports 전용 push는 CI 스킵(분 예산 보존).
- **배포 권한은 GitLab CI가 보유**합니다. Frontend는 `deploy` job에서 `vercel build --prod` 후 `vercel deploy --prebuilt --prod`, AI Engine은 `deploy_ai_engine` job에서 `cloud-run/ai-engine/deploy.sh`를 통해 Cloud Run production 배포를 수행합니다. validate 실패 시 각 배포가 차단됩니다.
- **배포 전 runner 상태 확인**: `bash scripts/ci/runner-health-check.sh`
  - `exit 0` → 정상, 태그 push로 CI 경유 배포
  - `exit 1` → runner 미가동, `vercel --prod` 직접 배포 후 사용자에게 "CI 게이트 스킵됨" 명시 보고
- **CI 스킵 fallback**: `vercel --prod` (소스 업로드). 로컬 `vercel build --prod`는 WSL2 `fonts.gstatic.com` 차단으로 실패 가능
- 로컬 전체 검증 표준 경로는 `npm run ci:local:docker` (SSOT 유지, CI와 별개)입니다.

## 3) 공통 지식 및 유지보수 메모
- **[필독] 프로젝트 3대 원칙 (Free Tier, 배포 환경 인지, OTel 데이터 SSOT)** 등 모든 AI 에이전트가 완벽히 숙지해야 할 핵심 규칙은 `docs/guides/ai/ai-standards.md` 파일에 정의되어 있습니다. 작업을 시작하기 전 해당 문서를 반드시 참조하세요.
- 이 문서는 주로 "Codex 전용 실행 환경 및 MCP 설정" 등에 대한 규칙만 제한적으로 유지합니다.
- 공통 정책이 변경되는 경우 이 파일이 아닌 `docs/guides/ai/ai-standards.md`를 갱신해야 합니다.

---
_Last reviewed: 2026-04-08_
