# CLAUDE.md - OpenManager AI v8.0.0

**한국어로 우선 대화, 기술용어는 영어 사용 허용**

## 프로젝트 개요
**OpenManager AI** - AI Native Server Monitoring Platform
- **Stack**: Next.js 16.1.3, React 19.2, TypeScript 5.9, Supabase, Vercel AI SDK v6
- **Architecture**: Vercel (Frontend/Edge) + Cloud Run (AI Engine)
- **AI Engine**: Multi-Agent Orchestrator (Cerebras primary, Groq NLQ, Mistral verifier)
- **Data**: OTel Standard Format, `src/data/hourly-data/` SSOT (24h Prometheus)
- **Codebase**: 701 TS/TSX files, 63 docs

## Quick Commands
```bash
npm run dev:network         # 개발 서버 (0.0.0.0:3000)
npm run validate:all        # TypeScript + Lint + Test
npm run test:quick          # 최소 테스트 (빠름)
npm run type-check          # TypeScript 검사
npm run release:patch       # 버전 릴리스
```

## 핵심 진입점

| 용도 | 파일 |
|------|------|
| AI Supervisor API | `src/app/api/ai/supervisor/route.ts` |
| 메트릭 SSOT | `src/services/metrics/MetricsProvider.ts` |
| 데이터 원본 | `src/data/hourly-data/hour-XX.json` (24개) |
| OTel 전처리 | `src/data/otel-processed/` |
| AI Engine | `cloud-run/ai-engine/src/server.ts` |
| AI 훅 | `src/hooks/ai/useAIChatCore.ts` |
| 상태 관리 | `src/stores/useAISidebarStore.ts` |
| 규칙 SSOT | `src/config/rules/system-rules.json` |

## Data Architecture (3-Tier)
```
src/data/hourly-data/*.json    ← PRIMARY (번들 포함, Prometheus format)
src/data/otel-processed/       ← 전처리된 OTel 메트릭
src/data/fixed-24h-metrics.ts  ← FALLBACK (hourly-data 불가 시)
```

## API Routes (주요)
```
/api/health          건강 체크
/api/servers/*       서버 데이터
/api/metrics/*       메트릭 조회
/api/ai/supervisor   AI 질의 (→ Cloud Run)
/api/ai/status       AI 상태
/api/dashboard/*     대시보드 데이터
/api/auth/*          인증
```

## Rules (자동 로드)
`.claude/rules/`에서 자동 로드:
- `code-style.md` - TypeScript strict, Biome lint, React/Next.js 규칙
- `architecture.md` - Hybrid Architecture, 디렉토리 구조
- `ai-tools.md` - MCP 9개, Skills 10개, Agent Teams 3팀
- `testing.md` - Vitest + Playwright, 커버리지 10%+
- `deployment.md` - Vercel Pro + Cloud Run Free Tier, **비용 가드레일**
- `env-sync.md` - 환경변수 동기화

## 참조
- **상태**: `docs/status.md`
- **문서**: `docs/` (63개 파일)
- **AI 설정**: `config/ai/registry-core.yaml`
- **TODO**: `reports/planning/TODO.md`
- **Production**: `https://openmanager-ai.vercel.app`

_Last Updated: 2026-02-12_
