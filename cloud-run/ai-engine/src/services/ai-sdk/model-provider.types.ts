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
