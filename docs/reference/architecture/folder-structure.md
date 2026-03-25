# Folder Structure (Current v8)

> 코드베이스 현재 폴더 구조와 책임 범위를 정리한 레퍼런스
> Owner: platform-architecture
> Last verified against code: 2026-03-03
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-03-25
> Canonical: docs/reference/architecture/folder-structure.md
> Tags: architecture,folder-structure,reference

## Root

```text
openmanager-ai/
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── docs/
├── src/
├── tests/
├── cloud-run/
├── scripts/
├── supabase/
├── config/
├── package.json
├── tsconfig.json
└── next.config.mjs
```

## Application (`src/`)

```text
src/
├── app/                # Next.js App Router pages and route handlers
├── components/         # UI components
├── hooks/              # custom hooks
├── stores/             # Zustand stores
├── services/           # domain/application services
├── lib/                # shared utilities and infra helpers
├── schemas/            # Zod schemas
├── config/             # runtime config and rules loader
├── data/               # OTel data loaders and data modules
└── types/              # shared TypeScript types
```

## API Layer

```text
src/app/api/
├── admin/
├── ai/
├── auth/
├── servers/
├── metrics/
├── monitoring/
├── security/
└── ... (총 29 route.ts)
```

> Source of truth (2026-03-03): `src/app/api/**/route.ts` (29).

상세 엔드포인트 목록은 [API Endpoints](../api/endpoints.md)를 참고합니다.

## AI Engine (`cloud-run/ai-engine`)

```text
cloud-run/ai-engine/
├── src/
│   ├── server.ts
│   ├── routes/
│   ├── services/
│   │   └── ai-sdk/
│   ├── tools-ai-sdk/
│   ├── middleware/
│   ├── config/
│   └── data/
├── package.json
└── tsconfig.json
```

> Source of truth (2026-03-03): `cloud-run/ai-engine/src/server.ts` `app.route('/api/...')` (API mounts 9), `cloud-run/ai-engine/src/routes/*.ts` (route modules 10).

## Documentation (`docs/`)

```text
docs/
├── README.md
├── development/
│   └── vibe-coding/
├── guides/
├── reference/
├── troubleshooting/
├── analysis/     # Historical 성격 문서
└── reviews/      # Historical 성격 문서
```

## Notes

- 실제 코드 구조와 불일치 시, 코드 트리가 우선입니다.
- 공통 AI 정책 SSOT는 `docs/guides/ai/ai-standards.md`이며, `AGENTS.md`는 Codex 실행 규칙을 다룹니다.
