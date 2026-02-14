# AI Tools Usage Rules

## MCP Servers (8개)

| MCP | 용도 | 우선순위 |
|-----|------|:-------:|
| `context7` | 라이브러리 공식 문서 | 높음 |
| `sequential-thinking` | 복잡한 리팩토링, 아키텍처 설계 | 높음 |
| `next-devtools` | Next.js 런타임 진단, 에러/라우트/로그 조회 (dev server 필수) | 중간 |
| `stitch` | Google Stitch AI UI 디자인 | 중간 |
| `supabase` | PostgreSQL 관리 | 중간 |
| `vercel` | 배포 상태 확인 | 중간 |
| `playwright` | E2E 테스트 | 중간 |
| `github` | 저장소/PR 관리 | 중간 |

## Skills (5개)

| Skill | 설명 |
|-------|------|
| `commit-commands` | Git 커밋 워크플로우 (commit, commit-push-pr, clean_gone) |
| `lint-smoke` | Lint + 테스트 스모크 체크 |
| `github-deploy` | GitHub MCP 기반 push/PR (`gh auth` 불필요) |
| `cloud-run-deploy` | Cloud Run AI Engine 배포 |
| `gcp-cost-check` | GCP 비용 조회, Free Tier 사용량 분석 |

> Built-in skills: `review` (코드 품질), `code-review` (PR 리뷰), `frontend-design` (UI 생성)

## CLI Tools (WSL)

| CLI | 용도 | 비고 |
|-----|------|------|
| `claude` | 코드 생성/수정/리뷰 | 현재 세션 |

## Built-in Subagents (5개)

| Agent | 용도 |
|-------|------|
| `Explore` | 코드베이스 탐색 (quick/medium/thorough) |
| `Plan` | 구현 계획 설계 |
| `general-purpose` | 범용 리서치 |
| `claude-code-guide` | Claude Code 공식 문서 |
| `statusline-setup` | 상태라인 설정 |

## Agent Teams (3팀 구성)

> 활성화: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (settings.json)

### Team 1: Dashboard & Metrics
| Teammate | 담당 | 파일 경계 |
|----------|------|----------|
| ui | 컴포넌트 UI | `components/dashboard/`, `components/charts/`, `components/ui/` |
| data | 데이터 레이어 | `services/metrics/`, `hooks/api/`, `stores/`, `data/` |

프롬프트 예시:
```
Create an agent team for dashboard work:
- "ui": owns src/components/dashboard/ and src/components/charts/
- "data": owns src/services/metrics/, src/hooks/api/, src/stores/
No shared file edits between teammates.
```

### Team 2: AI & Chat
| Teammate | 담당 | 파일 경계 |
|----------|------|----------|
| frontend-ai | AI UI/훅 | `components/ai/`, `components/ai-sidebar/`, `hooks/ai/` |
| backend-ai | API/로직 | `app/api/ai/`, `lib/ai/`, `services/rag/` |
| engine | Cloud Run | `cloud-run/ai-engine/` |

프롬프트 예시:
```
Create an agent team for AI feature work:
- "frontend-ai": owns src/components/ai/, src/hooks/ai/
- "backend-ai": owns src/app/api/ai/, src/lib/ai/
- "engine": owns cloud-run/ai-engine/
Each teammate must not edit files outside their domain.
```

### Team 3: Quality & Review (읽기 전용)
| Teammate | 관점 | 초점 |
|----------|------|------|
| security | 보안 리뷰 | OWASP Top 10, 입력 검증, 인증 |
| performance | 성능 리뷰 | 번들, 렌더링, API 응답시간 |
| test | 테스트 리뷰 | 커버리지 갭, 엣지 케이스 |

프롬프트 예시:
```
Create an agent team to review recent changes:
- "security": review for OWASP top 10 vulnerabilities
- "performance": review for bundle size, render cycles, API latency
- "test": review for coverage gaps and edge cases
Have them challenge each other's findings.
```

### 사용 주의사항
- WSL 환경: split-pane 미지원, in-process 모드만 사용
- 토큰 비용: teammate 수에 비례 증가, 필요시만 spawn
- 파일 충돌 방지: teammate별 파일 경계 반드시 명시

## Permission Pattern (Best Practice)

```json
{
  "permissions": {
    "allow": [
      "Bash(command:*)",
      "Skill(skill-name)",
      "MCP-Server:*",
      "mcp__server__*"
    ]
  }
}
```

- Bash: 와일드카드 패턴 사용 (`npm:*`, `git:*`)
- MCP: 서버별 와일드카드 (`mcp__context7__*`)
- API Key: 환경변수 사용, 하드코딩 금지

---

**See Also**: 상세 문서 → `docs/vibe-coding/` (mcp-servers.md, skills.md, ai-tools.md)
