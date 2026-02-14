# 개발 환경 가이드

> OpenManager AI v8 개발 환경 구축 및 설정 가이드
> Doc type: How-to

## 개요

이 프로젝트는 **WSL 2 + Claude Code + Codex** 기반의 AI-assisted 개발 환경을 사용합니다.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [전체 환경 구축](./full-setup-guide.md) | 제로베이스에서 완전 구축 **(필독, WSL 포함)** |
| [Git Hooks 워크플로우](./git-hooks-workflow.md) | Pre-commit, Pre-push, CI/CD 최적화 |
| [Docker 개발 환경](./docker.md) | Docker Desktop + WSL, AI Engine 로컬 테스트, 배포 |
| [개발 도구](./dev-tools.md) | Node.js, npm, IDE 설정 |
| [프로젝트 설정](./project-setup.md) | 프로젝트 초기화 및 환경변수 |
| [코딩 표준](./coding-standards.md) | 개발 방법론 및 코드 스타일 |
| [문서 관리](./documentation-management.md) | 문서 구조/정합성/인벤토리 관리 기준 |
| [Codex 전환 가이드](./codex-main-transition-guide.md) | Claude Skill 참조 기반 Codex 메인 전환 전략 |
| [Stitch 가이드](./stitch-guide.md) | UI 구현 기준, 정합성 정책, 증분 개선 워크플로우 통합 |

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
```

## 관련 문서

- [Vibe Coding 가이드](../vibe-coding/README.md) - AI 도구 활용
- [테스트 전략](../guides/testing/test-strategy.md)
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology)
- [Stitch 프로젝트 레지스트리](../../config/ai/stitch-project-registry.json)
