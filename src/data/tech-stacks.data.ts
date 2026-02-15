/**
 * Tech Stacks 데이터
 * 각 Feature Card의 모달에서 표시되는 상세 기술 스택 정보
 */

import { MCP_SERVERS } from '@/config/constants';
import type { TechItem } from '../types/feature-card.types';

// 바이브 코딩 전용 현재/히스토리 구분 타입
export interface VibeCodeData {
  current: TechItem[];
  history: {
    stage1: TechItem[]; // 1단계: 수동 개발 (ChatGPT/Gemini -> Copy/Paste -> Netlify)
    stage2: TechItem[]; // 2단계: 자동 개발 (Cursor IDE Vibe)
    stage3: TechItem[]; // 3단계: 분기점 (Windsurf/VSCode=보조, WSL/Claude=메인)
  };
}

export const TECH_STACKS_DATA: Record<string, TechItem[] | VibeCodeData> = {
  'ai-assistant-pro': [
    // ========== AI Providers (기술 소개) ==========
    {
      name: 'Cerebras Inference',
      category: 'ai',
      importance: 'critical',
      description:
        '세계 최대 AI 칩 Wafer-Scale Engine(WSE-3) 기반 추론 서비스. 850,000개 코어가 단일 웨이퍼에 집적되어 GPU 클러스터의 통신 병목 없이 초고속 추론 제공',
      implementation:
        '→ Orchestrator + NLQ Agent에서 사용. 24M 토큰/일 무료 티어로 서버 조회 및 의도 분류 담당',
      version: 'Llama 3.3 70B',
      status: 'active',
      icon: '🧠',
      tags: ['WSE-3', '24M/day', '웨이퍼스케일'],
      type: 'commercial',
    },
    {
      name: 'Groq Cloud',
      category: 'ai',
      importance: 'critical',
      description:
        'LPU(Language Processing Unit) 기반 초고속 추론 인프라. GPU 대비 일관된 응답 속도와 낮은 지연시간으로 500 Tokens/s 속도 제공',
      implementation:
        '→ Analyst + Reporter Agent에서 사용. 이상 탐지, 트렌드 예측, 보고서 생성 담당',
      version: 'Llama 3.3 70B Versatile',
      status: 'active',
      icon: '⚡',
      tags: ['LPU', '500T/s', '초고속'],
      type: 'commercial',
    },
    {
      name: 'Mistral AI',
      category: 'ai',
      importance: 'high',
      description:
        '프랑스 AI 스타트업의 효율적인 오픈웨이트 LLM. 24B 파라미터의 Small Language Model로 대형 모델 대비 낮은 비용과 빠른 응답 속도 제공',
      implementation:
        '→ Advisor Agent에서 사용. GraphRAG 기반 해결 방법 안내 및 응답 품질 검증 담당',
      version: 'mistral-small-2506 (24B)',
      status: 'active',
      icon: '🛡️',
      tags: ['SLM', '24B', '오픈웨이트'],
      type: 'commercial',
    },
    {
      name: 'Gemini 2.5 Flash',
      category: 'ai',
      importance: 'high',
      description:
        'Google의 멀티모달 AI 모델. 1M 토큰 컨텍스트, 이미지/PDF/비디오 분석, Google Search Grounding으로 실시간 웹 검색 지원',
      implementation:
        '→ Vision Agent 전용. 대시보드 스크린샷 분석, 대용량 로그 분석(1M 컨텍스트), URL 문서 분석 담당. Graceful Degradation으로 장애 시 기존 에이전트 정상 동작 보장',
      version: 'gemini-2.5-flash',
      status: 'active',
      icon: '👁️',
      tags: ['Vision', '1M-Context', 'Multimodal', 'Search-Grounding'],
      type: 'commercial',
    },

    // ========== Framework & SDK ==========
    {
      name: 'Vercel AI SDK',
      category: 'ai',
      importance: 'critical',
      description:
        'Vercel이 개발한 AI 애플리케이션 프레임워크. streamText, generateObject 등 API로 스트리밍 응답, 도구 호출, 멀티 에이전트 오케스트레이션 지원',
      implementation:
        '@ai-sdk-tools/agents 패키지로 7-Agent 멀티 에이전트 시스템 구축. Orchestrator-Worker Handoff 패턴 구현',
      version: '6.0',
      status: 'active',
      icon: '▲',
      tags: ['AI SDK', 'Streaming', 'Multi-Agent'],
      type: 'opensource',
    },
    {
      name: '@ai-sdk-tools/agents',
      category: 'ai',
      importance: 'high',
      description:
        'Vercel AI SDK 확장 패키지. Agent 클래스로 전문 에이전트 정의, matchOn으로 패턴 매칭, handoffs로 에이전트 간 작업 위임 지원',
      implementation:
        'Orchestrator + NLQ + Analyst + Reporter + Advisor + Vision + Evaluator + Optimizer 7개 에이전트 (5 외부 라우팅 + 2 내부) 정의. 질문 유형별 자동 라우팅 구현',
      version: '1.2',
      status: 'active',
      icon: '🤖',
      tags: ['Agents', 'Handoff', 'Pattern Matching'],
      type: 'opensource',
    },
    // ========== Database & RAG ==========
    {
      name: 'Supabase pgVector',
      category: 'database',
      importance: 'high',
      description:
        'PostgreSQL 확장으로 벡터 유사도 검색 지원. 텍스트 임베딩을 저장하고 코사인 유사도로 관련 문서 검색 가능',
      implementation:
        '과거 장애 사례 및 해결 방법 저장. Advisor Agent가 searchKnowledgeBase 도구로 유사 사례 검색',
      version: 'PostgreSQL 15 + pgVector',
      status: 'active',
      icon: '🐘',
      tags: ['Vector Search', 'RAG', 'Embedding'],
      type: 'commercial',
    },
    {
      name: 'GraphRAG (LlamaIndex.TS)',
      category: 'ai',
      importance: 'high',
      description:
        'LlamaIndex.TS 기반 하이브리드 검색. Vector Search + Knowledge Graph Triplet Extraction으로 개념 간 관계를 탐색하여 정확한 컨텍스트 제공',
      implementation:
        'LlamaIndex.TS + Mistral AI로 Triplet 추출. Supabase pgVector와 통합된 하이브리드 검색 수행',
      version: 'LlamaIndex.TS',
      status: 'active',
      icon: '🦙',
      tags: ['LlamaIndex.TS', 'Hybrid Search', 'Knowledge Graph'],
      type: 'opensource',
    },
    // ========== ML Engine ==========
    {
      name: 'Isolation Forest',
      category: 'ai',
      importance: 'high',
      description:
        'ML 기반 다변량 이상 탐지 알고리즘. 정상 데이터로부터 이상치를 효율적으로 분리하는 앙상블 트리 기반 비지도 학습',
      implementation:
        '→ Analyst Agent에서 사용. Statistical 빠른 체크 → IF 다변량 분석 → Adaptive Thresholds 앙상블 투표로 최종 판정',
      version: 'isolation-forest v0.0.9',
      status: 'active',
      icon: '🌲',
      tags: ['ML', '이상탐지', '앙상블'],
      type: 'opensource',
    },
    {
      name: 'Adaptive Thresholds',
      category: 'ai',
      importance: 'medium',
      description:
        '시계열 패턴을 학습하여 동적으로 임계값을 조정하는 알고리즘. 시간대별, 요일별 패턴을 반영한 정확한 이상 탐지',
      implementation:
        '→ UnifiedAnomalyEngine에서 사용. 과거 데이터 패턴 학습 → 실시간 임계값 조정 → Ensemble Voting 참여',
      version: 'Custom',
      status: 'active',
      icon: '📈',
      tags: ['시계열', '패턴학습', '동적임계값'],
      type: 'custom',
    },
    {
      name: 'Mistral Embedding',
      category: 'ai',
      importance: 'high',
      description:
        'Mistral AI의 텍스트 임베딩 모델. 1024차원 벡터로 텍스트 의미를 표현하여 유사도 검색에 활용',
      implementation:
        '→ RAG 검색 및 Knowledge Base 저장에 사용. @ai-sdk/mistral embed API로 벡터 생성',
      version: 'mistral-embed (1024d)',
      status: 'active',
      icon: '🔍',
      tags: ['Embedding', '1024d', 'RAG'],
      type: 'commercial',
    },
    // ========== Observability ==========
    {
      name: 'Langfuse',
      category: 'ai',
      importance: 'medium',
      description:
        'AI 애플리케이션 관측성 플랫폼. LLM 호출 추적, 프롬프트 버전 관리, 품질 모니터링을 제공',
      implementation:
        '→ 모든 AI 호출에 통합. 토큰 사용량, 응답 시간, 에러율 추적 및 프롬프트 품질 분석',
      version: 'langfuse v3.38',
      status: 'active',
      icon: '📊',
      tags: ['Observability', 'LLM추적', '품질모니터링'],
      type: 'commercial',
    },
    {
      name: 'Upstash Redis',
      category: 'database',
      importance: 'medium',
      description:
        'Serverless Redis 서비스. Edge에서 동작하는 초저지연 캐싱과 Rate Limiting 제공',
      implementation:
        '→ AI 응답 캐싱(3시간 TTL), API Rate Limiting, 세션 저장에 사용. 무료 티어 10K req/day',
      version: '@upstash/redis v1.36',
      status: 'active',
      icon: '⚡',
      tags: ['Redis', 'Cache', 'RateLimiting'],
      type: 'commercial',
    },
    // ========== Deployment ==========
    {
      name: 'GCP Cloud Run',
      category: 'deployment',
      importance: 'high',
      description:
        'Google Cloud의 서버리스 컨테이너 플랫폼. 요청이 없으면 Scale to Zero로 비용 절감, 트래픽 증가 시 자동 확장',
      implementation:
        'Node.js 24 + Hono 웹 프레임워크로 AI 엔진 컨테이너 운영. asia-northeast1(서울) 리전 배포',
      version: 'asia-northeast1',
      status: 'active',
      icon: '☁️',
      tags: ['Serverless', 'Container', 'Auto-scale'],
      type: 'commercial',
    },
  ],
  'cloud-platform': [
    {
      name: 'Vercel Platform',
      category: 'deployment',
      importance: 'critical',
      description:
        '프론트엔드 배포에 최적화된 클라우드 플랫폼. 글로벌 Edge Network, 자동 HTTPS, Preview Deployments, 서버리스 Functions 제공',
      implementation: '→ GitHub 연동 자동 빌드/배포. Next.js 16 최적화 호스팅',
      status: 'active',
      icon: '▲',
      tags: ['배포', '클라우드 호스팅', '전역 CDN'],
      type: 'commercial',
    },
    {
      name: 'Supabase PostgreSQL',
      category: 'database',
      importance: 'critical',
      description:
        '오픈소스 Firebase 대안 BaaS. PostgreSQL 기반으로 인증, 스토리지, 실시간 구독, Edge Functions, 벡터 검색(pgVector) 통합 제공',
      implementation: '→ pgVector로 AI 벡터 검색, RLS로 행 수준 보안 적용',
      status: 'active',
      icon: '🐘',
      tags: ['데이터베이스', 'pgVector', 'BaaS'],
      type: 'commercial',
    },
    {
      name: 'GCP Cloud Run',
      category: 'deployment',
      importance: 'high',
      description:
        'Google Cloud 서버리스 컨테이너 플랫폼. Scale to Zero로 유휴 비용 제로, 트래픽 증가 시 자동 확장, 콜드 스타트 최소화',
      implementation:
        '→ Node.js 24 + Hono AI Engine 운영. asia-northeast1(서울) 배포',
      status: 'active',
      icon: '☁️',
      tags: ['CloudRun', 'Container', 'Serverless'],
      type: 'commercial',
    },
    {
      name: 'Docker',
      category: 'deployment',
      importance: 'high',
      description:
        '컨테이너 기반 가상화 플랫폼. 애플리케이션과 의존성을 패키징하여 어디서든 동일하게 실행. 개발-프로덕션 환경 일관성 보장',
      implementation:
        '→ WSL + Docker로 Cloud Run 로컬 에뮬레이션. 환경 불일치 원천 차단',
      version: '24.0.x',
      status: 'active',
      icon: '🐋',
      tags: ['Docker', 'Container', 'DevOps'],
      type: 'opensource',
    },
    {
      name: 'GitHub Actions',
      category: 'deployment',
      importance: 'medium',
      description:
        'GitHub 내장 CI/CD 플랫폼. YAML 기반 워크플로우 정의, 다양한 러너 환경, 마켓플레이스 액션으로 자동화 파이프라인 구축',
      implementation: '→ Push 시 자동 테스트→빌드→배포 파이프라인 실행',
      status: 'active',
      icon: '🔄',
      tags: ['CI/CD', '자동화', '워크플로우'],
      type: 'commercial',
    },
    {
      name: 'Upstash Redis',
      category: 'cache',
      importance: 'critical',
      description:
        'Serverless Redis 서비스. 글로벌 복제, 초저지연 캐싱, 사용량 기반 과금. REST API로 Edge 환경에서도 접근 가능',
      implementation:
        '→ AI 응답 캐싱(3시간 TTL), API Rate Limiting으로 할당량 보호',
      status: 'active',
      icon: '⚡',
      tags: ['Redis', 'Serverless', 'Cache', 'Rate-Limit'],
      type: 'commercial',
    },
    {
      name: 'Sentry',
      category: 'deployment',
      importance: 'medium',
      description:
        '프로덕션 에러 모니터링 및 성능 추적 플랫폼. 크래시 리포트, 성능 병목 탐지, Release Health 추적 제공',
      implementation:
        '→ 에러 발생 시 스택 트레이스, 브레드크럼 자동 수집. Next.js Client/Server/Edge 전체 커버',
      version: '10.34',
      status: 'active',
      icon: '🛡️',
      tags: ['Error-Tracking', 'Performance', 'Monitoring'],
      type: 'commercial',
    },
    {
      name: 'Pino',
      category: 'deployment',
      importance: 'medium',
      description:
        'Node.js 초고속 JSON 로깅 라이브러리. 낮은 오버헤드, 구조화된 로그, Child Logger 지원. Bunyan/Winston 대비 5배 빠른 성능',
      implementation:
        '→ 서버/브라우저 통합 로거 구현. Cloud Run에서 GCP Cloud Logging 호환 포맷 출력',
      version: '10.1',
      status: 'active',
      icon: '📋',
      tags: ['Logging', 'JSON', 'Performance'],
      type: 'opensource',
    },
  ],
  'tech-stack': [
    {
      name: 'React 19',
      category: 'framework',
      importance: 'critical',
      description:
        'Meta의 UI 라이브러리. Concurrent Rendering, Server Components, Suspense, Transitions 등 최신 렌더링 패턴 제공',
      implementation:
        '→ Concurrent 기능과 Server Components로 성능 최적화 적용',
      version: '19.2.3',
      status: 'active',
      icon: '⚛️',
      tags: ['프레임워크', '오픈소스', 'React'],
      type: 'opensource',
    },
    {
      name: 'Next.js 16',
      category: 'framework',
      importance: 'critical',
      description:
        'Vercel의 React 풀스택 프레임워크. App Router, Server Actions, Partial Prerendering, Edge Runtime, 자동 코드 분할 제공',
      implementation:
        '→ App Router + Server Actions + PPR로 최적화된 렌더링 구현',
      version: '16.1.1',
      status: 'active',
      icon: '▲',
      tags: ['프레임워크', '오픈소스', 'SSR'],
      type: 'opensource',
    },
    {
      name: 'TypeScript 5.9',
      category: 'language',
      importance: 'critical',
      description:
        'Microsoft의 정적 타입 언어. JavaScript 슈퍼셋으로 컴파일 타임 타입 검사, IDE 자동완성, 리팩토링 안전성 제공',
      implementation:
        '→ strict 모드로 컴파일 타임 오류 방지 및 개발 생산성 향상',
      version: '5.9.3',
      status: 'active',
      icon: '🔷',
      tags: ['언어', '오픈소스', '타입안전'],
      type: 'opensource',
    },
    {
      name: 'Node.js 24 + Hono',
      category: 'language',
      importance: 'critical',
      description:
        'Node.js: V8 기반 서버사이드 JS 런타임. Hono: Web Standards API 기반 초경량 웹 프레임워크로 Express 대비 10배 빠른 성능',
      implementation:
        '→ Cloud Run에서 AI Engine 백엔드로 운영. TypeScript 기반',
      version: '24.x',
      status: 'active',
      icon: '🚀',
      tags: ['백엔드', 'TypeScript', 'Hono'],
      type: 'opensource',
    },
    {
      name: 'Recharts 3.6',
      category: 'ui',
      importance: 'high',
      description:
        'React 기반 선언적 차트 라이브러리. D3.js 위에 구축, SVG 렌더링, 반응형 컨테이너, 애니메이션 지원. 예측선, 이상치 영역, Brush 줌 등 풍부한 인터랙션 제공',
      implementation:
        '→ TimeSeriesChart(예측+이상치), MiniLineChart(서버카드 스파크라인) 구현. 수백 포인트 규모 데이터에 최적',
      version: '3.6.0',
      status: 'active',
      icon: '📊',
      tags: ['차트', 'SVG', '인터랙티브'],
      type: 'opensource',
    },
    {
      name: 'uPlot',
      category: 'ui',
      importance: 'high',
      description:
        'Canvas 기반 초고성능 시계열 차트 라이브러리. Grafana가 채택한 렌더링 엔진으로, 10,000+ 데이터 포인트도 60fps 유지. SVG 대비 10배 빠른 렌더링',
      implementation:
        '→ RealtimeChart에서 사용. pre-computed JSON → prometheus-to-uplot 변환 → Canvas 렌더링. 다크모드, 드래그 줌, auto-resize 지원',
      version: '1.6.32',
      status: 'active',
      icon: '📈',
      tags: ['Canvas', '고성능', 'Grafana급'],
      type: 'opensource',
    },
    {
      name: 'Prometheus Format',
      category: 'framework',
      importance: 'high',
      description:
        'CNCF 표준 모니터링 데이터 포맷. 라벨 기반 다차원 시계열 모델. hourly-data SSOT의 기본 네이밍으로, OTel Standard로 빌드 타임 변환되어 2-Tier 데이터 아키텍처 구성',
      implementation:
        '→ otel-data/hourly/hour-XX.json(24개, OTel-native SSOT) → MetricsProvider가 직접 소비. Resource Catalog + Timeseries로 서버 메타데이터 표준화',
      version: 'OpenMetrics',
      status: 'active',
      icon: '🔥',
      tags: ['CNCF', '시계열', 'SSOT', 'Metrics'],
      type: 'opensource',
    },
    {
      name: 'OpenTelemetry',
      category: 'framework',
      importance: 'high',
      description:
        'CNCF 관측성 표준. Prometheus 메트릭을 OTel Semantic Convention으로 변환하여 시스템 전체 데이터 일관성 확보. Resource Catalog로 서버 메타데이터 표준화',
      implementation:
        '→ otel-data/가 OTel-native SSOT. MetricsProvider(Vercel)와 precomputed-state(Cloud Run) 모두 OTel 포맷 직접 소비. Resource Catalog로 서버 메타데이터 표준화',
      version: 'Semantic Conv. 1.x',
      status: 'active',
      icon: '🔭',
      tags: ['CNCF', 'Observability', 'Semantic Convention', 'Metrics'],
      type: 'opensource',
    },
    {
      name: 'Loki Log Format',
      category: 'framework',
      importance: 'medium',
      description:
        'Grafana Loki Push API 호환 로그 구조. 라벨 기반 스트림 모델(job, hostname, level)로 구조화된 로그 생성. PLG 스택(Promtail+Loki+Grafana) 즉시 연동 가능',
      implementation:
        '→ OTel hourly JSON에 로그가 내장(slot.logs[]), 나노초 타임스탬프 + severityText + resource 속성 지원. LogsTab에서 severity 필터링 UI 제공',
      version: 'Loki 3.0+ API',
      status: 'active',
      icon: '📋',
      tags: ['Grafana', 'Logs', 'PLG Stack', 'Structured'],
      type: 'opensource',
    },
    {
      name: 'TanStack Query v5',
      category: 'framework',
      importance: 'high',
      description:
        '비동기 상태 관리 라이브러리. 서버 데이터 캐싱, 자동 리패칭, 낙관적 업데이트, 무한 스크롤, 오프라인 지원',
      implementation: '→ 서버 데이터 캐싱 및 자동 리패칭으로 API 호출 최적화',
      version: '5.x',
      status: 'active',
      icon: '🔄',
      tags: ['상태관리', '캐싱', '비동기'],
      type: 'opensource',
    },
    {
      name: 'Supabase Auth',
      category: 'framework',
      importance: 'critical',
      description:
        'Supabase 인증 서비스. OAuth, Magic Link, 이메일/비밀번호 인증 제공. Row Level Security(RLS)와 통합되어 DB 수준 보안',
      implementation: '→ SSR 패키지로 쿠키 기반 세션 관리. RLS 정책 연동',
      version: 'Auth v2',
      status: 'active',
      icon: '🔒',
      tags: ['인증', '보안', 'Supabase'],
      type: 'commercial',
    },
    {
      name: 'Tailwind CSS 4.1',
      category: 'ui',
      importance: 'high',
      description:
        '유틸리티 퍼스트 CSS 프레임워크. v4 Oxides 엔진으로 빌드 10배 향상, CSS-first 설정, 클래스 기반 스타일링',
      implementation: '→ 컴포넌트 스타일링 전체 적용. 다크 모드, 반응형 지원',
      version: '4.1.18',
      status: 'active',
      icon: '🎨',
      tags: ['UI', 'CSS', '스타일링'],
      type: 'opensource',
    },
    {
      name: 'Radix UI',
      category: 'ui',
      importance: 'high',
      description:
        '접근성 우선 Headless UI 라이브러리. 스타일 없는 프리미티브 컴포넌트로 완전한 커스터마이징 가능. WAI-ARIA 준수',
      implementation: '→ Dialog, Tooltip, Dropdown 등 복잡한 UI 패턴에 사용',
      status: 'active',
      icon: '🏬',
      tags: ['UI', '접근성', '컴포넌트'],
      type: 'opensource',
    },
    {
      name: 'Zustand 5.0',
      category: 'framework',
      importance: 'medium',
      description:
        '경량 상태 관리 라이브러리. Redux 대비 간결한 API, 미들웨어 지원, React 외부에서도 사용 가능. 번들 사이즈 1KB',
      implementation: '→ 글로벌 UI 상태 및 Admin 설정 관리에 사용',
      version: '5.0.9',
      status: 'active',
      icon: '🧰',
      tags: ['상태관리', 'Store', 'React'],
      type: 'opensource',
    },
    {
      name: 'Zod 4',
      category: 'framework',
      importance: 'high',
      description:
        'TypeScript-first 스키마 선언 및 검증 라이브러리. 런타임 타입 검증, 자동 타입 추론, 파서 조합, 커스텀 에러 메시지 지원',
      implementation:
        '→ API 응답/요청 검증, 환경변수 검증, 폼 유효성 검사에 전역 사용',
      version: '4.0',
      status: 'active',
      icon: '🛡️',
      tags: ['검증', 'TypeScript', '스키마'],
      type: 'opensource',
    },
  ],
  'vibe-coding': {
    current: [
      {
        name: 'Google Antigravity',
        category: 'ai',
        importance: 'critical',
        description:
          'Agent-first AI-powered IDE - AI 에이전트가 계획, 실행, 검증까지 자율 수행 (Google)',
        implementation:
          'Gemini 3와 함께 출시. VS Code 포크 기반으로 개발자는 아키텍트로, AI 에이전트가 실제 구현을 담당하는 새로운 패러다임. Multi-Agent 협업 지원',
        version: 'v1.0.0 (Gemini 3 Pro)',
        status: 'active',
        icon: '🌌',
        tags: ['Google', 'Agent-First', 'Gemini3', 'IDE'],
        type: 'commercial',
      },
      {
        name: 'MCP 서버',
        category: 'ai',
        importance: 'high',
        description:
          'Anthropic의 Model Context Protocol. AI가 외부 도구, 데이터 소스, API에 표준화된 방식으로 접근하는 오픈 프로토콜. 다양한 MCP 서버로 AI 기능 확장',
        implementation: `→ ${MCP_SERVERS.TOTAL_ACTIVE}개 서버 연동: vercel(배포), supabase(DB), context7(문서), playwright(E2E), next-devtools(Next.js진단), github(저장소), sequential-thinking(추론), stitch(UI디자인)`,
        status: 'active',
        icon: '🔌',
        tags: ['MCP', 'Protocol', '확장기능'],
        type: 'opensource',
      },
      {
        name: 'Claude Code',
        category: 'ai',
        importance: 'critical',
        description:
          'An agentic coding tool that lives in your terminal, understands your codebase (Anthropic)',
        implementation:
          'Helps you code faster by executing routine tasks, explaining complex code, and handling git workflows - all through natural language commands. MCP 서버로 외부 시스템 직접 제어',
        version: 'claude-opus-4-6',
        status: 'active',
        icon: '🤖',
        tags: ['Anthropic', 'Agentic', 'MCP'],
        type: 'commercial',
      },
      {
        name: 'Cross-Model AI Review',
        category: 'ai',
        importance: 'critical',
        description:
          'AI가 작성한 코드는 다른 AI 모델이 리뷰 - Single Point of Failure 방지',
        implementation:
          'Claude가 작성한 코드를 Codex/Gemini가 검토. 동일 모델의 편향(bias)과 blind spot을 다른 모델이 보완. 커밋 시 자동 트리거',
        version: 'v5.0',
        status: 'active',
        icon: '🔄',
        tags: ['Cross-Model', 'Bias방지', '자동검증'],
        type: 'custom',
      },
      {
        name: 'Codex CLI',
        category: 'ai',
        importance: 'high',
        description:
          'A lightweight coding agent that runs in your terminal (OpenAI)',
        implementation:
          'Generate, edit, and run code using natural language. ChatGPT Plus/Pro 플랜으로 사용. Claude 작성 코드의 Cross-Model 리뷰어',
        version: 'v0.63.0',
        status: 'active',
        icon: '💎',
        tags: ['OpenAI', 'Lightweight', 'ChatGPT'],
        type: 'commercial',
      },
      {
        name: 'Gemini CLI',
        category: 'ai',
        importance: 'high',
        description:
          'An open-source AI agent that brings the power of Gemini directly into your terminal (Google)',
        implementation:
          'Lightweight access to Gemini - the most direct path from prompt to model. 1M 토큰 컨텍스트로 대규모 분석. Cross-Model 리뷰어',
        version: 'v0.18.4',
        status: 'active',
        icon: '✨',
        tags: ['Google', 'OpenSource', '1M-Context'],
        type: 'opensource',
        aiType: 'google-api',
      },
      {
        name: 'Git + GitHub 통합',
        category: 'custom',
        importance: 'high',
        description: '버전 관리부터 PR까지 모든 Git 작업 자동화',
        implementation:
          'MCP GitHub 서버로 커밋, 푸시, PR 생성, 이슈 관리를 Claude Code에서 직접 자동화',
        status: 'active',
        icon: '📝',
        tags: ['Git자동화', 'CI/CD', 'GitHub통합'],
        type: 'custom',
      },
      {
        name: 'Vitest 4.0',
        category: 'testing',
        importance: 'high',
        description:
          'Vite 기반 차세대 테스트 프레임워크. Jest 호환 API, 네이티브 ESM, HMR 지원으로 초고속 테스트 실행. 워치 모드에서 변경 파일만 재실행',
        implementation:
          '→ 유닛/통합 테스트 전체 적용. Coverage 리포트 및 실시간 피드백',
        version: '4.0.16',
        status: 'active',
        icon: '🧪',
        tags: ['테스트', 'Vite', 'Jest호환'],
        type: 'opensource',
      },
      {
        name: 'Biome 2.3',
        category: 'tooling',
        importance: 'high',
        description:
          'Rust 기반 초고속 Linter + Formatter. ESLint/Prettier 통합 대체, 단일 도구로 린트와 포맷팅 동시 수행. 10배 빠른 속도',
        implementation:
          '→ 코드 스타일 자동 적용. PostToolUse hook으로 저장 시 자동 포맷',
        version: '2.3.10',
        status: 'active',
        icon: '🔧',
        tags: ['Linter', 'Formatter', 'Rust'],
        type: 'opensource',
      },
      {
        name: 'Playwright 1.57',
        category: 'testing',
        importance: 'high',
        description:
          'Microsoft의 E2E 테스트 프레임워크. Chromium/Firefox/WebKit 크로스 브라우저, 자동 대기, 트레이싱, 스크린샷 캡처 지원',
        implementation:
          '→ 크리티컬 플로우 E2E 테스트. MCP 서버로 Claude Code에서 직접 제어',
        version: '1.57.0',
        status: 'active',
        icon: '🎭',
        tags: ['E2E', 'Microsoft', '크로스브라우저'],
        type: 'opensource',
      },
    ],
    history: {
      // 1단계: 초기 - ChatGPT 기반 개별 페이지 생성
      stage1: [
        {
          name: 'ChatGPT',
          category: 'ai',
          importance: 'critical',
          description: '프로젝트 최초 시작 도구 - AI로 개별 페이지 생성',
          implementation:
            'GPT-3.5/4.0으로 HTML/CSS/JS 페이지를 개별적으로 생성. 프롬프트 기반으로 모니터링 웹 인터페이스의 기초를 구축. 각 페이지를 독립적으로 개발',
          version: 'GPT-3.5/4.0',
          status: 'history',
          icon: '🤖',
          tags: ['최초도구', '개별페이지', 'AI생성'],
          type: 'commercial',
        },
        {
          name: 'GitHub Web Interface',
          category: 'custom',
          importance: 'high',
          description: 'Git CLI 없이 웹 인터페이스로 파일 수동 업로드',
          implementation:
            '로컬에서 ChatGPT로 생성한 파일들을 GitHub 웹사이트에서 직접 업로드. 체계적인 버전 관리 없이 파일 기반 관리',
          status: 'history',
          icon: '🌐',
          tags: ['수동업로드', 'Git없음', '웹기반'],
          type: 'commercial',
        },
        {
          name: 'Netlify',
          category: 'deployment',
          importance: 'high',
          description: '최초 배포 플랫폼 - 정적 사이트 & 목업 호스팅',
          implementation:
            'GitHub 저장소와 연동하여 정적 사이트 자동 배포. 복잡한 서버 로직 없이 HTML/JS 수준의 목업을 빠르게 띄우던 용도',
          status: 'history',
          icon: '🌍',
          tags: ['정적배포', '첫배포', 'Mockup', '단순호스팅'],
          type: 'commercial',
        },
        {
          name: '기본 텍스트 에디터',
          category: 'utility',
          importance: 'medium',
          description: '로컬 개발을 위한 기본 에디터',
          implementation:
            'AI 통합 없는 기본 텍스트 에디터로 ChatGPT 생성 코드 수정. VSCode 없이 메모장 수준 편집',
          status: 'history',
          icon: '📝',
          tags: ['1단계', '수동개발', 'Copy&Paste', 'Netlify'],
          type: 'commercial',
        },
      ],

      // 2단계: 중기 - Cursor 자동 개발 시대
      stage2: [
        {
          name: 'Cursor AI (Auto Dev)',
          category: 'ai',
          importance: 'critical',
          description: '2단계 - "자동 개발"의 시작',
          implementation:
            'IDE 안에서 AI가 파일을 수정해주는 "Vibe Coding"의 탄생. 수동 복붙에서 벗어나 생산성이 비약적으로 향상된 시기',
          version: '0.42+',
          status: 'history',
          icon: '🚀',
          tags: ['2단계', '자동개발', 'Cursor', 'IDE중심'],
          type: 'commercial',
        },
        {
          name: 'Vercel + Supabase',
          category: 'deployment',
          importance: 'high',
          description: '현재까지 이어지는 인프라 표준 정립',
          implementation:
            'Cursor 시기에 도입된 이 조합(Next.js+Vercel+Supabase)은 현재 4단계 Agentic Era까지 변함없이 우리 서비스의 단단한 뼈대가 되어주고 있음',
          status: 'history',
          icon: '⚡',
          tags: ['FullStack', '핵심기반', '현재도사용중'],
          type: 'commercial',
        },
      ],

      // 3단계: 후기 - 분기점 (Pivot Point)
      stage3: [
        {
          name: 'WSL + Claude Code (Main)',
          category: 'ai',
          importance: 'critical',
          description: '3단계 핵심 - 메인 개발 환경의 이동 (IDE → WSL)',
          implementation:
            '이 시점부터 WSL 터미널이 메인 개발 스테이지가 됨. Claude Code가 등장하여 실질적인 개발을 주도하기 시작함',
          status: 'history',
          icon: '🐧',
          tags: ['3단계', 'WSL-Main', 'Claude-Code', '분기점'],
          type: 'custom',
        },
        {
          name: 'Visual Aux (Windsurf/VSCode)',
          category: 'ai',
          importance: 'medium',
          description: 'IDE의 역할 축소 - 보조 및 시각적 분석',
          implementation:
            'Windsurf와 VSCode를 사용하지만, 역할은 "보조"로 축소됨. 주로 프론트엔드 스크린샷 분석이나 단순 뷰어 역할을 담당',
          status: 'history',
          icon: '👁️',
          tags: ['IDE-Secondary', '시각분석', '보조역할'],
          type: 'commercial',
        },
      ],
    },
  },
};

/**
 * 중요도별 스타일 정보
 */
export const IMPORTANCE_STYLES = {
  critical: {
    bg: 'bg-red-500/20 border-red-500/40',
    text: 'text-red-300',
    badge: 'bg-red-500/30 text-red-200',
    label: '필수',
  },
  high: {
    bg: 'bg-orange-500/20 border-orange-500/40',
    text: 'text-orange-300',
    badge: 'bg-orange-500/30 text-orange-200',
    label: '중요',
  },
  medium: {
    bg: 'bg-blue-500/20 border-blue-500/40',
    text: 'text-blue-300',
    badge: 'bg-blue-500/30 text-blue-200',
    label: '보통',
  },
  low: {
    bg: 'bg-gray-500/20 border-gray-500/40',
    text: 'text-gray-300',
    badge: 'bg-gray-500/30 text-gray-200',
    label: '낮음',
  },
};

/**
 * 카테고리별 스타일 정보
 */
export const CATEGORY_STYLES = {
  framework: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  language: { color: 'text-green-400', bg: 'bg-green-500/10' },
  database: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ai: { color: 'text-pink-400', bg: 'bg-pink-500/10' },
  opensource: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  custom: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  deployment: { color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ui: { color: 'text-teal-400', bg: 'bg-teal-500/10' },
  utility: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  cache: { color: 'text-red-400', bg: 'bg-red-500/10' },
  testing: { color: 'text-lime-400', bg: 'bg-lime-500/10' },
  tooling: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
};
