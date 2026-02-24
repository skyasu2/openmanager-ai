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
| `codex` | 코드 구현/리팩토링/테스트 | gpt-5.3-codex, Pro 구독 |
| `gemini` | 리서치/분석/문서화 | Pro 구독, OAuth 인증 |

> **3자 브릿지**: `scripts/ai/agent-bridge.sh --to <claude|codex|gemini>` (query/analysis/doc 모드)

## Built-in Subagents (5개)

| Agent | 용도 |
|-------|------|
| `Explore` | 코드베이스 탐색 (quick/medium/thorough) |
| `Plan` | 구현 계획 설계 |
| `general-purpose` | 범용 리서치 |
| `claude-code-guide` | Claude Code 공식 문서 |
| `statusline-setup` | 상태라인 설정 |

## Custom Agents — 외부 AI 위임 (2개)

> `.claude/agents/` 디렉토리에 정의. **하이브리드 정책**: 단순 작업은 Claude가 bridge 직접 호출, 복잡한 작업만 에이전트 spawn.

| Agent | 위임 대상 | 주요 용도 | 모델 | maxTurns |
|-------|----------|----------|------|:--------:|
| `codex-agent` | Codex CLI (gpt-5.3-codex) | 코드 구현, 리팩토링, 버그 수정, 테스트 | haiku | 8 |
| `gemini-agent` | Gemini CLI (Pro) | 리서치, 분석, 문서화, 코드 리뷰 | haiku | 7 |

### 하이브리드 위임 정책 (방안 C)

> **핵심 원칙**: haiku 래퍼 spawn은 Claude Max 한도를 소모한다. 불필요한 중간 레이어를 제거하여 토큰을 절약한다.

#### 단순 작업 → Claude가 bridge 직접 호출 (에이전트 spawn 안 함)
- 파일 5개 미만 수정, 단일 함수/컴포넌트
- 분석/리서치 1건
- 문서화 1건

```bash
# Claude가 직접 호출 (haiku spawn 없이)
bash scripts/ai/agent-bridge.sh --to codex --context-file src/path/file.ts "리팩토링해줘"
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis "아키텍처 분석해줘"
```

#### 복잡한 작업 → 에이전트 spawn (팀 모드 포함)
- 크로스 파일 리팩토링 (5개 이상)
- 병렬 작업 (codex + gemini 동시 실행)
- 자율적 판단/반복 수정이 필요한 구현

```bash
# 팀 모드 (병렬 대규모 작업)
Task(codex-agent, "컴포넌트 리팩토링", background)
Task(gemini-agent, "최신 패턴 조사", background)
```

#### Gemini 사전 검증 (필수)
```bash
# bridge 호출 전 OAuth 확인 (실패율 47% 방지)
test -s ~/.gemini/oauth_creds.json && echo "OK" || echo "FAIL"
```

### 역할 분담 — 자유 분배

| AI | 주요 강점 | 우선 선택되는 작업 |
|----|----------|------------------|
| Claude Code (Opus) | 오케스트레이션, 도구 체계, 컨텍스트 | 계획, 리뷰, 통합, 최종 판단, **단순 bridge 호출** |
| Codex (gpt-5.3-codex) | 코드 생성, sandbox full-access | 구현, 리팩토링, 버그 수정, 테스트 작성 |
| Gemini (Pro) | 대규모 컨텍스트, 멀티모달 | 리서치, 분석, 문서화, 긴 파일 처리 |

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
- **토큰 비용**: teammate 수에 비례 증가 (3명 팀 1회 = 단독 에이전트 3~5회 비용)
- 파일 충돌 방지: teammate별 파일 경계 반드시 명시
- **spawn 기준**: 병렬 처리가 확실히 이득일 때만 팀 모드 사용. 순차 처리로 충분하면 Claude가 bridge 직접 호출

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
