# OpenManager AI Documentation

> **프로젝트 버전**: v7.1.4 | **Updated**: 2026-02-08

---

## Quick Navigation

| 섹션 | 설명 | 바로가기 |
|------|------|----------|
| 🚀 **Quick Start** | 빠른 시작 | [→ QUICK-START.md](./QUICK-START.md) |
| 🖥️ **Development** | 개발 환경 설정 | [→ development/](./development/) |
| 🤖 **Vibe Coding** | AI 도구 활용 가이드 | [→ vibe-coding/](./vibe-coding/) |
| 📖 **Guides** | How-to 가이드 | [→ guides/](./guides/) |
| 📚 **Reference** | 기술 레퍼런스 | [→ reference/](./reference/) |
| 🔧 **Troubleshooting** | 문제 해결 | [→ troubleshooting/](./troubleshooting/) |

---

## Documentation Structure

```
docs/
├── QUICK-START.md           # 빠른 시작
├── development/             # 개발 환경 ⭐ NEW
│   ├── README.md            # 개발 환경 개요
│   ├── full-setup-guide.md  # 전체 환경 구축 (WSL 포함)
│   ├── dev-tools.md         # 개발 도구
│   └── project-setup.md     # 프로젝트 설정
├── vibe-coding/             # Vibe Coding ⭐ NEW
│   ├── README.md            # Vibe Coding 개요
│   ├── claude-code.md       # Claude Code 마스터
│   ├── ai-tools.md          # AI 도구 (Codex, Gemini)
│   ├── mcp-servers.md       # MCP 서버 활용
│   ├── skills.md            # Skills 레퍼런스
│   └── workflows.md         # 개발 워크플로우
├── guides/                  # How-to 가이드
│   ├── ai/                  # AI 관련
│   ├── testing/             # 테스트
│   └── standards/           # 코딩 표준
├── reference/               # 기술 레퍼런스
│   ├── architecture/        # 아키텍처
│   └── api/                 # API 문서
└── troubleshooting/         # 문제 해결
```

---

## 추천 학습 경로

### 🆕 신규 개발자

1. [Quick Start](./QUICK-START.md) - 5분 만에 시작
2. [개발 환경](./development/README.md) - WSL, 도구 설정
3. [Vibe Coding](./vibe-coding/README.md) - AI 도구 활용

### 🤖 Vibe Coding 입문

1. [Vibe Coding 개요](./vibe-coding/README.md) - 철학과 원칙
2. [Claude Code](./vibe-coding/claude-code.md) - 메인 AI 도구
3. [워크플로우](./vibe-coding/workflows.md) - 실전 활용

### 🏗️ 아키텍처 이해

1. [시스템 아키텍처](./reference/architecture/system/system-architecture-current.md)
2. [AI 엔진](./reference/architecture/ai/ai-engine-architecture.md)
3. [하이브리드 구조](./reference/architecture/infrastructure/hybrid-split.md)

---

## Essential Documents

### 개발 환경 (NEW)
- [전체 환경 구축](./development/full-setup-guide.md) - WSL + Node.js + AI 도구 (필독)
- [개발 도구](./development/dev-tools.md) - Node.js, npm, IDE
- [프로젝트 설정](./development/project-setup.md) - 클론, 환경변수

### Vibe Coding (NEW)
- [Claude Code](./vibe-coding/claude-code.md) - AI 페어 프로그래밍
- [AI 도구들](./vibe-coding/ai-tools.md) - Codex, Gemini 활용
- [MCP 서버](./vibe-coding/mcp-servers.md) - 9개 MCP 서버
- [Skills](./vibe-coding/skills.md) - 13개 커스텀 스킬
- [워크플로우](./vibe-coding/workflows.md) - 일일 개발 사이클

### Architecture
- [AI 엔진](./reference/architecture/ai/ai-engine-architecture.md)
- [시스템 구조](./reference/architecture/system/system-architecture-current.md)
- [데이터 아키텍처](./reference/architecture/data/data-architecture.md)

### Testing
- [테스트 전략](./guides/testing/test-strategy.md)
- [E2E 테스트](./guides/testing/e2e-testing-guide.md)

---

## By Role

### Developer (개발자)
1. [개발 환경 설정](./development/README.md)
2. [Vibe Coding 가이드](./vibe-coding/README.md)
3. [테스트 가이드](./guides/testing/)

### AI/ML Engineer
1. [AI 엔진 아키텍처](./reference/architecture/ai/ai-engine-architecture.md)
2. [AI 모델 정책](./ai-model-policy.md)
3. [AI 표준](./guides/ai/common/ai-standards.md)

### DevOps
1. [하이브리드 아키텍처](./reference/architecture/infrastructure/hybrid-split.md)
2. [배포 가이드](./reference/architecture/infrastructure/deployment.md)
3. [문제 해결](./troubleshooting/)

---

## Status & Metadata

| 문서 | 설명 |
|------|------|
| [Project Status](./status.md) | 현재 프로젝트 상태 |
| [Changelog](../CHANGELOG.md) | 변경 이력 |
| [AI Model Policy](./ai-model-policy.md) | AI 모델 정책 |
| [llms.md](./llms.md) | AI 최적화 컨텍스트 |

---

## External Resources

- [GitHub Repository](https://github.com/skyasu2/openmanager-ai)
- [Vercel Dashboard](https://vercel.com)
- [Supabase Dashboard](https://supabase.com)
- [Claude Code Docs](https://docs.anthropic.com/claude-code)
