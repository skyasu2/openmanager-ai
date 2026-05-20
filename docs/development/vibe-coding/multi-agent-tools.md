# AI 도구 가이드

> 수동 교차 사용형 멀티 AI 운영으로 코드 품질 향상
> Owner: dev-experience
> Status: Active Supporting
> Doc type: How-to
> Last reviewed: 2026-05-05
> Canonical: docs/development/vibe-coding/multi-agent-tools.md
> Tags: vibe-coding,ai-tools,workflow

## 현재 운영 기준

공통 정책 SSOT는 [AI Standards](../../guides/ai/ai-standards.md)입니다. 이 문서는 실제 개발 중 Claude Code, Codex, Gemini CLI를 어떻게 골라 쓰는지 설명하는 도구 선택 가이드입니다.

- 세 도구는 모두 end-to-end 개발을 맡을 수 있는 독립형 풀스택 AI로 취급합니다.
- 현재 대화의 주 실행 도구가 작업을 끝까지 책임지고, 다른 AI는 필요할 때 검토/리서치/대안 비교에 사용합니다.
- Codex subagent는 사용자가 명시적으로 "서브 에이전트", "병렬 에이전트", "각 영역을 나눠 조사/구현"처럼 요청한 경우에만 제한적으로 사용합니다.
- 공통 skill은 `.agents/skills/`를 기준으로 두고, Claude/Gemini 전용 overlay는 각 도구 전용 경로에만 둡니다.

## AI 도구 생태계

```
┌─────────────────────────────────────────────────────────┐
│                    AI 도구 구성                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Claude Code  │  │    Codex     │  │    Gemini    │  │
│  │ (메인 개발)   │  │ (구현/정리)  │  │ (검증/리서치) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│   현재 세션의 주 실행 도구가 구현을 끝까지 책임지고,       │
│   필요할 때 다른 CLI로 검토와 대안 비교를 수행            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

각 도구의 역할·구독 플랜·위임 정책은 [AI Standards](../../guides/ai/ai-standards.md)를 참조합니다.

## 협업 검증 정책

### 기본 원칙

```
기본 운영: 현재 세션의 주 실행 도구가 작업을 끝까지 처리하고, Codex/Gemini/Claude를 수동 전환하며 교차 검증
자동 라우팅/자동 리뷰 트리거: 기본 비활성
추적/집계가 필요하면 Codex 결과 또는 현재 세션의 작업 로그를 기준으로 다른 AI 검토를 덧붙이는 방식 사용 가능
Gemini 검증 결과는 보조 판단 자료로 활용
```

### 현재 방식의 정확한 표현

- `현재 세션 주도 + 다른 CLI 수동 교차 검증`
- 또는 `수동 교차 검증형 Multi-CLI 운영`
- 자동 라우팅보다는 사용자가 필요할 때 각 CLI를 직접 전환해 구현, 검토, 리서치를 나눔

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
| 코드 작성 | 현재 세션의 주 실행 도구 | 컨텍스트 손실 없이 끝까지 처리 |
| 마무리·리팩토링 | Codex | bounded refactor, 테스트 보완, 배포 전 정리 |
| 코드 리뷰 | Claude/Codex/Gemini | 구현 품질 + 검증 균형 |
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

### Gemini CLI 응답 지연/무응답

```
증상: `gemini -p` 또는 help 호출이 오래 걸리거나 출력이 비어 보임
해결:
1. OAuth 로그인 상태 확인
2. 긴 타임아웃/재시도 wrapper 사용
3. 불안정할 때는 수동 실행으로 전환
```

### 리뷰 누락

```
증상: 요청 결과 로그가 남지 않음
해결:
1. `scripts/ai/agent-bridge.sh` 실행 로그 확인
2. Claude/Codex/Gemini 로그인 세션 또는 OAuth 상태 확인
3. CLI 자체 실행(`claude`, `codex`, `gemini`)이 독립적으로 동작하는지 확인
```

## 관련 문서

- [Claude Code](./claude-code.md)
- [MCP 서버](./mcp-servers.md)
- [워크플로우](./workflows.md)
