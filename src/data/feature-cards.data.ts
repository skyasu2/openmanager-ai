/**
 * Feature Cards 데이터
 * 메인 페이지에 표시되는 4개의 주요 기능 카드 데이터
 * @updated 2026-05-05 - AI assistant taxonomy synced with deterministic-first runtime
 */

import { Bot, Database, Sparkles, Zap } from 'lucide-react';
import type { FeatureCard } from '@/types/feature-card.types';

export const FEATURE_CARDS_DATA: FeatureCard[] = [
  {
    id: 'ai-assistant',
    title: '💬 AI 어시스턴트',
    description:
      '현재 메트릭을 바탕으로 질문, 분석, 조치안과 다운로드 가능한 장애/이상감지 아티팩트를 연결하는 운영 어시스턴트입니다.',
    icon: Bot,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    detailedContent: {
      overview: `운영자가 메트릭 그래프를 직접 해석하지 않아도, 질문 하나로 현재 상태, 원인 분석, 다음 조치안을 받을 수 있도록 설계한 운영 의사결정 AI 어시스턴트입니다. 핵심 수치와 판정은 deterministic fact layer가 책임지고, LLM은 tool-calling과 설명·보고서·조치안 생성을 맡습니다. 4개의 AI Provider(Cerebras, Groq, Mistral, Gemini)를 fallback으로 사용하며, RCA/report/advisor/vision처럼 복잡한 요청만 5개 라우팅 에이전트로 escalation합니다. 경량 커스텀 TypeScript ML(통계 이상 탐지 + 추세 예측), Knowledge Retrieval Lite(BM25 RPC + metadata boost), 요청 기반 웹 검색을 분리해 무료 티어 사용량을 예측 가능하게 유지합니다.`,
      features: [
        '🧠 Cerebras Inference: 초고속 추론 인프라 (llama3.1-8b) — 짧은 컨텍스트 fallback 및 structured route 보조',
        '⚡ Groq Cloud: LPU 기반 초고속 500 Tokens/s 추론 (llama-4-scout-17b) — NLQ / Analyst / Tool-calling 1순위 모델',
        '🛡️ Mistral AI: mistral-small-latest — Groq/Cerebras 장애 또는 쿼터 초과 시 무료 티어 친화적 text last-resort fallback 담당',
        '👁️ Gemini Flash-Lite: Vision Agent 전용, 스크린샷과 긴 로그 컨텍스트 분석 — 사고 토큰 없는 안정적 비전 분석 경로',
        '▲ Vercel AI SDK 6.0: streamText, generateObject 중심 API — tool-calling LLM과 structured output 기반 스트리밍 응답',
        '🤖 Conditional Agent Escalation: 단순 조회는 deterministic/single path에 남기고 복잡 RCA/report/advisor/vision 요청만 전문 에이전트로 승격',
        '🧪 Custom Monitoring ML: SimpleAnomalyDetector + TrendPredictor.enhanced — 저지연·설명가능성 중심의 운영형 이상 탐지/예측',
        '🔍 Knowledge Retrieval Lite: BM25 RPC + metadata boost 기반 경량 지식 검색 — 외부 프레임워크 없이 직접 구성한 운영 지식 검색',
        '🐘 Supabase Postgres: 운영 지식과 사례 저장 — search_knowledge_text RPC와 RLS로 데이터 계층 단순화',
        '📊 Langfuse: AI 호출 추적 및 품질 모니터링 — resolvedMode, provider fallback, handoff 횟수 기반 지표 분석',
        '⚡ Upstash Redis: 응답 캐싱 및 Rate Limiting — LLM 반복 호출 비용 절감 및 쿼터 관리',
        '☁️ GCP Cloud Run: Node.js 24 + Hono 서버리스 컨테이너 — Vercel 컴퓨팅 부하 분산 및 AI 백엔드 전담, Scale-to-Zero 하이브리드 운영',
      ],
      technologies: [
        'Cerebras Inference (Planning)',
        'Groq Cloud (Tool-calling)',
        'Mistral AI (Text Fallback)',
        'Gemini 2.5 Flash-Lite (Vision)',
        'Vercel AI SDK 6.0',
        'Tool-calling LLM + Decision Layer',
        'Knowledge Retrieval Lite (BM25 + metadata boost)',
        'Custom Monitoring ML (TypeScript)',
        'Supabase Postgres (Text RPC)',
        'Langfuse (Observability)',
        'Upstash Redis',
        'GCP Cloud Run + Hono',
      ],
    },

    requiresAI: true,
    isAICard: true,
  },
  {
    id: 'cloud-platform',
    title: '🏗️ 클라우드 플랫폼 활용',
    description:
      '질문은 빠르게 받고, 무거운 분석은 분리 처리하도록 설계한 하이브리드 런타임. Vercel, Cloud Run, Supabase, Upstash를 한 흐름으로 연결했습니다.',
    icon: Database,
    gradient: 'from-emerald-500 to-teal-600',
    detailedContent: {
      overview: `사용자는 빠른 UI 응답을 받고, AI 분석은 별도 런타임에서 안정적으로 처리하도록 설계한 하이브리드 아키텍처입니다. Vercel(Frontend) + Cloud Run(Backend AI Engine) 분리 설계로 프론트엔드와 백엔드를 독립적으로 스케일링하며, Supabase(Postgres/Auth/RLS), Upstash(Cache), 요청 기반 Cloud Tasks 큐가 데이터와 비동기 실행 경계를 담당합니다.`,
      features: [
        '▲ Vercel: Next.js 16 최적화 호스팅, 글로벌 CDN, 서버리스 함수 — 프론트엔드 전담, 글로벌 저지연',
        '🐘 Supabase: PostgreSQL + Auth + RLS — 운영 지식, 사용자 상태, 접근 제어를 단일 Postgres 계층으로 통합',
        '☁️ GCP Cloud Run: Node.js AI SDK runtime 컨테이너 배포, Scale to Zero — Vercel 컴퓨팅 사용량 분산, AI 어시스턴트 백엔드 전담',
        '📬 Cloud Tasks: 사용자 요청에서 파생된 AI job HTTP delivery 큐 — 주기 Cron 없이 장시간 분석을 request-driven으로 분리',
        '⚡ Upstash: Serverless Redis를 이용한 초고속 데이터 캐싱 및 Rate Limiting — LLM 응답 캐싱으로 비용 절감',
        '🐋 Docker: Cloud Run 로컬 개발 환경 에뮬레이션 — 로컬과 배포 환경 차이 제거',
        '🦊 GitLab + Local Docker CI: canonical 저장소와 로컬 사전 검증을 결합한 운영 흐름 — GitLab CI와 로컬 검증 경로를 분리 운영',
        '💰 비용 최적화: Vercel Pro 고정비를 제외한 가변 운영비를 무료 티어 범위 안에서 유지',
      ],
      technologies: [
        'Vercel Platform',
        'Supabase PostgreSQL + Auth/RLS',
        'Google Cloud Run',
        'Google Cloud Tasks',
        'Upstash Redis',
        'Docker',
        'GitLab + Local Docker CI',
      ],
    },
    requiresAI: false,
  },
  {
    id: 'tech-stack',
    title: '💻 기술 스택',
    description:
      'AI 응답 스트리밍과 실시간 차트를 끊김 없이 구현하기 위해, 각 레이어에서 직접 골라 조합한 프론트엔드 웹 스택입니다.',
    icon: Sparkles,
    gradient: 'from-blue-500 to-purple-600',
    detailedContent: {
      overview: `실시간 대시보드, 자연어 질의, AI 응답 스트리밍을 하나의 제품 경험으로 묶기 위해 선택한 실제 운영 스택입니다. Next.js 16, React 19, TypeScript 6.0 등 최신 안정화 버전을 도입해 성능과 개발 경험을 함께 확보했습니다.`,
      features: [
        '⚛️ React 19: Concurrent Rendering, Server Components 등 최신 기능 적용 — 대시보드 초기 로딩 최적화',
        '▲ Next.js 16: App Router, Server Actions, Partial Prerendering — API Routes로 SSOT 데이터 제공',
        '🔷 TypeScript 6.0: 최신 컴파일러 기능을 활용한 강력한 타입 안전성 확보 — strict 모드로 런타임 에러 사전 차단',
        '🎨 Tailwind CSS 4.2: 최신 Oxide 엔진으로 빌드 성능 극대화 — 유틸리티 퍼스트로 디자인 시스템 일관성 확보',
        '📊 Recharts + uPlot 이중 차트: Recharts(SVG, 예측/이상치 인터랙션) + uPlot(Canvas, Grafana급 고성능) — 용도별 최적 렌더링 분담',
        '🔥 OpenTelemetry Data: CNCF 표준 시계열 SSOT — 24시간 메트릭+로그 파이프라인',
        '🔭 OpenTelemetry: CNCF Semantic Convention으로 메트릭 표준화 — Resource Catalog + Timeseries로 서버 메타데이터 관리',
        '📋 Loki 호환 로그 포맷: Grafana Loki Push API와 맞닿는 구조화 로그 형식 — 라벨 기반 스트림 모델로 서버 로그 필터링/탐색',
        '🔄 TanStack Query v5: 서버 상태 관리 및 데이터 캐싱 최적화 — 서버 상태와 UI 자동 동기화, 불필요한 재요청 제거',
        '🧰 Zustand 5.0: 글로벌 상태 관리 및 미들웨어 최적화 — Redux 대비 경량, 보일러플레이트 최소화',
        '🏬 Radix UI: 접근성이 보장된 Headless UI 컴포넌트 — WAI-ARIA 준수, 스타일 자유도 확보',
      ],
      technologies: [
        'Next.js 16',
        'React 19',
        'TypeScript 6.0',
        'Tailwind CSS 4.2',
        'Recharts 3.8.0 + uPlot 1.6',
        'OpenTelemetry Data Pipeline',
        'OpenTelemetry (Semantic Conv.)',
        'Loki-Compatible Log Format',
        'TanStack Query v5',
        'Zustand 5.0',
        'Radix UI / Lucide',
      ],
    },
    requiresAI: false,
  },
  {
    id: 'vibe-coding',
    title: '🤖 AI 개발 워크플로우',
    description:
      'Claude Code·Codex·Gemini 같은 AI 개발 도구를 상황에 맞게 조합해, 기획부터 배포·CI/CD까지 이어지는 실제 작업 흐름을 정리한 워크플로우입니다.',
    icon: Zap,
    gradient: 'from-amber-600 via-orange-600 to-amber-700',
    detailedContent: {
      overview: `이 프로젝트를 만들면서 정착한 개발 방식입니다. Claude Code·Codex CLI·Gemini CLI 같은 AI 개발 도구를 상황에 따라 활용해 서비스 구조와 배포 흐름을 함께 다듬었습니다. 실제 배포·CI/CD까지 이어지는 작업 과정을 기준으로 정리했으며, 설계·구현·리팩토링·테스트를 CLI 중심 워크플로우와 GitLab CI 게이트에 맞춰 운영합니다.`,
      features: [
        '1️⃣ Stage 1 (Manual): GPT/Gemini 창에서 수동 코딩 → [Netlify 목업](https://openmanager-vibe-v2.netlify.app/) — 초기 프로토타이핑',
        '2️⃣ Stage 2 (Auto): Cursor의 등장, "IDE 자동 개발"의 시작 — GUI 기반 AI 코딩 도입',
        '3️⃣ Stage 3 (Pivot): IDE는 보조(시각 분석)로, 메인은 WSL + Claude Code로 이동 — 아키텍처·구현 중심',
        '4️⃣ Stage 4 (Current): GitLab canonical + GitLab CI 배포 게이트 + Cloud Run AI Engine — 검증과 배포 권한 분리',
        '📺 IDE Role Shift: IDE는 주 개발 환경보다 터미널 뷰어, 브라우저 확인, 시각 보조 도구 역할에 가깝게 사용',
        '🐧 WSL Main Base: 상용 AI 개발 도구들이 실제로 돌아가는 본부 — 리눅스 환경에서 모든 CLI 도구 통합',
        '🤖 Agentic Ecosystem: Claude Code 메인 + Codex/Gemini 수동 교차 사용 — 역할별 교차 검증과 편향 완화',
        '🦊 GitLab + Dual Remote: canonical 저장소는 GitLab, GitHub는 공개 코드 스냅샷 전용 — production 배포는 GitLab CI semver tag pipeline이 담당',
      ],
      technologies: [
        'WSL Terminal (Main)',
        'Claude Code (Core)',
        'Codex CLI (구현/리팩토링)',
        'Gemini CLI (Research)',
        'GitLab + Dual Remote',
        'GitLab CI Deploy Gate',
        'Local Docker CI',
        'IDE/Browser Visual QA',
      ],
    },
    requiresAI: false,
    isVibeCard: true,
    isSpecial: true,
  },
];
