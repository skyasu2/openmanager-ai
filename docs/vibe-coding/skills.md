# Skills 레퍼런스

> 프로젝트 맞춤형 자동화 워크플로우
> Owner: dev-experience
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

**Skills**는 Claude Code에서 `/명령어`로 실행하는 커스텀 워크플로우입니다.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │ →   │   /skill    │ →   │  Automated  │
│  /commit    │     │   Loader    │     │  Workflow   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 등록된 Skills (13개)

### 코드 품질

| Skill | 명령어 | 설명 |
|-------|--------|------|
| review | `/review` | AI 리뷰 결과 요약 (Legacy) |
| ai-code-review | `/ai-code-review` | 리뷰 분석 + 개선 실행 (Legacy) |
| lint-smoke | `/lint-smoke` | Lint + 테스트 스모크 |
| validation-analysis | `/validation-analysis` | 검증 결과 상세 분석 |

### 분석/진단

| Skill | 명령어 | 설명 |
|-------|--------|------|
| security-audit-workflow | `/security-audit-workflow` | OWASP Top 10 보안 감사 |
| playwright-triage | `/playwright-triage` | E2E 실패 분류 |
| next-router-bottleneck | `/next-router-bottleneck` | 라우터 성능 분석 |
| observability-check | `/observability-check` | AI 모니터링 (Langfuse + Sentry) |

### 배포/Git/비용

| Skill | 명령어 | 설명 |
|-------|--------|------|
| commit | `/commit` | Git 커밋 |
| commit-push-pr | `/commit-push-pr` | 커밋 → 푸시 → PR |
| clean_gone | `/clean_gone` | [gone] 브랜치 정리 |
| cloud-run-deploy | `/cloud-run-deploy` | AI Engine 배포 |
| gcp-cost-check | `/gcp-cost-check` | GCP 비용 조회, Free Tier 분석 |

### 문서/리포트

| Skill | 명령어 | 설명 |
|-------|--------|------|
| ai-report-export | `/ai-report-export` | 협업 검증 리포트 |
| mermaid-diagram | `/mermaid-diagram` | 다이어그램 생성 |

---

## 상세 가이드

### /commit

가장 자주 사용하는 커밋 워크플로우.

```bash
/commit
```

**워크플로우**:
1. `git status`로 변경사항 확인
2. 커밋 메시지 자동 생성
3. `git commit` 실행
4. 필요 시 `agent-bridge.sh`로 리뷰/검증 요청

**옵션**:
```bash
/commit -m "custom message"  # 메시지 지정
```

---

### /review (Legacy)

기존 리뷰 요약 명령입니다. 현재는 `agent-bridge.sh` 기반 검증 요청을 권장합니다.

```bash
/review
```

**출력 예시**:
```
📋 AI 리뷰 요약
━━━━━━━━━━━━━━━━━━━━━
최근 커밋: fix(api): handle 404
리뷰어: Codex
점수: 9/10

지적사항:
- [Low] 에러 메시지 상수화 권장
━━━━━━━━━━━━━━━━━━━━━
```

---

### /ai-code-review (Legacy)

기존 리뷰 후속 처리 명령입니다. 현재는 `agent-bridge.sh` 기반 협업 검증을 권장합니다.

```bash
/ai-code-review
```

**워크플로우**:
1. pending 리뷰 읽기
2. Critical/High 이슈 분석
3. 코드 수정 실행
4. 평가 기록 + history 이동

---

### /lint-smoke

빠른 코드 품질 검증.

```bash
/lint-smoke
```

**실행 내용**:
```bash
npm run lint
npm run type-check
npm run test:quick
```

---

### /security-audit-workflow

보안 취약점 검사.

```bash
/security-audit-workflow
```

**검사 항목**:
- OWASP Top 10
- RLS 정책
- API 키 노출
- XSS/SQL Injection

---

### /commit-push-pr

커밋부터 PR까지 원스톱.

```bash
/commit-push-pr
```

**워크플로우**:
1. 변경사항 커밋
2. 원격 브랜치 푸시
3. PR 생성 (gh CLI)

---

### /cloud-run-deploy

AI Engine Cloud Run 배포.

```bash
/cloud-run-deploy
```

**워크플로우**:
1. Docker 빌드
2. GCR 푸시
3. Cloud Run 배포
4. 헬스체크

---

## Skill 파일 구조

```
.claude/skills/
├── commit-commands/
│   └── skill.md
├── ai-code-review/
│   └── skill.md
├── lint-smoke/
│   └── skill.md
└── ...
```

### skill.md 형식

```markdown
---
name: skill-name
version: v1.0.0
description: 스킬 설명
---

# Skill Title

## Trigger Keywords
- "/skill-name"
- "트리거 키워드"

## Workflow
### Phase 1: ...
### Phase 2: ...
```

## 커스텀 Skill 만들기

### 1. 디렉토리 생성

```bash
mkdir -p .claude/skills/my-skill
```

### 2. skill.md 작성

```markdown
---
name: my-skill
version: v1.0.0
description: 나만의 스킬
---

# My Custom Skill

## Trigger Keywords
- "/my-skill"

## Workflow

### Phase 1: 준비
\`\`\`bash
echo "Starting..."
\`\`\`

### Phase 2: 실행
실행할 작업 설명...
```

### 3. 사용

```bash
/my-skill
```

## Best Practices

### DO

```bash
# 작업 전 검증
/lint-smoke

# 커밋 후 수동 협업 검증
/commit
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "변경분 리뷰해줘"

# Gemini 보조 검증
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "대안/리스크 검증"
```

### DON'T

```bash
# 리뷰 없이 푸시
git push  # ❌

# 보안 검사 생략
/commit-push-pr  # 중요 변경 시 보안 검사 먼저
```

## 트러블슈팅

### Skill 인식 안 됨

```
증상: "/skill-name" 실행 안 됨
해결:
1. .claude/skills/ 경로 확인
2. skill.md 문법 확인
3. Claude 재시작
```

### Skill 실행 중단

```
증상: 워크플로우 중간에 멈춤
해결:
1. 에러 메시지 확인
2. 필요한 권한 추가
3. 수동으로 단계 실행
```

## 관련 문서

- [Claude Code](./claude-code.md)
- [워크플로우](./workflows.md)
- [MCP 서버](./mcp-servers.md)
