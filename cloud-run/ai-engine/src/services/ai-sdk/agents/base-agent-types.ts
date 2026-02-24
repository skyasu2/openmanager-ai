export interface ImageAttachment {
  data: string;
  mimeType: string;
  name?: string;
}

export interface FileAttachment {
  data: string;
  mimeType: string;
  name?: string;
}

export interface AgentResult {
  text: string;
  success: boolean;
  toolsCalled: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    provider: string;
    modelId: string;
    durationMs: number;
    steps: number;
    responseChars: number;
    formatCompliance: boolean;
    qualityFlags: string[];
    latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
    finishReason?: string;
    fallbackUsed?: boolean;
    fallbackReason?: string;
  };
  error?: string;
}

export interface AgentRunOptions {
  timeoutMs?: number;
  maxSteps?: number;
  temperature?: number;
  maxOutputTokens?: number;
  webSearchEnabled?: boolean;
  sessionId?: string;
  images?: ImageAttachment[];
  files?: FileAttachment[];
}

export interface AgentStreamEvent {
  type: 'text_delta' | 'tool_call' | 'step_finish' | 'done' | 'error' | 'warning';
  data: unknown;
}

export const DEFAULT_OPTIONS: Required<
  Omit<AgentRunOptions, 'sessionId' | 'images' | 'files'>
> = {
  timeoutMs: 45_000,
  maxSteps: 10,
  temperature: 0.4,
  maxOutputTokens: 2048,
  webSearchEnabled: true,
};

export const VISION_AGENT_NAME = 'Vision Agent' as const;
export const OPENROUTER_VISION_MIN_OUTPUT_TOKENS = 256;
export const VISION_EMPTY_RESPONSE_FALLBACK =
  '비전 분석 모델 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.';
export const GENERIC_EMPTY_RESPONSE_FALLBACK =
  'AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.';
