# Orphan UI Artifact Audit 2026-04-10

- Scope: `src/**/*.stories.*`, `src/**/*.test.*`, `src/**/*.spec.*`
- Audit command: `npm run artifacts:ui:audit`
- Audit result:
  - checked files: `289`
  - broken relative imports: `0`
  - manual-review stories: `1`

## Findings

### Safe deletions
- none

### Manual review
- `src/app/main/components/LandingPage.stories.tsx`
  - same-basename component file is absent
  - however the story composes live sibling components:
    - `DashboardSection.tsx`
    - `LoginPrompt.tsx`
    - `SystemStartSection.tsx`
  - `src/app/page.tsx` uses the same landing-page composition path, so this is not an orphan candidate by default

## Decision

- Do not delete UI test/story artifacts from this audit pass.
- Current evidence is insufficient for a destructive cleanup commit.
- Commit should wait until a tighter candidate set exists.

## Gap Closed

- Added deterministic local audit for UI artifact integrity:
  - `scripts/dev/audit-orphan-ui-artifacts.js`
  - `npm run artifacts:ui:audit`

## Remaining Gaps

- `knip` currently ignores `tests/**` and `scripts/**`, so it is not enough for repo-wide artifact cleanup.
- Script-level orphan analysis still needs a separate audit pass.
- Manual-only Storybook compositions should be reviewed with product ownership before deletion.
