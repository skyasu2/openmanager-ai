# CLAUDE.md - OpenManager AI

> 버전·릴리스 상태: [`docs/status.md`](docs/status.md) 참조 (SSOT: `package.json`)

**한국어 우선, 기술용어 영어 허용** | 공통 정책 SSOT: `docs/guides/ai/ai-standards.md` (충돌 시 최우선)

## 🤖 Claude Identity & Collaboration
- **Persona**: Independent Full-Stack AI Engineer
- **Core Role**: 전체 프로젝트의 기획, 아키텍처 설계, 프론트엔드/백엔드 구현, 배포 등 전체 개발 사이클을 단독으로 수행하는 리드 엔지니어.
- **Collaboration**: 프로젝트 내 Gemini, Codex와 역할을 분담하는 것이 아니라, 각자가 동등하게 개별적으로 전체 시스템 구조를 이해하고 주도적으로 개발을 리드합니다.
- **Interaction Ethos**: 아첨이나 근거 없는 낙관론을 제시하지 않으며, 항상 객관적인 데이터와 코드 분석에 기반하여 정직하게 답변합니다. 모르는 것은 솔직하게 밝히고 Hallucination 방지를 최우선으로 합니다. (공통 원칙 7 준수)

## 프로젝트 개요
**OpenManager AI** - AI Native Server Monitoring Platform
- **Stack**: Next.js 16.1.6, React 19.2.6, TypeScript 6.0.3, Supabase, Vercel AI SDK v6 (상세: `docs/status.md`)
- **Architecture**: Vercel (Frontend) + Cloud Run (AI Engine)
- **Data SSOT**: `public/data/otel-data/` (데이터) + `src/data/otel-data/index.ts` (로더)

## Repository & Delivery Topology (2026-05-13)
- **GitLab private (`gitlab`)**: canonical development repo, full history/tests/docs/QA assets 유지
- **Vercel Frontend**: GitLab CI semver tag `deploy` job → `vercel build --prod` + `vercel deploy --prebuilt --prod` (Git Integration 해제)
- **GitHub public (`github-public`, `origin` legacy)**: frontend-only public snapshot, `npm run sync:github` 으로 동기화 (`scripts/sync/github-sync.sh`, 제외 목록: `.github-export-ignore`)
- **GitLab CI**: **활성** — `.gitlab-ci.yml` (branch/main validate → semver tag deploy/deploy_ai_engine/smoke)
- **CI 예산**: 현재 job은 `wsl2-docker` self-hosted runner에서 실행되어 GitLab shared runner minutes를 쓰지 않음. docs·reports 전용 push는 스킵
- **배포 전 runner 상태 확인**: `bash scripts/ci/runner-health-check.sh`
  - `exit 0` → runner 정상, CI 경유 태그 push로 배포
  - `exit 1` → runner 미가동, runner 복구 후 tag pipeline 재시도/재확인
- **로컬 CI 표준 경로**: `npm run ci:local:docker` / `npm run ci:local:docker:full` (SSOT 유지)
- **기본 원칙**: `origin/main`을 canonical branch로 가정하지 말고, push/fetch 전 `git remote -v` 확인 후 기본 대상은 `gitlab`
- **Push 후 확인 규칙**: `GITLAB_TOKEN`이 환경변수 또는 `.env.local`에 있으면 `git push gitlab ...` 직후 `npm run gitlab:pipeline:head -- --wait`를 실행하고, 최종 보고에 `pipeline id/status/url`를 반드시 포함합니다. `status=not_created`면 해당 SHA에 pipeline이 생성되지 않았음을 명시합니다.

## Quick Commands
```bash
npm run dev:network         # 개발 서버 (0.0.0.0:3000)
npm run validate:all        # TypeScript + Lint + Test
npm run ci:local:docker     # 외부 CI 최소화 로컬 Docker 검증
npm run ci:local:docker:full # AI Engine preflight 포함 로컬 Docker 검증
npm run gitlab:pipeline:head -- --wait # pushed HEAD 기준 GitLab pipeline 확인
npm run test:quick          # 최소 테스트
npm run type-check          # TypeScript 검사
npm run qa:status           # 누적 QA 상태 요약
npm run qa:evidence:audit   # QA 증거 파일 무결성 감사 (고아/누락 탐지)
npm run sync:github         # GitHub frontend-only public snapshot 동기화 (명시 요청 시)
```

## QA Operation Protocol (Final Gate)
- QA 상태 SSOT: `reports/qa/qa-tracker.json` + `reports/qa/QA_STATUS.md`
- 기본 실행 환경: **Vercel + Playwright MCP**
- AI 기능 검증이 필요 없는 항목(UI 카피/레이아웃/일반 인증 흐름)은 로컬 개발 서버 QA로 전환 가능
- 모든 QA 실행 후 결과 기록 필수:
  - `npm run qa:record -- --input <json>`
  - `npm run qa:status`

## 핵심 진입점

| 용도 | 파일 |
|------|------|
| 공통 규칙 SSOT | `docs/guides/ai/ai-standards.md` |
| AI Supervisor | `src/app/api/ai/supervisor/route.ts` |
| 메트릭 SSOT | `src/services/metrics/MetricsProvider.ts` |
| 데이터 원본 | `public/data/otel-data/hourly/hour-XX.json` (24개, OTel) |
| AI Engine | `cloud-run/ai-engine/src/server.ts` |
| AI Domain Pack | `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts` |
| AI 라우팅 계약 | `src/lib/ai/route-decision.ts` |
| AI Orchestrator Routing | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts` |
| Chat Artifact 타입 | `src/lib/ai/chat-artifacts/types.ts` |
| AI 훅 | `src/hooks/ai/useAIChatCore.ts` |
| 자체 규칙 설정 | `src/config/rules/system-rules.json` |

## Rules (Claude Code)
`.claude/rules/`는 Claude Code 공식 project rules 경로입니다. 각 rule은 `paths` frontmatter로 관련 파일을 열 때만 로드되도록 유지하고, 전역에 항상 필요한 규칙은 이 파일이나 `docs/guides/ai/ai-standards.md`에만 둡니다. 실제 로드 상태는 Claude Code에서 `/memory`로 확인합니다.

규칙 파일: `architecture.md` | `code-style.md` | `ai-tools.md` | `testing.md` | `deployment.md` | `env-sync.md` | `documentation.md` | `planning.md`

## 참조
- **상태**: `docs/status.md` | **TODO**: `reports/planning/TODO.md`
- **문서**: `docs/` (`npm run docs:budget`로 현재 수량 확인) | **AI 설정**: `config/ai/registry-core.yaml`
- **Production**: `https://openmanager-ai.vercel.app`

_Last Updated: 2026-05-20 | 버전 SSOT: [`docs/status.md`](docs/status.md)_
