# GitHub Workflow Reference

> Owner: platform-devops
> Status: Historical reference
> Doc type: Reference
> Last reviewed: 2026-05-08
> Canonical: .github/README.md
> Tags: github-actions,legacy,public-snapshot

This directory is retained in the private canonical workspace as historical
reference only.

- Canonical development, validation, release, and deploy authority lives in
  GitLab (`gitlab`) and GitLab CI.
- The public GitHub snapshot is frontend-only and excludes `.github/`, `docs/`,
  `tests/`, `scripts/`, `reports/`, `cloud-run/`, and internal agent config.
- Do not treat these workflows as active delivery gates unless a future plan
  explicitly reactivates GitHub Actions.
- Dependency automation is managed by `renovate.json` plus self-hosted Renovate
  against the canonical GitLab repository. `.github/dependabot.yml` is a legacy
  reference, not the current update path.

Use `npm run sync:github` for public snapshot refreshes. Do not push directly to
`origin` or `github-public` for deployment or validation.
