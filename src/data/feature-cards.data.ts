/**
 * Feature Cards 데이터
 * 메인 페이지에 표시되는 4개의 주요 기능 카드 데이터
 * @updated 2026-02-24 - AI 모델/에이전트 정보 실제 코드베이스와 동기화
 */

import { Bot, Database, Sparkles, Zap } from 'lucide-react';
import type { FeatureCard } from '@/types/feature-card.types';

export const FEATURE_CARDS_DATA: FeatureCard[] = [
  {
    id: 'ai-assistant',
    title: '🧠 AI Assistant',
    description:
      '4개 AI 프로바이더 + 7개 전문 에이전트로 서버 장애를 실시간 분석. Vision Agent로 대시보드 스크린샷 분석, 대용량 로그 처리 지원.',
    icon: Bot,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    detailedContent: {
      overview: `4개의 AI Provider(Cerebras, Groq, Mistral, Gemini)와 Vercel AI SDK 6.0 네이티브 ToolLoopAgent 기반 5-Agent + Evaluator-Optimizer 파이프라인 시스템입니다. Vision Agent로 대시보드 스크린샷 분석, 1M 토큰 대용량 로그 분석, Google Search Grounding 지원. 경량 커스텀 TypeScript ML(통계 이상 탐지 + 추세 예측)과 Native GraphRAG + Tavily 하이브리드 검색을 함께 사용합니다.`,
      features: [
        '🧠 Cerebras Inference: WSE-3 칩 기반 1M 토큰/일 초고속 추론 (gpt-oss-120b) — NLQ/Analyst/Supervisor 1순위, 최저 지연 우선',
        '⚡ Groq Cloud: LPU 기반 500 Tokens/s 초고속 추론 (llama-3.3-70b-versatile) — Reporter/Orchestrator 1순위 모델',
        '🛡️ Mistral AI: mistral-large-latest Frontier 모델 — Advisor 1순위, RAG 검색 품질 최적',
        '👁️ Gemini Flash: Vision Agent 전용, 스크린샷 분석, 1M 컨텍스트 — 대용량 로그/이미지 처리 유일 모델',
        '▲ Vercel AI SDK 6.0: streamText, generateObject, embed 통합 API — 멀티 에이전트 스트리밍 응답 기반',
        '🤖 Orchestrator-Worker: AI SDK v6 네이티브 ToolLoopAgent + stopWhen 기반 5-Agent 라우팅 + Evaluator-Optimizer 파이프라인',
        '🧪 Custom Monitoring ML: SimpleAnomalyDetector + TrendPredictor.enhanced — 저지연·설명가능성 중심의 운영형 이상 탐지/예측',
        '🦙 Native GraphRAG: Vercel AI SDK + Supabase 기반 Knowledge Triplet Extraction 직접 구현 (No-Framework 설계)',
        '🐘 Supabase pgVector: 벡터 유사도 검색 + 그래프 탐색 — 의미 검색과 관계 탐색을 단일 DB에 통합',
        '📊 Langfuse: AI 호출 추적 및 품질 모니터링 — 멀티 에이전트 파이프라인 전체 추적 및 비용 분석',
        '⚡ Upstash Redis: 응답 캐싱 및 Rate Limiting — LLM 반복 호출 비용 절감',
        '☁️ GCP Cloud Run: Node.js 24 + Hono 서버리스 컨테이너 — Vercel 10초 제한 우회 (300초 허용)',
      ],
      technologies: [
        'Cerebras Inference (gpt-oss-120b)',
        'Groq Cloud (llama-3.3-70b)',
        'Mistral AI (mistral-large-latest)',
        'Gemini 2.5 Flash (Vision)',
        'Vercel AI SDK 6.0',
        'AI SDK v6 ToolLoopAgent (native)',
        'Native GraphRAG (No-Framework)',
        'Custom Monitoring ML (TypeScript)',
        'Supabase pgVector',
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
      'Vercel(Frontend) + Cloud Run(Backend) 분산 아키텍처. 4개 플랫폼을 연동해 하나의 시스템으로 동작시킨 통합 구현.',
    icon: Database,
    gradient: 'from-emerald-500 to-teal-600',
    detailedContent: {
      overview: `4개의 서로 다른 클라우드 플랫폼을 연동하여 하나의 시스템으로 동작시킨 하이브리드 아키텍처입니다. Vercel(Frontend) + Cloud Run(Backend AI Engine) 분리 설계로 프론트엔드와 백엔드를 독립적으로 스케일링합니다. Supabase(DB+Vector)와 Upstash(Cache)가 데이터 계층을 담당합니다.`,
      features: [
        '▲ Vercel: Next.js 16 최적화 호스팅, 글로벌 CDN, Edge Runtime, 자동 스케일링 — 프론트엔드 전담, 글로벌 저지연',
        '🐘 Supabase: PostgreSQL + pgVector(AI 벡터 검색) + RLS(행 수준 보안) — DB+벡터+인증을 단일 플랫폼으로 통합',
        '☁️ GCP Cloud Run: Node.js AI SDK Multi-Agent Engine 컨테이너 배포, Scale to Zero — AI 처리 전담, Vercel 10초 제한 해소',
        '⚡ Upstash: Serverless Redis를 이용한 초고속 데이터 캐싱 및 Rate Limiting — LLM 응답 캐싱으로 비용 절감',
        '🐋 Docker: Cloud Run 로컬 개발 환경 에뮬레이션 — 로컬과 배포 환경 차이 제거',
        '🔄 GitHub Actions: CI/CD 파이프라인, 자동 테스트 및 배포 — push→Vercel, tag→Cloud Run 분리 배포',
        '💰 비용 최적화: Vercel Pro($20/mo) 외 Supabase/Cloud Run/Upstash Free Tier 100% 활용 — 최소 비용 운영 달성',
      ],
      technologies: [
        'Vercel Platform',
        'Supabase PostgreSQL + pgVector',
        'Google Cloud Run',
        'Upstash Redis',
        'Docker',
        'GitHub Actions CI/CD',
      ],
    },
    requiresAI: false,
  },
  {
    id: 'tech-stack',
    title: '💻 기술 스택',
    description:
      'Next.js 16 · React 19 · TypeScript 5.9 기반. 최신 기술을 선제적으로 도입한 Next-Gen 웹 아키텍처',
    icon: Sparkles,
    gradient: 'from-blue-500 to-purple-600',
    detailedContent: {
      overview: `실제 사용 중인 Next-Gen 기술 스택! Next.js 16, React 19, TypeScript 5.9 등 최신 안정화 버전을 도입하여 최고의 성능과 개발 경험을 제공합니다.`,
      features: [
        '⚛️ React 19: Concurrent Rendering, Server Components 등 최신 기능 적용 — 대시보드 초기 로딩 최적화',
        '▲ Next.js 16: Server Actions, Partial Prerendering, Edge Runtime 지원 — API Routes로 SSOT 데이터 제공',
        '🔷 TypeScript 5.9: 최신 컴파일러 기능을 활용한 강력한 타입 안전성 확보 — strict 모드로 런타임 에러 사전 차단',
        '🎨 Tailwind CSS 4.1: 최신 Oxides 엔진으로 빌드 성능 극대화 — 유틸리티 퍼스트로 디자인 시스템 일관성 확보',
        '📊 Recharts + uPlot 이중 차트: Recharts(SVG, 예측/이상치 인터랙션) + uPlot(Canvas, Grafana급 고성능) — 용도별 최적 렌더링 분담',
        '🔥 OTel-native Data: CNCF 표준 시계열 SSOT — otel-data/ 24시간 메트릭+로그 직접 소비',
        '🔭 OpenTelemetry: CNCF Semantic Convention으로 메트릭 표준화 — Resource Catalog + Timeseries로 서버 메타데이터 관리',
        '📋 Loki Log Format: Grafana Loki Push API 호환 구조화 로그 — 라벨 기반 스트림 모델로 서버 로그 필터링/탐색',
        '🔄 TanStack Query v5: 서버 상태 관리 및 데이터 캐싱 최적화 — 서버 상태와 UI 자동 동기화, 불필요한 재요청 제거',
        '🧰 Zustand 5.0: 글로벌 상태 관리 및 미들웨어 최적화 — Redux 대비 경량, 보일러플레이트 최소화',
        '🏬 Radix UI: 접근성이 보장된 Headless UI 컴포넌트 — WAI-ARIA 준수, 스타일 자유도 확보',
      ],
      technologies: [
        'Next.js 16',
        'React 19',
        'TypeScript 5.9',
        'Tailwind CSS 4.1',
        'Recharts 3.7.0 + uPlot 1.6',
        'OTel-native Data (SSOT)',
        'OpenTelemetry (Semantic Conv.)',
        'Loki Log Format',
        'TanStack Query v5',
        'Zustand 5.0',
        'Radix UI / Lucide',
      ],
    },
    requiresAI: false,
  },
  {
    id: 'vibe-coding',
    title: '🔥 Vibe Coding',
    description:
      '본 모니터링 플랫폼을 구축하기 위해 실제 적용한 Vibe Coding(AI 협업) 방법론. 4단계 진화를 거친 에이전틱 워크플로우를 증명합니다.',
    icon: Zap,
    gradient: 'from-amber-600 via-orange-600 to-amber-700',
    detailedContent: {
      overview: `이 프로덕트가 탄생한 개발 방법론입니다. 단순 AI 챗봇이 아닌, 서비스 아키텍처 전체를 AI(ChatGPT/Claude/Gemini)와 페어 프로그래밍하여 E2E로 구축했습니다.`,
      features: [
        '1️⃣ Stage 1 (Manual): GPT/Gemini 창에서 수동 코딩 → [Netlify 목업](https://openmanager-vibe-v2.netlify.app/) — 초기 프로토타이핑',
        '2️⃣ Stage 2 (Auto): Cursor의 등장, "IDE 자동 개발"의 시작 — GUI 기반 AI 코딩 도입',
        '3️⃣ Stage 3 (Pivot): IDE는 보조(시각 분석)로, 메인은 WSL + Claude Code로 이동 — 터미널 기반이 대규모 리팩토링에 유리',
        '4️⃣ Stage 4 (Current): WSL 위의 Multi-CLI (Codex/Gemini) + Google Antigravity — 복수 AI 교차 검증 체계',
        '📺 IDE Role Shift: 개발의 주체에서 "터미널 뷰어" 및 "스크린샷 분석도구"로 축소 — AI가 코드 생성, 사람은 설계와 판단',
        '🐧 WSL Main Base: 모든 지능형 에이전트들이 활동하는 실제 본부 — 리눅스 환경에서 모든 CLI 도구 통합',
        '🤖 Agentic Ecosystem: Claude Code(Main)을 중심으로 복수 에이전트 협업 — 단일 AI 편향 방지를 위한 멀티 에이전트',
        '🚀 Google Antigravity: Agent-first IDE - AI가 계획·실행·검증하는 새 패러다임 (Google) — 최신 에이전트 기반 개발 환경',
      ],
      technologies: [
        'Google Antigravity (IDE)',
        'WSL Terminal (Main)',
        'Claude Code (Core)',
        'Multi-CLI Agents',
        'VSCode (Visual Aux)',
        'Cursor/Windsurf (Legacy)',
      ],
    },
    requiresAI: false,
    isVibeCard: true,
    isSpecial: true,
  },
];
