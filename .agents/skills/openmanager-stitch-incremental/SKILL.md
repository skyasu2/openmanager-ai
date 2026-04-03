---
name: openmanager-stitch-incremental
description: Use Stitch for incremental UI improvement and rapid prototyping on an already implemented OpenManager frontend. Trigger when the user asks to improve/add UI while preserving existing component boundaries, data flow, API contracts, and state architecture (TanStack Query + Zustand).
version: v1.0.0
user-invocable: true
---

# OpenManager Stitch Incremental

Use Stitch as a design accelerator, not as a full UI replacement.

## Execute this workflow

1. Confirm scope as component-level change only (1-2 components).
2. Read `references/workflow.md` and follow the step-by-step process.
3. Read `references/prompts.md` and adapt one prompt template.
4. Keep current architecture intact.
   - Preserve component boundaries.
   - Preserve API and data-fetching flow.
   - Preserve state model (TanStack Query + Zustand).
5. Apply generated ideas manually into existing code.
6. Run validations:
   - `npm run stitch:check`
   - `npm run type-check`
   - `npm run lint`
7. Update registry when Stitch was used:
   - `config/ai/stitch-project-registry.json`

## Non-goals

- Do not replace entire pages with Stitch output.
- Do not re-architect state/data layers for UI styling changes.
- Do not treat legacy Stitch projects as implementation source of truth.

## Project references

- `docs/development/stitch-guide.md`
- `config/ai/stitch-improvement-prompt-template.md`
- `scripts/stitch/validate-stitch-registry.js`
