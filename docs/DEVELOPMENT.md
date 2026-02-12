# 개발 가이드

> **Note**: 이 문서는 새로운 구조로 재편성되었습니다.

## 📁 새 문서 위치

### 개발 환경 설정
→ **[docs/development/](./development/README.md)**

| 문서 | 설명 |
|------|------|
| [전체 환경 구축](./development/full-setup-guide.md) | WSL + Node.js + AI 도구 (필독) |
| [개발 도구](./development/dev-tools.md) | Node.js, npm, IDE |
| [프로젝트 설정](./development/project-setup.md) | 클론, 환경변수 |

### Vibe Coding (AI 도구)
→ **[docs/vibe-coding/](./vibe-coding/README.md)**

| 문서 | 설명 |
|------|------|
| [Claude Code](./vibe-coding/claude-code.md) | 메인 AI 도구 |
| [AI 도구들](./vibe-coding/ai-tools.md) | Codex, Gemini |
| [MCP 서버](./vibe-coding/mcp-servers.md) | 9개 MCP 서버 |
| [Skills](./vibe-coding/skills.md) | 11개 커스텀 스킬 |
| [워크플로우](./vibe-coding/workflows.md) | 개발 사이클 |

---

## 빠른 시작

```bash
# 1. WSL에서 클론
git clone https://github.com/skyasu2/openmanager-ai.git
cd openmanager-ai

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env.local

# 4. 개발 서버
npm run dev:network
```

자세한 내용은 [development/](./development/README.md)를 참조하세요.
