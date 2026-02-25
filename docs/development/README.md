# 개발 환경 가이드

> OpenManager AI v8 개발 환경 구축 및 설정 가이드
> Owner: dev-experience
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-02-15
> Canonical: docs/development/README.md
> Tags: development,setup,index

## 개요

이 프로젝트는 **WSL 2 + Claude Code + Codex + Gemini CLI** 기반의 AI-assisted 개발 환경을 사용합니다.

## 문서 구조

### 1. WSL/배포환경 영역

| 문서 | 설명 |
|------|------|
| [프로젝트 설정](./project-setup.md) | WSL/의존성/환경변수 부트스트랩 Canonical 가이드 |
| [Docker 개발 환경](./docker.md) | Docker Desktop + WSL, AI Engine 로컬 테스트, 배포 |
| [환경 변수 관리](./environment-variables.md) | 전체 환경변수 맵, Secret Manager, 주입 정책 |
| [CI/CD 파이프라인](./ci-cd.md) | GitHub Actions/배포 흐름/운영 자동화 |
| [Git Hooks 워크플로우](./git-hooks-workflow.md) | Pre-commit/Pre-push 품질 게이트 |
| [개발 도구](./dev-tools.md) | Node.js/npm/IDE/로컬 도구 설정 |

### 2. Vibe Coding 영역

| 문서 | 설명 |
|------|------|
| [Vibe Coding 허브](./vibe-coding/README.md) | 멀티 에이전트 협업 운영 개요 |
| [AI 도구 설치](./vibe-coding/setup.md) | Claude/Codex/Gemini + MCP 설치/로그인 |
| [MCP 서버 가이드](./vibe-coding/mcp-servers.md) | MCP 구성/우선순위/트러블슈팅 |
| [AI 도구 운영](./vibe-coding/multi-agent-tools.md) | 역할 분담/도구 선택 기준 |
| [개발 워크플로우](./vibe-coding/workflows.md) | 실전 구현/검증/배포 플로우 |
| [Claude Code 가이드](./vibe-coding/claude-code.md) | CLI 중심 운영 레퍼런스 |
| [Skills 레퍼런스](./vibe-coding/skills.md) | 커스텀 스킬 카탈로그 |

### 3. 공통 개발 기준

| 문서 | 설명 |
|------|------|
| [코딩 표준](./coding-standards.md) | 개발 방법론 및 코드 스타일 |
| [문서 관리](./documentation-management.md) | 문서 구조/정합성/인벤토리 관리 기준 |
| [Codex 전환 가이드](./codex-main-transition-guide.md) | Codex 메인 운영 전환 전략 |
| [Stitch 가이드](./stitch-guide.md) | UI 증분 개선 워크플로우 통합 |

## 기술 스택

```
Runtime:      Node.js 24.x (Current)
Package:      npm 11.6.2
Framework:    Next.js 16.1.3 (App Router)
Language:     TypeScript 5.9.3 (strict mode)
UI:           React 19, Tailwind CSS 4
Database:     Supabase (PostgreSQL + pgVector)
AI:           Vercel AI SDK 6, Multi-Agent
```

## 필수 요구사항

### 시스템
- Windows 11 (WSL 2 지원)
- 16GB+ RAM (권장 32GB)
- SSD 저장소

### 소프트웨어
- WSL 2 (Ubuntu 24.04 권장, 22.04+ 호환)
- Docker Desktop (선택)
- Git
- Claude Code CLI
- Codex CLI
- Gemini CLI

## 빠른 시작

```bash
# 1. WSL에서 레포지토리 클론
git clone https://github.com/skyasu2/openmanager-ai.git
cd openmanager-ai

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env.local
# .env.local 편집

# 4. 개발 서버 실행
npm run dev:network

# 5. AI 브릿지 스모크 테스트 (선택)
bash scripts/ai/agent-bridge.sh --to claude --mode query "안녕하세요만 출력"
bash scripts/ai/agent-bridge.sh --to codex --mode query "안녕하세요만 출력"
```

## 관련 문서

- [Vibe Coding 허브](./vibe-coding/README.md) - AI 도구 활용
- [테스트 전략](../guides/testing/test-strategy.md)
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology)
- [Stitch 프로젝트 레지스트리](../../config/ai/stitch-project-registry.json)
