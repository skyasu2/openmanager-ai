---
name: commit-commands
description: Create a git commit with conventional commit message. Triggers on /commit.
version: v3.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit
---

# Git Commit

커밋을 생성합니다.

## Trigger Keywords

- "/commit"
- "커밋해줘"
- "변경사항 커밋"

## Workflow

### 1. Staged Changes Check

```bash
# Check for staged changes
git diff --cached --stat
```

If no staged changes, prompt user to stage files first.

### 2. Generate Commit Message

Analyze staged changes and generate a conventional commit message:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code refactoring
- `docs:` documentation
- `chore:` maintenance

### 3. Create Commit

```bash
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 4. AI Code Review (Automatic)

After successful commit, run AI review using modular scripts:

```bash
# 1. Get review engine (default: claude)
REVIEW_ENGINE=$(bash .claude/skills/commit-commands/scripts/rotate-ai-reviewer.sh)

# 2. Run review based on engine
DIFF=$(git diff HEAD~1 | head -300)
PROMPT="커밋: $(git log -1 --oneline)
변경 파일: $(git diff HEAD~1 --name-only | wc -l)개

다음 변경사항을 리뷰해주세요:
1. 코드 품질 점수 (1-10)
2. 보안 이슈
3. 개선사항
4. 결론: 승인/거부

$DIFF"

# Claude Code 기본 리뷰
claude -p "$PROMPT" 2>&1 | head -100

# 3. Save review result
bash .claude/skills/commit-commands/scripts/save-review-result.sh "$REVIEW_ENGINE"
```

### 5. Summary

Display:
- Commit hash and message
- AI review score and verdict
- Any critical issues found

## Output Format

```
✅ 커밋 완료: abc1234 feat: add new feature

🤖 AI 리뷰 (Claude):
- 점수: 8/10
- 보안: 이슈 없음
- 결론: 승인

💡 개선 제안:
- (있으면 표시)
```

## Notes

- AI 리뷰는 백그라운드가 아닌 실시간으로 실행됩니다
- 기본값은 Claude Code가 리뷰합니다 (`REVIEW_MODE=codex-gemini`으로 Codex/Gemini 순환 사용 가능)
- 리뷰 결과는 `reports/ai-review/` 디렉토리에 저장됩니다
