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
      '→ Orchestrator Planning + Verifier 1순위 모델. 복잡한 작업 분해 및 최종 응답 품질 검증 담당. qwen-3-235b-a22b-instruct-2507 고성능 모델 활용',
    version: 'Qwen 3 235B A22B',
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
      '→ NLQ + Analyst + Tool-calling 1순위 모델. 고도의 도구 실행력으로 실시간 메트릭 조회 및 이상 분석 전담',
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
      '프랑스 AI 스타트업의 효율적인 오픈웨이트 LLM. 24B 파라미터의 Small Language Model로 대형 모델 대비 낮은 비용과 빠른 응답 속도 제공',
    implementation:
      '→ Advisor Agent 1순위. 복잡한 인프라 트러블슈팅 추론 및 GraphRAG 기반 지식 탐색 품질 최적화 담당',
    version: 'mistral-large-latest',
    status: 'active',
    icon: '🛡️',
    tags: ['Reasoning', 'Frontier', '오픈웨이트'],
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
      'Vercel이 개발한 AI 애플리케이션 프레임워크. streamText, generateObject API를 통해 지능형 멀티 에이전트 워크플로우와 스트리밍 응답 제공',
    implementation:
      '고도화된 Multi-Agent Handoff 아키텍처 기반의 5-Agent 시스템 구축. Orchestrator Planning을 통한 질문 유형별 최적 에이전트 라우팅 구현',
    version: '6.0',
    status: 'active',
    icon: '▲',
    tags: ['AI SDK', 'Streaming', 'Multi-Agent', 'Orchestration'],
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
];
