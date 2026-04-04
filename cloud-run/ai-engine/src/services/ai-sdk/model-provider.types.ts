export type ProviderName = 'cerebras' | 'groq' | 'mistral' | 'gemini' | 'openrouter';

export interface ProviderStatus {
  cerebras: boolean;
  groq: boolean;
  mistral: boolean;
  gemini: boolean;
  openrouter: boolean;
}

export interface ProviderHealth {
  provider: ProviderName;
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

/**
 * Model capabilities registry
 * 중앙 집중식 모델 기능 명세 (2026-04-04 v1.0)
 */
export interface ModelCapabilities {
  /** 툴 호출(Function Calling) 지원 여부 */
  supportsToolCalling: boolean;
  /** 구조화된 출력(Structured Output / generateObject) 지원 여부 */
  supportsStructuredOutput: boolean;
  /** 멀티모달(Vision) 지원 여부 */
  supportsVision: boolean;
  /** 긴 컨텍스트 지원 여부 (예: > 128K) */
  supportsLongContext: boolean;
}
