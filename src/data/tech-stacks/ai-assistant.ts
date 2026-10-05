import type { TechItem } from '@/types/feature-card.types';

export const AI_ASSISTANT_TECH_STACK: TechItem[] = [
  // ========== AI Providers (기술 소개) ==========
  {
    name: 'Cerebras Inference',
    category: 'ai',
    importance: 'critical',
    description: '웨이퍼 스케일 칩(WSE-3) 기반 추론 서비스',
    implementation:
      '→ 라우팅·근거 판정처럼 짧은 분류 응답 전용. production에서 tool-calling을 기본 비활성화해 일반 답변 pool에서는 제외',
    version: 'gpt-oss-120b',
    status: 'active',
    icon: '🧠',
    tags: ['WSE-3', '분류 전용', '웨이퍼스케일'],
    type: 'commercial',
  },
  {
    name: 'Groq Cloud',
    category: 'ai',
    importance: 'critical',
    description: 'LPU 전용 칩 기반 추론 서비스',
    implementation:
      '→ 일반 답변 fallback과 도구 호출 경로. 런타임 쿼터 가드로 호출량 관리',
    version: 'GPT-OSS 20B',
    status: 'active',
    icon: '⚡',
    tags: ['LPU', 'Tool-calling', '초고속'],
    type: 'commercial',
  },
  {
    name: 'Mistral AI',
    category: 'ai',
    importance: 'high',
    description: '프랑스 Mistral의 오픈웨이트 LLM',
    implementation: '→ 일반 답변과 도구 루프. Large 대신 Small 계열 사용',
    version: 'mistral-small-latest',
    status: 'active',
    icon: '🛡️',
    tags: ['Text Fallback', 'Free-tier', '오픈웨이트'],
    type: 'commercial',
  },
  {
    name: 'Z.AI',
    category: 'ai',
    importance: 'high',
    description: 'GLM Flash 계열 무료 텍스트 추론',
    implementation:
      '→ 일반 답변과 분석 pool. 선택적 두 번째 키는 분석 쿼터 버킷으로만 추적하고 Vision은 Gemini 전용',
    version: 'glm-4.7-flash',
    status: 'active',
    icon: '✨',
    tags: ['Text Pool', 'Free-tier', 'GLM Flash'],
    type: 'commercial',
  },
  {
    name: 'Gemini 3.5 Flash-Lite',
    category: 'ai',
    importance: 'high',
    description: 'Google의 경량 멀티모달 모델',
    implementation: '→ Vision Agent 전용. 스크린샷과 긴 로그 분석',
    version: 'gemini-3.5-flash-lite',
    status: 'active',
    icon: '👁️',
    tags: ['Vision', 'Multimodal', 'Cost-Efficient'],
    type: 'commercial',
  },

  // ========== Framework & SDK ==========
  {
    name: 'Vercel AI SDK',
    category: 'ai',
    importance: 'critical',
    description: 'LLM 호출·스트리밍·structured output을 다루는 프레임워크',
    implementation:
      '→ 모든 LLM 호출과 응답 스트리밍. 단순 조회는 고정 경로로 처리하고 복잡한 질의만 전문 에이전트로 넘김',
    version: '7.0',
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
    description: 'PostgreSQL 관리형 데이터베이스',
    implementation:
      '→ 운영 지식 검색 인덱스. 원본은 repo 문서/seed JSON에 두고 Supabase는 다시 만들 수 있는 검색용 사본',
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
    description: '직접 만든 경량 지식 검색 계층',
    implementation:
      '→ 운영 runbook·장애 이력·토폴로지 검색. Postgres 전문검색 + 메타데이터 부스트로 구성하고 외부 검색 SaaS는 쓰지 않음',
    version: 'In-house',
    status: 'active',
    icon: '🔍',
    tags: ['Postgres FTS', 'ts_rank', 'Metadata Boost'],
    type: 'custom',
  },
  // ========== Deterministic monitoring signals ==========
  {
    name: 'Threshold & Trend Signal (TypeScript)',
    category: 'ai',
    importance: 'low',
    description: '임계값·통계 밴드·단기 선형 추세 신호',
    implementation:
      '→ 이동평균/표준편차와 임계 거리로 이상 신호를 만들고, 선형 투영으로 임계 도달 ETA를 계산. 학습형 ML·GCP 모델 서빙은 Free Tier 용량 때문에 쓰지 않음',
    version: 'In-house',
    status: 'active',
    icon: '🧪',
    tags: ['임계값', '통계밴드', '선형추세', '설명가능성'],
    type: 'custom',
  },
  {
    name: 'Trend Predictor (Enhanced)',
    category: 'ai',
    importance: 'low',
    description: '직접 만든 추세 예측 모듈',
    implementation:
      '→ 선형 회귀로 상승·하락 추세와 임계값 도달 시점을 계산해 선제 대응 판단을 보조',
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
    importance: 'low',
    description: 'LLM 호출 추적·관측성 플랫폼',
    implementation:
      '→ 호출 추적과 provider fallback 지표 수집. 프롬프트 관리 기능은 쓰지 않음',
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
    description: 'Serverless Redis',
    implementation:
      '→ 요청 제한, provider별 쿼터·쿨다운, AI 작업 중복 실행 방지',
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
    description: 'Google Cloud의 서버리스 컨테이너 플랫폼',
    implementation:
      '→ AI Engine 실행. 도쿄 리전(asia-northeast1), 요청이 없으면 0으로 축소',
    version: 'asia-northeast1',
    status: 'active',
    icon: '☁️',
    tags: ['Serverless', 'Container', 'Auto-scale'],
    type: 'commercial',
  },
];
