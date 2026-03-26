/**
 * AI Provider Configuration (Single Source of Truth)
 *
 * @description
 * - 실제 구현 기준: cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts
 * - UI 및 문서에서 동일한 소스 참조
 * - 2025-12-30 최신화
 */

export interface AIProviderConfig {
  /** Provider 이름 */
  name: string;
  /** 역할 (Primary, NLQ Agent, Verifier 등) */
  role: string;
  /** 모델명 */
  model: string;
  /** 설명 */
  description: string;
  /** UI 표시 색상 */
  color: string;
  /** 일일 토큰 한도 (있는 경우) */
  dailyTokenLimit?: string;
}

/**
 * 현재 활성화된 AI Provider 목록
 * - registry-core.yaml과 동기화 유지 필요
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: 'Cerebras',
    role: 'Supervisor/NLQ/Verifier',
    model: 'gpt-oss-120b',
    description: 'Primary reasoning, routing, and RAG-LLM tasks',
    color: 'bg-blue-500',
    dailyTokenLimit: '24M tokens/day',
  },
  {
    name: 'Groq',
    role: 'Analyst/Reporter',
    model: 'llama-3.3-70b-versatile',
    description: 'Fast analysis and incident report generation',
    color: 'bg-purple-500',
  },
  {
    name: 'Mistral',
    role: 'Advisor/Fallback',
    model: 'mistral-large-latest',
    description: 'Operational guidance, fallback, and embedding support',
    color: 'bg-amber-500',
  },
];

/**
 * Provider 이름으로 설정 찾기
 */
function getProviderConfig(name: string): AIProviderConfig | undefined {
  return AI_PROVIDERS.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * 기본 Provider 상태 목록 생성 (UI용)
 */
function getDefaultProviderStatus() {
  return AI_PROVIDERS.map((p) => ({
    name: p.name,
    role: p.role,
    status: 'active' as const,
    color: p.color,
  }));
}
