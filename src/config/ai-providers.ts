/**
 * AI Provider Configuration (Single Source of Truth)
 *
 * @description
 * - 실제 구현 기준: cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts
 * - 에이전트별 선택 체인 기준: cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts
 * - UI에는 "현재 라우팅 정책"만 노출하며, 개별 요청의 실시간 선택 결과를 의미하지 않는다.
 * - 2026-04-15 최신화
 */

export interface AIProviderConfig {
  /** Provider 이름 */
  name: string;
  /** 역할 (Primary, Metrics Query Agent, Verifier 등) */
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

export const GROQ_TEXT_MODEL_ID =
  'meta-llama/llama-4-scout-17b-16e-instruct';
export const ZAI_TEXT_MODEL_ID = 'glm-4.5-flash';
export const ZAI_VISION_MODEL_ID = 'glm-4.6v-flash';

/**
 * 현재 활성화된 AI Provider 목록
 * - registry-core.yaml과 동기화 유지 필요
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: 'Groq',
    role: 'Groq-first text mesh',
    model: GROQ_TEXT_MODEL_ID,
    description:
      'Fast text provider for Supervisor, Metrics Query, Orchestrator, and fallback paths',
    color: 'bg-purple-500',
  },
  {
    name: 'Z.AI',
    role: 'Free GLM Flash fallback',
    model: `${ZAI_TEXT_MODEL_ID} / ${ZAI_VISION_MODEL_ID}`,
    description:
      'Free GLM Flash text and vision fallback. Runtime disables thinking for short tool-calling and structured-output tasks.',
    color: 'bg-cyan-500',
  },
  {
    name: 'Cerebras',
    role: 'Short-context text fallback',
    model: 'llama3.1-8b',
    description:
      'Production Cerebras runtime retained until 2026-05-27 deprecation, used only where context and quota allow.',
    color: 'bg-blue-500',
    dailyTokenLimit: '1M tokens/day',
  },
  {
    name: 'Mistral',
    role: 'Distributed text fallback',
    model: 'mistral-small-latest',
    description:
      'Free-tier friendly text provider used as first/secondary fallback for selected agent paths.',
    color: 'bg-amber-500',
  },
  {
    name: 'Gemini',
    role: 'Vision primary',
    model: 'gemini-2.5-flash-lite',
    description: 'Primary vision provider for screenshot and multimodal analysis',
    color: 'bg-emerald-500',
  },
  {
    name: 'OpenRouter',
    role: 'Vision fallback',
    model: 'free vision model',
    description: 'OpenRouter free-model fallback for screenshot and multimodal analysis',
    color: 'bg-sky-500',
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
