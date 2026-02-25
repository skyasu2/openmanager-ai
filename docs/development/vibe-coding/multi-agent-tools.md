# AI 도구 가이드

> 멀티 AI 활용으로 코드 품질 향상
> Owner: dev-experience
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/development/vibe-coding/multi-agent-tools.md
> Tags: vibe-coding,ai-tools,workflow

## AI 도구 생태계

```
┌─────────────────────────────────────────────────────────┐
│                    AI 도구 구성                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │     Claude Code + Codex + Gemini 협업 개발       │   │
│  │  구현/개선 + 검증 + 대안 탐색                     │   │
│  └─────────────────────────────────────────────────┘   │
│                          ↓                              │
│  ┌────────────────┐  ┌────────────────┐               │
│  │     Codex      │  │     Gemini     │               │
│  │ (개발/개선)     │  │ (검증/대안)     │               │
│  │   협업 실행      │  │   협업 실행      │               │
│  └────────────────┘  └────────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Claude Code

### 역할
- **협업 개발 AI**: 코드 작성, 수정, 리팩토링
- **대화형 인터페이스**: 자연어로 요청
- **도구 통합**: MCP, Skills, Subagents

### 사용법

```bash
# 기본 실행
claude

# 모델 선택
claude --model opus    # 복잡한 작업
claude --model sonnet  # 일반 작업 (기본)
claude --model haiku   # 빠른 작업
```

### 강점
- 긴 컨텍스트 (200k 토큰)
- 정밀한 코드 수정
- 멀티스텝 추론

## Codex (OpenAI)

### 역할
- **개발/개선 + 리뷰**: 구현과 품질 검토를 함께 수행
- **보안 취약점 탐지**
- **베스트 프랙티스 검증**

### 실행 방식

```bash
# 브리지 스크립트 협업 실행
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "현재 변경분 리뷰해줘"
```

### 리뷰 항목
- 버그 가능성
- 보안 취약점
- 성능 이슈
- 코드 스타일

## Gemini (Google)

### 역할
- **로직 검증**: 비즈니스 로직 정확성
- **아키텍처 분석**
- **대안 제시**

### 실행 방식

```bash
# 브리지 스크립트 협업 실행
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "이 알고리즘 검증해줘"
```

### 리뷰 항목
- 로직 정확성
- 엣지 케이스
- 테스트 커버리지

## 협업 검증 정책

### 기본 원칙

```
기본 운영: 3 AI 도구 협업 개발
추적/집계가 필요하면 Codex 결과를 기준으로 사용 가능
Gemini 검증 결과는 보조 판단 자료로 활용
```

### 협업 로그 저장

```
logs/ai-bridge/
├── bridge.log         # 호출 이력
└── notes/             # --save-auto 사용 시 결과 저장
```

### 대화/리뷰 요청

```bash
# Codex 리뷰 요청
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "현재 변경분 리뷰해줘"

# Gemini 검증 요청
bash scripts/ai/agent-bridge.sh --to gemini --mode analysis --save-auto "리스크를 점검해줘"
```

## AI 선택 가이드

| 작업 | 추천 AI | 이유 |
|------|---------|------|
| 코드 작성 | Claude/Codex | 정밀 수정 + 구현 속도 |
| 코드 리뷰 | Codex/Gemini | 구현 품질 + 검증 균형 |
| 보안 검토 | Codex | OWASP 전문 |
| 로직 검증 | Gemini | 추론 능력 |
| 문서 작성 | Claude/Codex | 자연어 생성 + 구조화 |

## 제거된 도구

### Qwen (제거: 2026-01-07)

```
제거 이유:
- 평균 응답: 201초
- 실패율: 13.3%
- 비용 대비 효율 낮음
```

## Best Practices

### DO

```bash
# 작은 단위 리뷰
git commit -m "feat: add single feature"

# 명확한 커밋 메시지
git commit -m "fix(api): handle 404 gracefully"

# 브리지로 검증 요청
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "커밋 검증"
```

### DON'T

```bash
# 대량 변경 커밋
git commit -m "update everything"

# 리뷰 무시
# (Critical 이슈 방치)

# AI 맹신
# (보안 관련 수동 검토 필수)
```

## 트러블슈팅

### Codex 타임아웃

```
증상: 리뷰가 5분 이상 소요
해결:
1. 커밋 크기 줄이기
2. .codexignore로 제외 파일 설정
```

### Gemini API 에러

```
증상: 429 Too Many Requests
해결:
1. 잠시 대기 (1분)
2. API 쿼터 확인
```

### 리뷰 누락

```
증상: 요청 결과 로그가 남지 않음
해결:
1. `scripts/ai/agent-bridge.sh` 실행 로그 확인
2. API 키 유효성 확인
```

## 관련 문서

- [Claude Code](./claude-code.md)
- [MCP 서버](./mcp-servers.md)
- [워크플로우](./workflows.md)
