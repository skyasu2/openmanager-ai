# OpenManager AI

> **AI-Native Server Monitoring Platform**
> 자연어로 대화하며 서버를 모니터링하는 차세대 운영 플랫폼

[![Version](https://img.shields.io/badge/version-8.11.0-blue.svg?style=for-the-badge)](https://openmanager-ai.vercel.app)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://openmanager-ai.vercel.app)
[![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=for-the-badge)](LICENSE)

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript_5-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=flat-square&logo=supabase&logoColor=3ECF8E)
![Google Cloud](https://img.shields.io/badge/Cloud_Run-4285F4?style=flat-square&logo=google-cloud&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

---

## What is this?

OpenManager AI는 서버 모니터링의 패러다임을 **"차트 해석"에서 "질문과 답변"으로** 바꾸는 AI 기반 플랫폼입니다.

이 공개 저장소는 **Vercel에 배포되는 Next.js 프론트엔드와 공개 데이터 스냅샷**만 공유합니다. 운영자는 CPU/메모리 그래프를 직접 읽는 대신, 자연어로 질문합니다:

```
"서버 상태 어때?"           → 전체 헬스 요약
"왜 web-01이 느려졌어?"     → 이상 탐지 + 원인 분석
"장애 보고서 만들어줘"      → 마크다운 리포트 자동 생성
"CPU 80% 넘는 서버 있어?"  → 메트릭 쿼리 + 필터
```

**🔗 Live Demo**: [openmanager-ai.vercel.app](https://openmanager-ai.vercel.app)

> **Public snapshot note**
> 이 저장소는 브라우저에서 확인 가능한 UI 코드, 공개용 정적 데이터, 최소 실행 설정만 포함합니다.
> Private Cloud Run AI runtime, 내부 QA 원본, CI 운영 자산, 내부 유지보수 스크립트는 canonical GitLab 저장소에만 유지됩니다.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **AI Workspace UI** | 자연어 질의, 스트리밍 상태, agent handoff UI 제공 |
| **Real-time Dashboard** | 서버 카드, 시계열 차트, 경보/상태 요약 |
| **Validation Evidence** | 배포 검증 근거를 `/validation` 화면과 public JSON으로 공개 |
| **Precomputed OTel Data** | 공개 데모와 fallback 경로에 쓰이는 모니터링 샘플 데이터 포함 |
| **Production Shell** | Vercel production에서 동작하는 frontend shell과 API proxy 포함 |

---

## Architecture

```
User (Natural Language Query)
    │
    ▼
┌─────────────────────────────┐
│  Vercel / Next.js 16        │  ← UI, SSR, Edge API Routes
│  React 19 + Tailwind CSS    │
└──────────────┬──────────────┘
               │ API / Streaming Proxy
               ▼
┌─────────────────────────────┐
│  Private AI Runtime         │  ← not included in this public repo
│  Cloud Run + agent backend  │
│  model orchestration        │
└──────┬────────────┬─────────┘
       │            │
       ▼            ▼
┌──────────┐  ┌───────────────┐
│ Supabase │  │ Upstash Redis │
│ pgvector │  │ Stream Cache  │
└──────────┘  └───────────────┘
```

이 저장소는 frontend shell과 공개 데이터만 제공하므로, AI backend 내부 구현과 모델 구성은 설명 대상에서 제외합니다. 공개 범위에서 중요한 점은 다음 두 가지입니다.

- dashboard, validation, public data 경로는 이 저장소만으로 확인 가능
- 실제 AI 응답 생성과 agent orchestration은 private runtime 의존

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.1, React 19.2, TypeScript 5.9 |
| **Styling** | Tailwind CSS, shadcn/ui, Radix UI |
| **State** | Zustand, TanStack Query |
| **Frontend AI Integration** | Vercel AI SDK v6 client and streaming UI |
| **Backend Dependencies** | Supabase, Upstash Redis, private AI runtime |
| **Deployment** | Vercel production frontend + external private services |
| **Monitoring Data** | Precomputed OTel metrics shipped under `public/data/otel-data/` |

---

## What Is Included

- `src/`: App Router pages, API proxy routes, dashboard and AI workspace UI
- `public/data/otel-data/`: 공개 데모와 fallback 검증에 쓰이는 precomputed monitoring data
- `public/data/qa/validation-evidence.json`: 공개 검증 요약 snapshot
- `.env.example`: 로컬 실행용 환경변수 템플릿
- `package.json`: public snapshot에서 안전한 최소 scripts만 유지

## What Is Not Included

- Private Cloud Run AI runtime source
- Internal QA run records and CI operational assets
- Internal maintenance scripts, test harnesses, and component-only notes
- Secrets and production-only environment configuration

---

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
npm run build
npm run type-check
npm run lint
```

기본 UI, 대시보드, validation 화면은 공개 데이터와 fallback 경로로 확인할 수 있습니다. AI chat과 production-equivalent backend 동작은 private runtime과 유효한 secrets가 있어야 합니다.

---

## Validation Evidence

- Validation page: [openmanager-ai.vercel.app/validation](https://openmanager-ai.vercel.app/validation)
- Public QA snapshot JSON: [validation-evidence.json](https://openmanager-ai.vercel.app/data/qa/validation-evidence.json)
- Live app: [openmanager-ai.vercel.app](https://openmanager-ai.vercel.app)

이 저장소는 "스크린샷만 있는 데모"가 아니라, 공개 가능한 범위 안에서 실제 배포 검증 근거를 같이 보여주는 포트폴리오 snapshot입니다.

---

## Known Limits

- 공개 저장소만으로 private AI backend 전체를 재현할 수는 없습니다
- 일부 API route는 production에서 external runtime 의존성을 전제로 합니다
- public snapshot은 canonical 개발 저장소가 아니라 읽기/분석용 배포 코드 snapshot입니다

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <a href="https://openmanager-ai.vercel.app"><strong>🚀 Live Demo</strong></a>
  &nbsp;·&nbsp;
  <sub>Public Snapshot · v8.11.0</sub>
</div>
