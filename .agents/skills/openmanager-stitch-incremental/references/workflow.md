# Workflow

## Use this skill when

- Frontend implementation already exists.
- User requests UI polish, UX refinement, or small UI additions.
- Stability is more important than visual rewrite.

## Procedure

1. Define target surface.
- Example: `src/components/dashboard/SystemOverviewSection.tsx` only.

2. Generate Stitch draft.
- Ask Stitch for layout/style ideas, not full replacement code.

3. Merge into existing implementation.
- Reuse existing components, hooks, and API routes.
- Keep current accessibility and interaction semantics.

4. Validate.
- `npm run stitch:check`
- `npm run type-check`
- `npm run lint`

5. Record usage.
- Note project ID and touched files in PR body.
- Update `config/ai/stitch-project-registry.json` if status/mapping changed.

## Decision rule

- If Stitch output conflicts with architecture: keep architecture, adapt visuals only.
