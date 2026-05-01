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
    title: '💬 AI 어시스턴트',
    description:
      '현재 메트릭을 바탕으로 질문, 분석, 조치안을 바로 연결하는 운영 어시스턴트. 장애 분석, 스크린샷 이해, 대용량 로그 처리까지 지원합니다.',
    icon: Bot,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    detailedContent: {
      overview: `운영자가 메트릭 그래프를 직접 해석하지 않아도, 질문 하나로 현재 상태, 원인 분석, 다음 조치안을 받을 수 있도록 설계한 AI 실행 계층입니다. 4개의 AI Provider(Cerebras, Groq, Mistral, Gemini)와 Vercel AI SDK 6.0 기반의 고도화된 5-Agent 멀티에이전트 오케스트레이션을 사용하며, Vision Agent의 대시보드 스크린샷 분석, 1M 토큰 로그 분석, Google Search Grounding을 지원합니다. 경량 커스텀 TypeScript ML(통계 이상 탐지 + 추세 예측)과 Knowledge Retrieval Lite(BM25 + pgVector) + Tavily 하이브리드 검색을 함께 사용합니다.`,
      features: [
        '🧠 Cerebras Inference: 초고속 추론 인프라 (llama3.1-8b) — 짧은 컨텍스트 fallback 및 structured route 보조',
        '⚡ Groq Cloud: LPU 기반 초고속 500 Tokens/s 추론 (llama-4-scout-17b) — NLQ / Analyst / Tool-calling 1순위 모델',
        '🛡️ Mistral AI: mistral-large-latest Frontier 모델 — Groq/Cerebras 장애 또는 쿼터 초과 시 text last-resort fallback 담당',
        '👁️ Gemini Flash-Lite: Vision Agent 전용, 스크린샷 분석, 1M 컨텍스트 — 사고 토큰 없는 안정적 비전 분석 및 대용량 로그 처리',
        '▲ Vercel AI SDK 6.0: streamText, generateObject, embed 통합 API — 고도화된 멀티 에이전트 스트리밍 응답 아키텍처',
        '🤖 Multi-Agent Orchestration: Orchestrator Planning + 전문 에이전트 Handoff 시스템 기반의 지능형 라우팅 및 협업 워크플로우',
        '🧪 Custom Monitoring ML: SimpleAnomalyDetector + TrendPredictor.enhanced — 저지연·설명가능성 중심의 운영형 이상 탐지/예측',
        '🔍 Knowledge Retrieval Lite: BM25 + Supabase pgVector 기반 경량 지식 검색 — 외부 프레임워크 없이 직접 구성한 벡터 + 텍스트 하이브리드 검색',
        '🐘 Supabase pgVector: 벡터 유사도 검색 — 의미 검색과 메타데이터 필터를 단일 DB에 통합',
        '📊 Langfuse: AI 호출 추적 및 품질 모니터링 — 멀티 에이전트 파이프라인 전체 추적 및 handoff 횟수 기반 지표 분석',
        '⚡ Upstash Redis: 응답 캐싱 및 Rate Limiting — LLM 반복 호출 비용 절감 및 쿼터 관리',
        '☁️ GCP Cloud Run: Node.js 24 + Hono 서버리스 컨테이너 — Vercel 컴퓨팅 부하 분산 및 AI 백엔드 전담, Scale-to-Zero 하이브리드 운영',
      ],
      technologies: [
        'Cerebras Inference (Planning)',
        'Groq Cloud (Tool-calling)',
        'Mistral AI (Text Fallback)',
        'Gemini 2.5 Flash-Lite (Vision)',
        'Vercel AI SDK 6.0',
        'Multi-Agent Handoff Archi',
        'Knowledge Retrieval Lite (BM25 + pgVector)',
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
      '질문은 빠르게 받고, 무거운 분석은 분리 처리하도록 설계한 하이브리드 런타임. Vercel, Cloud Run, Supabase, Upstash를 한 흐름으로 연결했습니다.',
    icon: Database,
    gradient: 'from-emerald-500 to-teal-600',
    detailedContent: {
      overview: `사용자는 빠른 UI 응답을 받고, AI 분석은 별도 런타임에서 안정적으로 처리하도록 설계한 하이브리드 아키텍처입니다. Vercel(Frontend) + Cloud Run(Backend AI Engine) 분리 설계로 프론트엔드와 백엔드를 독립적으로 스케일링하며, Supabase(DB+Vector)와 Upstash(Cache)가 데이터 계층을 담당합니다.`,
      features: [
        '▲ Vercel: Next.js 16 최적화 호스팅, 글로벌 CDN, Edge Runtime, 자동 스케일링 — 프론트엔드 전담, 글로벌 저지연',
        '🐘 Supabase: PostgreSQL + pgVector(AI 벡터 검색) + RLS(행 수준 보안) — DB+벡터+인증을 단일 플랫폼으로 통합',
        '☁️ GCP Cloud Run: Node.js AI SDK Multi-Agent Engine 컨테이너 배포, Scale to Zero — Vercel 컴퓨팅 사용량 분산, AI 어시스턴트 백엔드 전담',
        '⚡ Upstash: Serverless Redis를 이용한 초고속 데이터 캐싱 및 Rate Limiting — LLM 응답 캐싱으로 비용 절감',
        '🐋 Docker: Cloud Run 로컬 개발 환경 에뮬레이션 — 로컬과 배포 환경 차이 제거',
        '🦊 GitLab + Local Docker CI: canonical 저장소와 로컬 사전 검증을 결합한 운영 흐름 — GitLab CI와 로컬 검증 경로를 분리 운영',
        '💰 비용 최적화: 유료 기능 의존을 최소화하고, Supabase/Cloud Run/Upstash는 무료 티어 범위 안에서 운영',
      ],
      technologies: [
        'Vercel Platform',
        'Supabase PostgreSQL + pgVector',
        'Google Cloud Run',
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
        '▲ Next.js 16: Server Actions, Partial Prerendering, Edge Runtime 지원 — API Routes로 SSOT 데이터 제공',
        '🔷 TypeScript 6.0: 최신 컴파일러 기능을 활용한 강력한 타입 안전성 확보 — strict 모드로 런타임 에러 사전 차단',
        '🎨 Tailwind CSS 4.2: 최신 Oxides 엔진으로 빌드 성능 극대화 — 유틸리티 퍼스트로 디자인 시스템 일관성 확보',
        '📊 Recharts + uPlot 이중 차트: Recharts(SVG, 예측/이상치 인터랙션) + uPlot(Canvas, Grafana급 고성능) — 용도별 최적 렌더링 분담',
        '🔥 OTel-native Data: CNCF 표준 시계열 SSOT — otel-data/ 24시간 메트릭+로그 직접 소비',
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
        'Recharts 3.7.0 + uPlot 1.6',
        'OTel-native Data (SSOT)',
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
    title: '🔥 Vibe Coding',
    description:
      'Claude Code·Codex·Gemini 같은 AI 개발 도구를 상황에 맞게 조합해, 기획부터 배포·CI/CD까지 이어지는 실제 작업 흐름을 정리한 워크플로우입니다.',
    icon: Zap,
    gradient: 'from-amber-600 via-orange-600 to-amber-700',
    detailedContent: {
      overview: `이 프로젝트를 만들면서 정착한 개발 방식입니다. Claude Code·Codex CLI·Gemini CLI 같은 AI 개발 도구를 상황에 따라 활용해 서비스 구조와 배포 흐름을 함께 다듬었습니다. 실제 배포·CI/CD까지 이어지는 작업 과정을 기준으로 정리했으며, 아키텍처 설계·구현은 Claude Code 중심으로 진행했고, 구현·리팩토링·테스트 단계에서 Codex와 역할을 나눴습니다.`,
      features: [
        '1️⃣ Stage 1 (Manual): GPT/Gemini 창에서 수동 코딩 → [Netlify 목업](https://openmanager-vibe-v2.netlify.app/) — 초기 프로토타이핑',
        '2️⃣ Stage 2 (Auto): Cursor의 등장, "IDE 자동 개발"의 시작 — GUI 기반 AI 코딩 도입',
        '3️⃣ Stage 3 (Pivot): IDE는 보조(시각 분석)로, 메인은 WSL + Claude Code로 이동 — 아키텍처·구현 중심',
        '4️⃣ Stage 4 (Current): GitLab canonical 전환 + 로컬 Docker CI + Cloud Run AI Engine — 마무리·배포 단계에서 Codex 비중 증가',
        '📺 IDE Role Shift: Google Antigravity·VSCode 같은 IDE는 주 개발 환경보다 터미널 뷰어와 시각 보조 도구 역할에 가깝게 사용',
        '🐧 WSL Main Base: 상용 AI 개발 도구들이 실제로 돌아가는 본부 — 리눅스 환경에서 모든 CLI 도구 통합',
        '🤖 Agentic Ecosystem: Claude Code 메인 + Codex/Gemini 수동 교차 사용 — 역할별 교차 검증과 편향 완화',
        '🦊 GitLab + Dual Remote: canonical 저장소는 GitLab, GitHub는 공개 코드 스냅샷 전용 — git push gitlab main 이후 GitLab CI가 배포를 이어받음',
      ],
      technologies: [
        'Google Antigravity (IDE)',
        'WSL Terminal (Main)',
        'Claude Code (Core)',
        'Codex CLI (구현/리팩토링)',
        'Gemini CLI (Research)',
        'GitLab + Dual Remote',
        'Local Docker CI',
        'VSCode (Visual Aux)',
        'Cursor/Windsurf (Legacy)',
      ],
    },
    requiresAI: false,
    isVibeCard: true,
    isSpecial: true,
  },
];
