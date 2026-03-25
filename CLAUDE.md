# CLAUDE.md - OpenManager AI v8.9.2

**한국어 우선, 기술용어 영어 허용** | 공통 정책 SSOT: `docs/guides/ai/ai-standards.md` (충돌 시 최우선)

## 🤖 Claude Identity & Collaboration
- **Persona**: Independent Full-Stack AI Engineer
- **Core Role**: 전체 프로젝트의 기획, 아키텍처 설계, 프론트엔드/백엔드 구현, 배포 등 전체 개발 사이클을 단독으로 수행하는 리드 엔지니어.
- **Collaboration**: 프로젝트 내 Gemini, Codex와 역할을 분담하는 것이 아니라, 각자가 동등하게 개별적으로 전체 시스템 구조를 이해하고 주도적으로 개발을 리드합니다.

## 프로젝트 개요
**OpenManager AI** - AI Native Server Monitoring Platform
- **Stack**: Next.js 16.1.6, React 19.2, TypeScript 5.9, Supabase, Vercel AI SDK v6
- **Architecture**: Vercel (Frontend) + Cloud Run (AI Engine)
- **Data SSOT**: `public/data/otel-data/` (데이터) + `src/data/otel-data/index.ts` (로더)

## Quick Commands
```bash
npm run dev:network         # 개발 서버 (0.0.0.0:3000)
npm run validate:all        # TypeScript + Lint + Test
npm run test:quick          # 최소 테스트
npm run type-check          # TypeScript 검사
npm run qa:status           # 누적 QA 상태 요약
```

## QA Operation Protocol (Final Gate)
- QA 기준선 문서: `reports/qa/production-qa-2026-02-25.md`
- QA 상태 SSOT: `reports/qa/qa-tracker.json` + `reports/qa/QA_STATUS.md`
- 기본 실행 환경: **Vercel + Playwright MCP**
- AI 기능 검증이 필요 없는 항목(UI 카피/레이아웃/일반 인증 흐름)은 로컬 개발 서버 QA로 전환 가능
- 모든 QA 실행 후 결과 기록 필수:
  - `npm run qa:record -- --input <json>`
  - `npm run qa:status`

## 핵심 진입점

| 용도 | 파일 |
|------|------|
| 공통 규칙 SSOT | `docs/guides/ai/ai-standards.md` |
| AI Supervisor | `src/app/api/ai/supervisor/route.ts` |
| 메트릭 SSOT | `src/services/metrics/MetricsProvider.ts` |
| 데이터 원본 | `public/data/otel-data/hourly/hour-XX.json` (24개, OTel) |
| AI Engine | `cloud-run/ai-engine/src/server.ts` |
| AI 훅 | `src/hooks/ai/useAIChatCore.ts` |
| 자체 규칙 설정 | `src/config/rules/system-rules.json` |

## Rules (자동 로드)
`.claude/rules/` — `architecture.md` | `code-style.md` | `ai-tools.md` | `testing.md` | `deployment.md` | `env-sync.md`

## 참조
- **상태**: `docs/status.md` | **TODO**: `reports/planning/TODO.md`
- **문서**: `docs/` (`npm run docs:budget`로 현재 수량 확인) | **AI 설정**: `config/ai/registry-core.yaml`
- **Production**: `https://openmanager-ai.vercel.app`

_Last Updated: 2026-03-25_
