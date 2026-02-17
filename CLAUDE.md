# CLAUDE.md - OpenManager AI v8.0.0

**한국어 우선, 기술용어 영어 허용** | 정책 SSOT: `AGENTS.md` (충돌 시 우선)

## 프로젝트 개요
**OpenManager AI** - AI Native Server Monitoring Platform
- **Stack**: Next.js 16.1.3, React 19.2, TypeScript 5.9, Supabase, Vercel AI SDK v6
- **Architecture**: Vercel (Frontend) + Cloud Run (AI Engine)
- **Data SSOT**: `public/data/otel-data/` (데이터) + `src/data/otel-data/index.ts` (로더)

## Quick Commands
```bash
npm run dev:network         # 개발 서버 (0.0.0.0:3000)
npm run validate:all        # TypeScript + Lint + Test
npm run test:quick          # 최소 테스트
npm run type-check          # TypeScript 검사
```

## 핵심 진입점

| 용도 | 파일 |
|------|------|
| AI Supervisor | `src/app/api/ai/supervisor/route.ts` |
| 메트릭 SSOT | `src/services/metrics/MetricsProvider.ts` |
| 데이터 원본 | `public/data/otel-data/hourly/hour-XX.json` (24개, OTel) |
| AI Engine | `cloud-run/ai-engine/src/server.ts` |
| AI 훅 | `src/hooks/ai/useAIChatCore.ts` |
| 규칙 SSOT | `src/config/rules/system-rules.json` |

## Rules (자동 로드)
`.claude/rules/` — `architecture.md` | `code-style.md` | `ai-tools.md` | `testing.md` | `deployment.md` | `env-sync.md`

## 참조
- **상태**: `docs/status.md` | **TODO**: `reports/planning/TODO.md`
- **문서**: `docs/` (71개) | **AI 설정**: `config/ai/registry-core.yaml`
- **Production**: `https://openmanager-ai.vercel.app`

_Last Updated: 2026-02-17_
