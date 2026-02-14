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

### 4. Summary

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

- 커밋 후 리뷰가 필요하면 `/review` 명령을 별도로 사용하세요
