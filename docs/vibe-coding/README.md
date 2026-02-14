# Vibe Coding 가이드

> AI와 함께하는 새로운 개발 패러다임
> Owner: dev-experience
> Status: Active Canonical
> Doc type: Overview
> Last reviewed: 2026-02-14
> Canonical: docs/vibe-coding/README.md
> Tags: vibe-coding,ai-workflow

## Vibe Coding이란?

**Vibe Coding**은 AI 도구를 활용한 협업 개발 방식입니다. 개발자가 의도(vibe)를 전달하면 AI가 구현을 돕습니다.

### 핵심 원칙

1. **AI는 주니어 개발자** - 항상 검토 필수
2. **작은 단위로 작업** - Mega Prompt 금지
3. **명확한 컨텍스트** - Spec Before Code
4. **빠른 피드백 루프** - 작게 커밋, 자주 검증

## 도구 생태계

```
┌─────────────────────────────────────────────────────────┐
│                    Vibe Coding Stack                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Claude Code │  │   Codex     │  │   Gemini    │     │
│  │ (협업 개발)   │  │ (협업 개발)  │  │ (협업 개발)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │              MCP Servers (8개)                    │  │
│  │  context7 | supabase | playwright | next-devtools │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Skills (11개)                        │  │
│  │  commit | review | lint-smoke | security | ...   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 문서 목록

| 문서 | 설명 |
|------|------|
| [설치 가이드](./setup.md) | AI 도구 설치 및 로그인 설정 |
| [Claude Code](./claude-code.md) | Claude CLI 전용 사용법 |
| [AI 도구들](./multi-agent-tools.md) | 3-CLI 협업 개발 운영 가이드 |
| [MCP 서버](./mcp-servers.md) | 8개 MCP 서버 활용법 |
| [Skills](./skills.md) | 11개 커스텀 스킬 레퍼런스 |
| [워크플로우](./workflows.md) | 실전 개발 워크플로우 |

## 빠른 시작

### 1. 협업 CLI 실행

```bash
# 프로젝트 디렉토리에서 (주 작업 에이전트 선택)
claude
codex

# 보조 검증
gemini
```

### 2. 기본 워크플로우

```
1. 요구사항 전달 (한글 OK)
2. Claude/Codex 중 주 작업 에이전트가 계획 수립
3. 코드 작성/수정
4. Gemini/Codex로 검증 및 보완
5. /commit으로 커밋
```

### 3. 유용한 명령어

```bash
# 커밋
/commit

# 에이전트 간 대화/리뷰 요청 (공통 템플릿)
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "현재 변경분 리뷰해줘"
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "대안 설계를 비교해줘"
bash scripts/ai/agent-bridge.sh --to claude --mode doc --save-auto "변경사항 요약 문서 작성"

# PR 생성
/commit-push-pr
```

## 프로젝트 설정

### CLAUDE.md

프로젝트 루트의 `CLAUDE.md`가 AI에게 컨텍스트를 제공합니다.

```markdown
# CLAUDE.md
- 프로젝트 개요
- 기술 스택
- 규칙 참조 (.claude/rules/)
```

### .claude/rules/

세부 규칙 파일들:

```
.claude/rules/
├── code-style.md      # 코드 스타일
├── architecture.md    # 아키텍처
├── ai-tools.md        # AI 도구 사용
├── testing.md         # 테스트
└── deployment.md      # 배포
```

### AGENTS.md (정책 SSOT)

멀티 에이전트 공통 운영 정책은 루트 `AGENTS.md`를 SSOT로 사용합니다.
- Codex는 기본적으로 개발/개선 중심으로 동작
- 병행 작업 환경(Claude Code/Gemini) 협업 정책 적용
- 에이전트 전용 문서(`CLAUDE.md`, `GEMINI.md`)와 충돌 시 `AGENTS.md` 우선

## 협업 개발 운영 (3-CLI)

기본 운영은 **Claude Code + Codex CLI + Gemini CLI 협업 개발**입니다.  
자동 AI 리뷰 대신 브리지 스크립트로 상호 대화/검증 요청을 수행합니다.
집계가 필요하면 Codex 결과를 기준으로 카운트할 수 있습니다.

```
요구사항 정리 → 구현(Claude/Codex) → 검증(Gemini/Codex) → 커밋
```

### 검증 처리

```bash
# Codex 기준 검증
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "현재 변경사항의 리스크를 점검해줘"

# Gemini 보조 검증
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "대안 설계와 트레이드오프를 비교해줘"
```

## Best Practices

### Progressive Disclosure (문서 계층화)

AI 도구의 context window를 효율적으로 사용하기 위해 4단계 계층으로 문서를 구성합니다:

```
L1: CLAUDE.md (~40줄)      ← 항상 로드, 핵심 포인터만
L2: .claude/rules/ (6파일)  ← 자동 로드, 도메인별 규칙
L3: docs/ (71파일)          ← 필요시 참조, 상세 가이드
L4: Skills (11개)           ← 명시적 호출, 자동화 워크플로우
```

**Context Rot 방지**: LLM의 긴 context에서 attention이 불균일하게 저하됩니다. 문서를 짧게 유지하고, 상세 내용은 포인터로 연결하세요.

### DO

- 작은 단위로 작업 (한 기능씩)
- 명확한 요구사항 전달 (Spec Before Code)
- AI 출력 항상 검토 (AI = Junior Developer)
- 자주 커밋, 자주 검증 (Rapid Feedback Loop)
- 에이전트별 파일 경계 명시 (Multi-Agent 충돌 방지)

### DON'T

- "앱 전체 만들어줘" (Mega Prompt)
- AI 출력 무검토 머지
- 보안 관련 AI 맹신 (45% 보안 취약점 포함 연구 결과)
- 한 번에 너무 많은 변경
- Free Tier 한도 초과 리소스 설정

## 보안 주의사항

- API 키 절대 하드코딩 금지
- AI 출력은 untrusted로 취급
- 보안 검증: `/security-audit-workflow`

## 관련 문서

- [개발 환경](../development/README.md)
- [테스트 전략](../guides/testing/test-strategy.md)
- [아키텍처](../reference/architecture/system/system-architecture-current.md)
