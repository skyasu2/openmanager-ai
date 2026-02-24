# AI Tools Usage Rules

## MCP Servers (9개)

| MCP | 용도 | 우선순위 |
|-----|------|:-------:|
| `context7` | 라이브러리 공식 문서 | 높음 |
| `sequential-thinking` | 복잡한 리팩토링, 아키텍처 설계 | 높음 |
| `storybook` | 컴포넌트 문서 조회·스토리 자동 생성 (Storybook dev 서버 필수) | 높음 |
| `next-devtools` | Next.js 런타임 진단, 에러/라우트/로그 조회 (dev server 필수) | 중간 |
| `stitch` | Google Stitch AI UI 디자인 | 중간 |
| `supabase-db` | PostgreSQL 관리 (로컬 설치, "supabase" 이름 회피) | 중간 |
| `vercel` | 배포 상태 확인 | 중간 |
| `playwright` | E2E 테스트 | 중간 |
| `github` | 저장소/PR 관리 | 중간 |

## Skills (4개)

| Skill | 설명 |
|-------|------|
| `git-workflow` | Git 커밋/푸시/PR 워크플로우 (commit, clean_gone) |
| `cloud-run` | Cloud Run 배포 + GCP 비용 점검 |
| `lint-smoke` | Lint + 테스트 스모크 체크 |
| `doc-management` | 문서 현황 점검, 예산 관리 |

> Built-in skills: `review` (PR 기반 코드리뷰), `frontend-design` (UI 생성)

## CLI Tools (WSL)

| CLI | 용도 | 비고 |
|-----|------|------|
| `claude` | 코드 생성/수정/리뷰 | 현재 세션 |
| `codex` | 코드 구현/리팩토링/테스트 | gpt-5.3-codex, Pro 구독, **사용자가 수동 실행** |
| `gemini` | 리서치/분석/문서화 | Pro 구독, OAuth 인증, **사용자가 수동 실행** |

> **Codex/Gemini 정책**: Claude가 서브에이전트로 위임하지 않음. 사용자가 각 CLI를 직접 실행.
> 브릿지 스크립트(`scripts/ai/agent-bridge.sh`)는 사용자 수동 호출용으로 유지.

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

### Worktree 격리 (v2.1.50+)

teammate/서브에이전트를 임시 git worktree에서 실행하여 파일 충돌을 원천 차단.

```bash
# CLI에서 worktree 격리 모드로 시작
claude --worktree  # 또는 -w

# 서브에이전트 spawn 시 격리
Task(agent, "작업 내용", isolation: "worktree")
```

- 변경 없이 완료 시 worktree 자동 정리
- 변경이 있으면 worktree 경로와 브랜치 반환
- `WorktreeCreate` / `WorktreeRemove` 훅 이벤트로 커스텀 setup/teardown 가능
- **권장**: Team 1, 2에서 teammate 간 같은 파일 접근 가능성이 있을 때 사용

### 공유 파일 (편집 금지 영역)

아래 경로는 모든 팀이 참조하므로 **teammate가 직접 수정하지 않음**. 수정 필요 시 lead가 직접 처리.

- `components/ui/` — 공용 UI 컴포넌트 (Button, Card, Dialog 등 52파일)
- `types/` — 공유 타입 정의
- `stores/` — Zustand 스토어 (3파일)
- `lib/utils.ts` — 공용 유틸리티

### Team 1: Dashboard & Metrics
| Teammate | 담당 | 파일 경계 |
|----------|------|----------|
| ui | 컴포넌트 UI | `components/dashboard/`, `components/charts/` |
| data | 데이터 레이어 | `services/metrics/`, `hooks/dashboard/`, `data/otel-data/` |

프롬프트 예시:
```
Create an agent team for dashboard work:
- "ui": owns src/components/dashboard/ and src/components/charts/
- "data": owns src/services/metrics/, src/hooks/dashboard/, src/data/otel-data/
Neither teammate edits src/components/ui/ or src/stores/ — lead handles those.
```

### Team 2: AI & Chat
| Teammate | 담당 | 파일 경계 |
|----------|------|----------|
| frontend-ai | AI UI/훅 | `components/ai/`, `components/ai-sidebar/`, `hooks/ai/` |
| backend-ai | API/로직 | `app/api/ai/`, `lib/ai/`, `lib/ai-proxy/` |
| engine | Cloud Run | `cloud-run/ai-engine/` |

프롬프트 예시:
```
Create an agent team for AI feature work:
- "frontend-ai": owns src/components/ai/, src/components/ai-sidebar/, src/hooks/ai/
- "backend-ai": owns src/app/api/ai/, src/lib/ai/, src/lib/ai-proxy/
- "engine": owns cloud-run/ai-engine/
No teammate edits src/stores/ or src/types/ — lead handles shared files.
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
Have them challenge each other's findings. Read-only — no file edits.
```

### 사용 주의사항
- **WSL 환경**: split-pane 미지원, in-process 모드만 사용 (Shift+Down으로 teammate 전환)
- **Delegate Mode**: 팀 생성 직후 Shift+Tab으로 delegate 모드 활성화 → lead는 오케스트레이션에 집중
- **토큰 비용**: teammate 수에 비례 증가 (3명 팀 1회 = 단독 에이전트 3~5회 비용)
- **파일 충돌 방지**: teammate별 파일 경계 반드시 명시. 공유 파일은 lead만 수정
- **spawn 기준**: 병렬 처리가 확실히 이득일 때만 팀 모드 사용 (15분 이상 소요 예상 시)
- **/resume 제한**: 세션 resume 시 기존 teammate가 소멸됨. 재개 후 teammate를 새로 spawn 필요

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
