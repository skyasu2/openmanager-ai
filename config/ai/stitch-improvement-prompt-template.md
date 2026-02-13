# Stitch Improvement Prompt Template

## Purpose
Improve an existing implemented UI without changing data flow, state model, or API contracts.

## Input Template

You are improving an existing production UI.

Constraints:
- Keep component boundaries unchanged.
- Do not introduce new data fetching layers.
- Preserve current state model (TanStack Query + Zustand).
- Keep accessibility semantics (button roles, heading hierarchy, focus-visible states).
- Return only incremental layout/style improvements.

Target component:
- file: `[component-file-path]`
- role: `[what-this-component-does]`

Current issues:
1. `[issue-1]`
2. `[issue-2]`

Requested improvements:
1. `[improvement-1]`
2. `[improvement-2]`

Output format:
1. Updated layout proposal
2. Style token suggestions
3. Interaction refinements
4. Non-goals (what should NOT be changed)
