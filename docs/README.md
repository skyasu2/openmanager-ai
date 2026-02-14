# OpenManager AI Documentation

> OpenManager 문서 허브 — 개발 결과물과 개발환경을 중심으로 구성
> Owner: documentation
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-02-14
> Canonical: docs/README.md
> Tags: docs,index,navigation
>
> Project: OpenManager AI v8.0.0
> Last verified against code: 2026-02-14

**이 프로젝트는 포트폴리오 & 바이브 코딩 학습 목적으로 개발되었습니다.**
AI Native 도구(Claude Code, Codex, Gemini)로 서버 모니터링 플랫폼을 구축하는 과정 자체가 핵심 결과물입니다.

## 문서 구성

| 섹션 | 내용 | 비고 |
|------|------|------|
| **[개발 결과물](./reference/README.md)** | 시스템 아키텍처, AI 엔진, 데이터 파이프라인 | 무엇을 만들었나 |
| **[개발환경 & 바이브 코딩](./vibe-coding/README.md)** | AI 도구 세팅, MCP, Agent Teams, 워크플로우 | 어떻게 만들었나 |
| **[개발 가이드](./development/README.md)** | 프로젝트 셋업, 코딩 표준, 테스트 | 개발 규칙 |
| **[가이드](./guides/README.md)** | AI 표준, 테스트 전략, 옵저버빌리티 | 운영 지침 |
| **[트러블슈팅](./troubleshooting/README.md)** | 자주 발생하는 문제와 해결법 | 문제 해결 |

## 추천 학습 경로

### 결과물 파악 (무엇을 만들었나)
1. [Quick Start](./QUICK-START.md)
2. [System Architecture](./reference/architecture/system/system-architecture-current.md)
3. [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md)
4. [API Endpoints](./reference/api/endpoints.md)

### 개발환경 파악 (어떻게 만들었나)
1. [Vibe Coding 개요](./vibe-coding/README.md)
2. [AI 도구 세팅](./vibe-coding/setup.md)
3. [MCP 서버 구성](./vibe-coding/mcp-servers.md)
4. [Agent Teams & 워크플로우](./vibe-coding/workflows.md)
5. [AI Standards](./guides/ai/ai-standards.md)
6. [AGENTS.md](../AGENTS.md)

## Historical Documents

- `docs/analysis/*`: 시점 기반 분석/검토 문서
- `docs/reviews/*`: 리뷰 리포트 문서
- `docs/archived/*`: 임시 보관소(삭제 전 흡수 원칙), 현재 예외 보존은 `docs/archived/decisions/*`만 허용
- 현재 기준과 다를 수 있으므로 각 문서의 `Status`/기준 버전을 확인하세요.

## Related

- [Project Status](./status.md)
- [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md)
- [LLM Context](./llms.md)
