# Doc Budget Policy Reference

## Budget Table

| Scope | Limit | Notes |
|-------|:-----:|-------|
| Total active (excl. archived) | 60 | Hard limit |
| reference/architecture/* | 22 | Only `docs/reference/architecture/**` |
| development/* | 22 | Dev guides + Vibe Coding docs (`development/vibe-coding/**`) |
| guides/* | 10 | Standards, testing, AI |
| troubleshooting/* | 5 | Issue resolution |
| root (docs/) | 5 | README, QUICK-START |

## Diataxis Classification (Required)

- **Tutorial**: Learning by doing (QUICK-START, full-setup-guide)
- **How-to**: Problem-solving recipes (docker, git-hooks)
- **Reference**: Information lookup (endpoints, architecture)
- **Explanation**: Understanding context (coding-standards, test-strategy)

## Rules

1. **Merge > New**: Always check if content fits existing doc
2. **Metadata rollout**:
   - Hard gate for newly created/modified docs: Owner, Status, Doc type, Last reviewed
   - Legacy alias accepted: Last verified -> Last reviewed
   - Recommended fields: Canonical, Tags
   - Warn-only backlog for unchanged legacy docs
3. **README link required**: Unlinked docs are invalid
4. **90-day stale rule**: Unmodified docs move to archived/
5. **No analysis docs in active**: Completed analyses go to archived/

## Source of Truth

- Policy: `.claude/rules/documentation.md`
- Management guide: `docs/development/documentation-management.md`
