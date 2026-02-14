# 개발 워크플로우

> 실전 Vibe Coding 워크플로우 가이드
> Owner: dev-experience
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/vibe-coding/workflows.md
> Tags: vibe-coding,workflow,development

## 일일 개발 사이클

```
┌──────────────────────────────────────────────────────────┐
│                    Daily Workflow                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ① 시작        ② 개발        ③ 검증        ④ 커밋       │
│  ─────────    ─────────    ─────────    ─────────       │
│  git pull     3-CLI        /lint-smoke  /commit         │
│  브리지 점검    협업 개발     테스트 확인   수동 검증 반영  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 워크플로우 상세

### 1. 하루 시작

```bash
# 최신 코드 받기
git pull origin main

# 브리지 스크립트 상태 점검
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "어제 변경분 핵심 이슈만 요약"
```

### 2. 기능 개발

```bash
# Claude Code 실행
claude

# 요구사항 전달 (구체적으로)
You: "서버 상태 API에 캐싱 추가해줘.
     Redis 대신 인메모리 캐시 사용하고,
     TTL은 30초로 설정해줘"

# Claude가 계획 수립 후 구현
Claude: [Plan 에이전트로 설계]
        [코드 수정]
        [테스트 제안]
```

### 3. 중간 검증

```bash
# 린트 + 타입 + 테스트
/lint-smoke

# 문제 있으면 수정
You: "lint 에러 수정해줘"
```

### 4. 커밋

```bash
# 커밋
/commit

# 필요 시 보조 검증 요청
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "이번 커밋의 리스크 점검"
```

### 5. PR (필요시)

```bash
# 원스톱 PR
/commit-push-pr

# 또는 수동
git push origin feature/my-feature
gh pr create
```

---

## 기능 개발 워크플로우

### 작은 기능 (1-2시간)

```
You: "useServerStatus 훅에 에러 재시도 로직 추가해줘"
     ↓
Claude: [코드 분석] → [구현] → [테스트 제안]
     ↓
You: /lint-smoke
     ↓
You: /commit
     ↓
Done ✅
```

### 중간 기능 (반나절)

```
You: "대시보드에 실시간 메트릭 차트 추가해줘"
     ↓
Claude: [Plan 모드로 설계]
        - 컴포넌트 구조
        - 데이터 흐름
        - API 연동
     ↓
You: "계획 승인, 진행해줘"
     ↓
Claude: [단계별 구현]
        Step 1: 차트 컴포넌트
        Step 2: 훅 작성
        Step 3: API 연동
     ↓
You: /lint-smoke (각 단계마다)
     ↓
You: /commit (각 단계마다)
     ↓
Done ✅
```

### 큰 기능 (며칠)

```
Day 1:
  - 요구사항 정리
  - 아키텍처 설계 (sequential-thinking)
  - 기본 구조 커밋

Day 2-3:
  - 핵심 기능 구현
  - 각 단계별 커밋
  - 중간 리뷰 확인

Day 4:
  - 통합 테스트
  - 리팩토링
  - PR 생성
```

---

## 버그 수정 워크플로우

```
1. 버그 재현
   You: "콘솔에 404 에러가 나타나는데 확인해줘"

2. 원인 분석
   Claude: [Explore 에이전트로 탐색]
           [serena로 관련 코드 검색]
           "원인: API 응답 구조 불일치"

3. 수정
   Claude: [코드 수정]
           [테스트 추가]

4. 검증
   You: /lint-smoke
        npm run test -- affected-test

5. 커밋
   You: /commit -m "fix(api): handle 404 gracefully"
```

---

## 리팩토링 워크플로우

```
1. 범위 정의
   You: "MetricsProvider를 더 작은 모듈로 분리하고 싶어"

2. 분석
   Claude: [sequential-thinking으로 분석]
           현재: 1개 파일, 500줄
           제안: 3개 모듈로 분리
           - MetricsCache
           - MetricsFetcher
           - MetricsAggregator

3. 승인
   You: "좋아, 진행해줘"

4. 단계별 실행
   Claude: Step 1: MetricsCache 분리
   You: /commit

   Claude: Step 2: MetricsFetcher 분리
   You: /commit

   Claude: Step 3: MetricsAggregator 분리
   You: /commit

5. 검증
   You: npm run test
        npm run build
```

---

## 협업 검증 워크플로우

### 요청 실행

```bash
# Codex 리뷰 요청
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "현재 변경분 리뷰해줘"
```

### 보조 검증

```bash
# Gemini 대안/리스크 검증
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "대안 2가지를 비교해줘"
```

### 반영/정리

```bash
# 반영 후 커밋
/commit
```

---

## 배포 워크플로우

### Vercel (Frontend)

```bash
# 자동 배포 (git push)
git push origin main
# → Pre-push Hook: TypeScript 검증 + 빠른 테스트 (~78초)
# → Vercel이 Full Build + 배포

# 긴급 시 Hook 우회
HUSKY=0 git push origin main

# 상태 확인
mcp__vercel__list_deployments()
```

### Cloud Run (AI Engine)

```bash
# 스킬로 배포
/cloud-run-deploy

# 또는 수동
cd cloud-run/ai-engine
./deploy.sh

# 헬스체크
curl https://ai-engine-xxx.run.app/health
```

---

## 긴급 핫픽스 워크플로우

```
1. 이슈 확인
   - 프로덕션 에러 로그 확인
   - 영향 범위 파악

2. 빠른 수정
   You: "프로덕션 긴급 이슈야.
        API 타임아웃을 10초에서 30초로 늘려줘"

3. 최소 검증
   /lint-smoke

4. 즉시 배포
   git commit -m "hotfix: increase API timeout to 30s"
   git push origin main

5. 모니터링
   - Vercel 로그 확인
   - 에러 감소 확인
```

---

## 팁 & 트릭

### 컨텍스트 관리

```bash
# 대화가 길어지면
/compact

# 새 작업 시작 시
/clear
```

### 병렬 작업

```bash
# 여러 검증 동시 실행
You: "lint와 type-check 동시에 실행해줘"
```

### 히스토리 활용

```bash
# 이전 대화 참조
You: "아까 만든 훅에 캐싱 추가해줘"
```

## 관련 문서

- [Claude Code](./claude-code.md)
- [Skills](./skills.md)
- [AI 도구들](./multi-agent-tools.md)
- [Git Hooks 워크플로우](../development/git-hooks-workflow.md) - Pre-commit/Pre-push 상세
