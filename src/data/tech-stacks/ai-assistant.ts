import type { TechItem } from '@/types/feature-card.types';

export const AI_ASSISTANT_TECH_STACK: TechItem[] = [
  // ========== AI Providers (기술 소개) ==========
  {
    name: 'Cerebras Inference',
    category: 'ai',
    importance: 'critical',
    description:
      '세계 최대 AI 칩 Wafer-Scale Engine(WSE-3) 기반 추론 서비스. 850,000개 코어가 단일 웨이퍼에 집적되어 GPU 클러스터의 통신 병목 없이 초고속 추론 제공',
    implementation:
      '→ 짧은 routing/context/evidence-classifier 같은 structured-output analysis pool 선두 후보. 일반 답변/tool-loop text rotation에서는 제외',
    version: 'gpt-oss-120b',
    status: 'active',
    icon: '🧠',
    tags: ['WSE-3', 'Planning', '웨이퍼스케일'],
    type: 'commercial',
  },
  {
    name: 'Groq Cloud',
    category: 'ai',
    importance: 'critical',
    description:
      'LPU(Language Processing Unit) 기반 초고속 추론 인프라. GPU 대비 일관된 응답 속도와 낮은 지연시간으로 500 Tokens/s 속도 제공',
    implementation:
      '→ text pool fallback 및 agent 정책별 tool-calling 경로. 높은 도구 실행력으로 실시간 메트릭 조회와 이상 분석을 보조',
    version: 'Llama 4 Scout (17B)',
    status: 'active',
    icon: '⚡',
    tags: ['LPU', 'Tool-calling', '초고속'],
    type: 'commercial',
  },
  {
    name: 'Mistral AI',
    category: 'ai',
    importance: 'high',
    description:
      '프랑스 AI 스타트업의 효율적인 오픈웨이트 LLM. 무료 티어 보호를 위해 Large 대신 Small 계열을 text fallback 기본값으로 사용',
    implementation:
      '→ 일반 답변/tool-loop text pool 구성원. 내부 지식 검색 runtime과 임베딩 경로에서는 제외',
    version: 'mistral-small-latest',
    status: 'active',
    icon: '🛡️',
    tags: ['Text Fallback', 'Free-tier', '오픈웨이트'],
    type: 'commercial',
  },
  {
    name: 'Gemini 2.5 Flash-Lite',
    category: 'ai',
    importance: 'high',
    description:
      'Google의 고효율 멀티모달 AI 모델. 사고 토큰 소비 없는 안정적 추론과 1M 토큰 컨텍스트, 이미지 분석, 실시간 웹 검색 지원',
    implementation:
      '→ Vision Agent 전용. 대시보드 스크린샷 분석, 1M 컨텍스트 기반 대용량 로그 분석 담당. 할당량(RPD 1,000) 최적화로 안정적 운영 보장',
    version: 'gemini-2.5-flash-lite',
    status: 'active',
    icon: '👁️',
    tags: ['Vision', '1M-Context', 'Cost-Efficient'],
    type: 'commercial',
  },

  // ========== Framework & SDK ==========
  {
    name: 'Vercel AI SDK',
    category: 'ai',
    importance: 'critical',
    description:
      'Vercel이 개발한 AI 애플리케이션 프레임워크. generateText + Output.object와 streamText를 통해 tool-calling LLM 응답, structured output, 스트리밍을 제공',
    implementation:
      'deterministic/single-first 런타임을 기본값으로 두고, RCA/report/advisor/vision 같은 복잡 질의만 5개 라우팅 에이전트로 escalation',
    version: '6.0',
    status: 'active',
    icon: '▲',
    tags: ['AI SDK', 'Streaming', 'Tool Calling', 'Decision Layer'],
    type: 'opensource',
  },
  // ========== Database & Internal Knowledge ==========
  {
    name: 'Supabase Postgres',
    category: 'database',
    importance: 'high',
    description:
      'PostgreSQL Full Text Search 기반 운영 지식 검색 인덱스. 원본 지식은 repo 문서/seed JSON에 두고 Supabase는 재생성 가능한 serving index로 사용',
    implementation:
      '운영 runbook, 장애 사례, 토폴로지 문서를 knowledge_base에 materialize하고 search_knowledge_text RPC로 검색',
    version: 'PostgreSQL 17 + FTS RPC',
    status: 'active',
    icon: '🐘',
    tags: ['Postgres FTS', 'Internal Knowledge', 'Metadata Boost'],
    type: 'commercial',
  },
  {
    name: 'Knowledge Retrieval Lite',
    category: 'ai',
    importance: 'high',
    description:
      'PostgreSQL Full Text Search와 metadata boost를 결합한 경량 지식 검색 계층. 외부 검색 SaaS나 graph runtime 없이 직접 구성',
    implementation:
      'Supabase search_knowledge_text RPC + 메타데이터 부스트로 검색 흐름을 구성. Reporter/Advisor Agent의 searchKnowledgeBase 도구로 연결',
    version: 'In-house',
    status: 'active',
    icon: '🔍',
    tags: ['BM25', 'Metadata Boost', 'Knowledge Retrieval'],
    type: 'custom',
  },
  // ========== ML Engine ==========
  {
    name: 'Custom Monitoring ML (TypeScript)',
    category: 'ai',
    importance: 'high',
    description:
      '경량 커스텀 이상 탐지 계층. 이동평균과 표준편차 기반 통계 탐지로 실시간 응답성과 설명 가능성을 우선한 운영형 ML 구현',
    implementation:
      '→ Analyst Agent에서 사용. SimpleAnomalyDetector로 이상 신호를 빠르게 감지하고 보고서 생성 파이프라인에 연결',
    version: 'In-house',
    status: 'active',
    icon: '🧪',
    tags: ['Custom-ML', '이상탐지', '저지연', '설명가능성'],
    type: 'custom',
  },
  {
    name: 'Trend Predictor (Enhanced)',
    category: 'ai',
    importance: 'medium',
    description:
      '선형 회귀 기반 추세 예측에 임계값 도달/복귀 ETA 계산을 결합한 확장 모듈. 운영자가 선제 대응 시점을 판단할 수 있도록 보조',
    implementation:
      '→ TrendPredictor + TrendPredictor.enhanced 경로에서 사용. 상승/하락 추세와 임계값 이벤트 시점을 함께 제공',
    version: 'Custom',
    status: 'active',
    icon: '📈',
    tags: ['시계열', '선형회귀', 'ETA'],
    type: 'custom',
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
      'Serverless Redis 서비스. 짧게 유지되는 카운터와 상태를 빠르게 읽고 써서 AI 호출 흐름을 조율',
    implementation:
      '→ 요청 제한, AI 제공자별 쿼터/쿨다운, AI job 중복 방지, Langfuse 사용량 카운터, 일부 단기 cache/session 상태에 사용. 무료 티어 500K commands/month',
    status: 'active',
    icon: '⚡',
    tags: ['Redis', 'RateLimit', 'Quota', 'Jobs'],
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
];
