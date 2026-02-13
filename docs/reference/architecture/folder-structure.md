# Folder Structure (Current v8)

> Last verified against code: 2026-02-13
> Status: Active Canonical
> Doc type: Reference

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
├── data/               # bundled/mock/otel data
└── types/              # shared TypeScript types
```

## API Layer

```text
src/app/api/
├── ai/
├── servers/
├── metrics/
├── monitoring/
├── debug/
└── ... (총 48 route.ts/route.tsx)
```

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

## Documentation (`docs/`)

```text
docs/
├── README.md
├── development/
├── vibe-coding/
├── guides/
├── reference/
├── troubleshooting/
├── analysis/     # Historical 성격 문서
└── reviews/      # Historical 성격 문서
```

## Notes

- 실제 코드 구조와 불일치 시, 코드 트리가 우선입니다.
- 문서 정책 SSOT는 `AGENTS.md`입니다.
