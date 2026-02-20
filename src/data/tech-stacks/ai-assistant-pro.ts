import type { TechItem } from '@/types/feature-card.types';

export const AI_ASSISTANT_PRO_TECH_STACK: TechItem[] = [
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
];
