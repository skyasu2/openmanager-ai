# .claude 폴더 구조 가이드

> **Claude Code 공식 표준 준수** (2026-02-17 업데이트)
> 공식 문서: https://docs.anthropic.com/en/docs/claude-code/settings

## 폴더 구조

```
.claude/
├── settings.json          # 프로젝트 공유 설정 (hooks)
├── settings.local.json    # 로컬 권한 설정 (gitignore)
├── rules/                 # 자동 로드 규칙 (7개)
│   ├── architecture.md
│   ├── code-style.md
│   ├── ai-tools.md
│   ├── testing.md
│   ├── deployment.md
│   ├── env-sync.md
│   └── documentation.md
├── skills/                # 커스텀 스킬 정의
│   └── */SKILL.md
└── commands/              # 커스텀 슬래시 명령어
    └── review.md
```

## 커스텀 스킬 (4개)

| 스킬 | 버전 | 용도 |
|------|------|------|
| `git-workflow` | v1.0.0 | Git 커밋/푸시/PR 워크플로우 (commit, clean_gone) |
| `cloud-run` | v1.0.0 | Cloud Run 배포 + GCP 비용 점검 |
| `lint-smoke` | v1.4.0 | Lint + 테스트 스모크 체크 |
| `doc-management` | v1.2.0 | 문서 현황 점검, 예산 관리 |

## MCP 서버 (8개)

| MCP 서버 | 주요 기능 | 우선순위 |
|----------|----------|---------|
| **context7** | 라이브러리 공식 문서 | 높음 |
| **sequential-thinking** | 복잡한 리팩토링, 아키텍처 설계 | 높음 |
| **supabase-db** | PostgreSQL 관리 | 중간 |
| **vercel** | 배포 관리 | 중간 |
| **playwright** | E2E 테스트 | 중간 |
| **next-devtools** | Next.js 런타임 진단 | 중간 |
| **github** | 저장소 관리 | 중간 |
| **stitch** | Google Stitch AI UI 디자인 | 중간 |

## Hooks 설정

### PostToolUse (Write/Edit 후)
- Biome 자동 포맷팅 적용

### PreToolUse (Bash 전)
- 명령어 로깅 (`logs/claude-bash-commands.log`)

## 권한 관리

`settings.local.json`은 와일드카드 패턴으로 최적화 (~90개 항목):
- `Bash(npm:*)` - npm 명령어 전체
- `Bash(git:*)` - git 명령어 전체
- `mcp__context7__*` - MCP 서버별 와일드카드
- `Skill(git-workflow)` - 스킬 권한
- `WebFetch(domain:*.anthropic.com)` - 도메인별 허용

## 참고 문서

- [Claude Code 설정 가이드](https://docs.anthropic.com/en/docs/claude-code/settings)
- [서브에이전트 가이드](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [MCP 서버 가이드](https://docs.anthropic.com/en/docs/claude-code/mcp-servers)
