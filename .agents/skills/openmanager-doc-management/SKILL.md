---
name: openmanager-doc-management
description: Check documentation budget, detect duplicates, and suggest merges/archives. Use when creating or reviewing docs.
version: v1.0.0
user-invocable: true
---

# OpenManager Doc Management

Enforce Doc Budget Policy to prevent document sprawl.

## Execute this workflow

1. Scan active documents.
   - Preferred: `npm run docs:budget`
   - `find docs/ -name "*.md" -not -path "*/archived/*" | wc -l`
   - Compare against budget: **60 max total**
   - `find docs/ -name "*.md" -not -path "*/archived/*" | sed 's|docs/||' | cut -d'/' -f1 | sort | uniq -c | sort -rn`

2. Check per-directory budgets.
   - reference/architecture/*: 22 | development/*: 22 (includes vibe-coding/*) | guides/*: 10
   - troubleshooting/*: 5 | root: 5
   - Flag any directory over budget

3. Detect duplicate candidates.
   - Search similar filename prefixes:
     - `find docs -name "*.md" -not -path "*/archived/*" | xargs -n1 basename | sed 's/-[^-]*\\.md$//' | sort | uniq -c | sort -rn | head -20`
   - Search likely duplicate topic groups:
     - `find docs -name "*.md" -not -path "*/archived/*" | rg '(otel-|prometheus-|data-|architecture-|guide)'`
   - Prefer merge plan over creating a new file

4. Detect stale documents (90+ days without modification).
   - `find docs/ -name "*.md" -not -path "*/archived/*" -mtime +90`
   - Suggest moving to `docs/archived/`

5. Detect missing metadata with phased enforcement.
   - Required metadata (changed docs hard gate):
     - `Owner`
     - `Status`
     - `Doc type`
     - `Last reviewed` (legacy alias: `Last verified`)
   - Recommended metadata:
     - `Canonical` (`Status != Active Canonical`인 경우 권장)
     - `Tags`
   - Hard gate: newly created or modified docs in this task must include all required fields
   - Warning only: legacy unchanged docs can be reported as backlog
   - Suggested check:
     - `git diff --name-only -- docs | rg '\\.md$'`

6. Before creating any new document:
   - Search for existing docs covering the same topic
   - Prefer merging into existing doc over creating new file
   - If budget is full, archive or merge first

7. Output summary report.
   - Include machine-readable lines:
     - `PASS|WARN|FAIL <rule_id> file=<path> action_hint="<hint>"`

## Output format

```text
Doc Budget Report
- Total active: XX / 60
- Over-budget dirs: [none | list]
- Duplicate candidates: [none | list]
- Stale (90d+): [count] files
- Missing metadata (changed docs): [count] files
- Missing metadata (legacy backlog): [count] files
- Ready for new doc: yes|no

PASS DOC-BUDGET-001 file=docs action_hint="none"
WARN DOC-META-LEGACY-001 file=docs/... action_hint="Backlog metadata migration"
FAIL DOC-META-001 file=docs/... action_hint="Add Owner/Status/Doc type/Last reviewed"
```

## Related skills

- `$openmanager-git-workflow` - commit after doc changes
- `$openmanager-lint-smoke` - quality checks alongside doc checks

## References

- `.claude/rules/documentation.md`
- `references/doc-budget-policy.md`
