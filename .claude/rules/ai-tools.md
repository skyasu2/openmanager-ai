# AI Tools Usage Rules

## MCP Servers (7개 상시 + 1개 온디맨드)

| MCP | 용도 | 우선순위 | `.mcp.json` |
|-----|------|:-------:|:-----------:|
| `diagram-converter-mcp` | Mermaid 다이어그램 렌더/검증 | 높음 | ✅ |
| `chrome-devtools` | CDP 성능 트레이스/CWV/메모리/Lighthouse/네트워크 진단 | 높음 | ✅ |
| `next-devtools` | Next.js 런타임 진단, 에러/라우트/로그 조회 (dev server 필수) | 중간 | ✅ |
| `supabase-db` | PostgreSQL 관리 (로컬 설치, "supabase" 이름 회피) | 중간 | ✅ |
| `vercel` | 배포 상태 확인 | 중간 | ✅ |
| `playwright` | E2E 테스트 (사용자 플로우/인터랙션) | 중간 | ✅ |
| `github` | 저장소/PR 관리 | 중간 | ✅ |
| `context7` | 라이브러리 공식 문서 | — | ❌ 제거 (활용도 저하) |
| `sequential-thinking` | 복잡한 추론 분해 | — | ❌ 제거 (활용도 저하) |
| `stitch` | Google Stitch AI UI 디자인 | — | ❌ 제거 (온디맨드만 사용) |
| `lighthouse` | Core Web Vitals + Performance/A11y/SEO 감사 | — | ❌ 제거 (`chrome-devtools` lighthouse_audit으로 대체) |
| `storybook` | 컴포넌트 문서·스토리 자동 생성 (Storybook dev 서버 필수) | 온디맨드 | ❌ 수동 추가 |

### chrome-devtools vs playwright 역할 분담

| 목적 | 선택 MCP | 이유 |
|------|---------|------|
| E2E 테스트/사용자 플로우 | `playwright` | 기능 풍부, 안정적 |
| CWV 성능 측정 (LCP/CLS/FCP) | `chrome-devtools` | CDP 네이티브 `performance_*` |
| Lighthouse 감사 (A11y/SEO/BP) | `chrome-devtools` | `lighthouse_audit` 내장 |
| 메모리 누수 분석 | `chrome-devtools` | `take_memory_snapshot` |
| 네트워크/콘솔 상세 검사 | `chrome-devtools` | reqid 기반 상세 조회 |
| 인터랙션 (click/fill) | `playwright` 우선 | `chrome-devtools`와 중복이나 playwright 우선 |

### chrome-devtools 베스트 프랙티스 워크플로우

```
1. navigate_page(url)            # 이동
2. take_snapshot()               # a11y 트리 조회 (스크린샷보다 10배 효율)
3. click(uid) / fill(uid)        # uid 기반 인터랙션 (CSS 셀렉터보다 안정적)
4. wait_for(["텍스트"])           # 상태 전환 감지
5. take_screenshot()             # 시각 확인이 꼭 필요할 때만
```

### chrome-devtools headed 모드 (브라우저 창 표시)

**현재 Claude 설정**: `--isolated --headless` (헤드리스)
**Codex 설정**: `--isolated` (headed, 브라우저 창 표시됨)

headed 모드로 전환하려면 `.mcp.json`에서 `--headless` 제거 후 Claude Code 재시작:
```json
"args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
```

기존 Chrome 세션(로그인 상태) 재사용하려면 `--browser-url` 사용:
```json
"args": ["-y", "chrome-devtools-mcp@latest", "--browser-url", "http://127.0.0.1:9222"]
```
```bash
# 먼저 Chrome을 remote debugging 포트로 실행 (원하는 프로필로 로그인 가능)
/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-session
```

WSL2 전제조건 (이미 충족): `DISPLAY=:0` ✅, `/usr/bin/google-chrome` ✅

## Skills (3-AI 아키텍처)

> **스킬 경로**: Claude native = `.claude/skills/` | Codex/Gemini common adapter = `.agents/skills/` | Gemini-only overlay = `.gemini/skills/` (same-name 금지) | 공통 기준 = `config/ai/skill-baselines.json` | Codex user mirror = `npm run skills:sync:codex` → `~/.codex/skills/`

| Skill | 설명 | Claude | Codex/Gemini |
|-------|------|:------:|:------------:|
| `git-workflow` | GitLab canonical push + GitHub sync (GitLab 우선) | ✅ | ✅ |
| `git-clean-gone` | [gone] 브랜치 정리 (dry-run → 삭제, worktree 포함) | ✅ | — |
| `cloud-run` | Cloud Run 배포 + GCP 비용 점검 | ✅ | ✅ |
| `lint-smoke` | Lint + 타입 + 테스트 스모크 체크 | ✅ | ✅ |
| `code-review` | 6관점 심각도 우선 리뷰 (go/conditional/no-go) | ✅ | ✅ |
| `doc-management` | 문서 현황 점검, 예산 관리 | ✅ | ✅ |
| `qa-ops` | Vercel + Playwright MCP 최종 QA 및 누적 기록 | ✅ | ✅ |
| `qa-state` | 상태 진단 + QA 실행 + 기록 통합 워크플로우 | ✅ | ✅ |
| `state-triage` | QA/런타임/AI provider 원인 분석 + 다음 단계 | ✅ | ✅ |
| `env-sync` | Vercel/Cloud Run env drift 진단 + 동기화 | ✅ | ✅ |

> Built-in skills: `frontend-design` (UI 생성)
> 스킬 변경 후: `npm run skills:check`

## CLI Tools (WSL)

| CLI | 용도 | 비고 |
|-----|------|------|
| `claude` | 코드 생성/수정/리뷰 | 현재 세션 |
| `codex` | 코드 구현/리팩토링/테스트 | gpt-5.3-codex, Pro 구독, **Claude 브릿지 위임 또는 사용자 수동 실행** |
| `gemini` | 리서치/분석/문서화 | Pro 구독, OAuth 인증, **사용자가 수동 실행** |

> **Codex 위임 정책 (비용 최적화)**:
> - Claude Code Pro = 한도 있음 → 아껴써야 함
> - Codex CLI Pro = 거의 무제한 → 적극 위임
>
> **Claude가 판단해서 자동 위임** (`bash scripts/ai/agent-bridge.sh --to codex "..."`)
>
> | 작업 유형 | 담당 |
> |-----------|------|
> | 코드 구현, 리팩토링, 파일 수정 | **Codex** |
> | 테스트 작성, CI 스크립트 수정 | **Codex** |
> | 반복적/기계적 코드 변경 | **Codex** |
> | 아키텍처 설계, 깊은 코드 리뷰 | **Claude** |
> | 사용자 질문 답변, 맥락 분석 | **Claude** |
> | 리서치, 문서 분석 | **Gemini** (사용자 직접) |
>
> Gemini는 여전히 사용자가 직접 실행. Codex는 Claude가 자율 위임 가능.

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

**See Also**: 상세 문서 → `docs/development/vibe-coding/` (mcp-servers.md, skills.md, multi-agent-tools.md)
