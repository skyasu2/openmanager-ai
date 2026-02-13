# 개발용 AI 도구

> Last verified against code: 2026-02-13
> 공통 정책 SSOT: `AGENTS.md`

개발 시 사용하는 AI 도구 및 방법론

## 디렉토리 구조

```
docs/guides/ai/
├── common/                # 공통/Multi-AI
│   └── ai-standards.md    # 코딩 규칙 통합
└── README.md              # 이 파일
```

> **참고**: Claude Code 상세 가이드는 `.claude/rules/ai-tools.md` 참조

## 도구별 가이드

| 도구 | 역할 | 가이드 |
|------|------|--------|
| Claude Code | Lead + MCP + 스킬 | [.claude/rules/ai-tools.md](../../../.claude/rules/ai-tools.md) |
| Codex | 개발/개선 + 검증 | [ai-standards.md](./common/ai-standards.md) |
| Gemini | 아키텍처/검증 | [ai-standards.md](./common/ai-standards.md) |

## 빠른 참조

```bash
# Claude Code 스킬
/review                   # 리뷰 결과 확인 (선택)
Skill ai-code-review      # 리뷰 분석 + 개선 실행 (선택)

# CLI 도구
codex exec "기능 구현 또는 리팩토링"
gemini "아키텍처 검토"
```

---

**관련**: [AI Architecture](../../reference/architecture/ai/) | [AI Registry](../../../config/ai/registry-core.yaml)
