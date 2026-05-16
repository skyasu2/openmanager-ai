import {
  getCerebrasFallbackModelIds,
  getCerebrasModelId,
} from '../../lib/config-parser';
import {
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  getCerebrasModelPolicy,
  type CerebrasRuntimeModelId,
} from '../ai-sdk/provider-model-policy';

/*
 * CEREBRAS DEPRECATION 2026-05-27
 * After this date llama3.1-8b is expected to be unavailable.
 * Fallback chain degrades to:
 *   Cerebras-first paths: Groq -> Z.AI -> Mistral
 * Effective primary remains Groq, but Z.AI provides a free Flash buffer.
 * Action: confirm replacement model entitlement before this date.
 */

/** LLM Provider 이름 (모델 선택용) */
export type LLMProviderName =
  | 'cerebras'
  | 'groq'
  | 'mistral'
  | 'zai'
  | 'gemini';

/** 전체 Provider 이름 (LLM + 외부 API) */
export type ProviderName = LLMProviderName | 'tavily';

export interface ProviderQuota {
  dailyTokenLimit: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
}

export type CerebrasQuotaModelId = CerebrasRuntimeModelId;

export interface ProviderUsage {
  dailyTokens: number;
  dailyRequests: number;
  minuteRequests: number;
  minuteTokens: number;
  lastUpdated: number;
  lastMinuteReset: number;
  date: string;
}

export interface QuotaStatus {
  provider: ProviderName;
  usage: ProviderUsage;
  quota: ProviderQuota;
  dailyTokenUsageRate: number;
  dailyRequestUsageRate: number;
  minuteRequestUsageRate: number;
  minuteTokenUsageRate: number;
  shouldPreemptiveFallback: boolean;
  recommendedWaitMs?: number;
}

export type QuotaAdmissionReason =
  | 'cooldown'
  | 'daily_token_limit'
  | 'daily_request_limit'
  | 'minute_request_limit'
  | 'minute_token_limit'
  | 'daily_token_threshold'
  | 'daily_request_threshold'
  | 'minute_request_threshold'
  | 'minute_token_threshold';

export interface ProviderQuotaReservation {
  reserved: boolean;
  provider: ProviderName;
  modelId?: string;
  estimatedTokens: number;
  status: QuotaStatus;
  reason?: QuotaAdmissionReason;
  cooldownUntil?: number;
  recommendedWaitMs?: number;
}

function quotaFromModelPolicy(modelId: CerebrasQuotaModelId): ProviderQuota {
  const quota = getCerebrasModelPolicy(modelId).quota;
  return {
    dailyTokenLimit: quota.tokensPerDay,
    requestsPerMinute: quota.requestsPerMinute,
    tokensPerMinute: quota.tokensPerMinute,
    requestsPerDay: quota.requestsPerDay,
  };
}

export const CEREBRAS_MODEL_QUOTAS: Record<CerebrasQuotaModelId, ProviderQuota> = {
  /**
   * Account Limits screen 기준. 공식 Free tier 표보다 계정별 제한을 우선한다.
   */
  [CEREBRAS_LLAMA_FALLBACK_MODEL_ID]: quotaFromModelPolicy(
    CEREBRAS_LLAMA_FALLBACK_MODEL_ID
  ),
};

export const PROVIDER_QUOTAS: Record<ProviderName, ProviderQuota> = {
  /**
   * Cerebras default production model quota. Use getQuotaForProvider(provider, modelId)
   * for model-aware fallback checks.
   * @see https://inference-docs.cerebras.ai/support/rate-limits
   * @updated 2026-04-30
   *
   * - llama3.1-8b account limit: 1M TPD, 30K TPM, 5 RPM, 2.4K RPD
   * - Context/capability lives in provider-model-metadata; this tracker only enforces usage quotas.
   */
  cerebras: CEREBRAS_MODEL_QUOTAS[CEREBRAS_LLAMA_FALLBACK_MODEL_ID],
  /**
   * Groq Free Tier (meta-llama/llama-4-scout-17b-16e-instruct)
   * @see https://console.groq.com/docs/rate-limits
   * @updated 2026-04-25 - Scout limit metadata refreshed against Groq docs
   *
   * - 500K TPD, 30K TPM, 30 RPM, 1K RPD
   * - Context: 131K tokens
   */
  groq: {
    dailyTokenLimit: 500_000,
    requestsPerMinute: 30,
    tokensPerMinute: 30_000,
    requestsPerDay: 1_000,
  },
  mistral: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 50,
    tokensPerMinute: 50_000,
    requestsPerDay: 500,
  },
  /**
   * Z.AI GLM Flash free models.
   * Official pricing marks glm-4.5-flash and glm-4.6v-flash as free.
   * Rate limits are concurrency/account-plan based, so use a conservative
   * local guard until an authenticated limits endpoint exposes fixed values.
   */
  zai: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 5,
    tokensPerMinute: 30_000,
    requestsPerDay: 500,
  },
  /**
   * Gemini 2.5 Flash-Lite (Vision Agent, default as of 2026-04-04)
   * @see https://ai.google.dev/gemini-api/docs/models/gemini
   * @updated 2026-04-04 - Flash → Flash-Lite 전환
   *   이유: flash는 thinking 토큰을 기본 소비(~24+/req) → max_tokens 낮으면 content 공백
   *         flash-lite는 thinking 없음, RPD 2배(1,000), RPM 1.5배(15)로 더 유리
   *
   * Free Tier Limits (gemini-2.5-flash-lite):
   * - 1,000 RPD, 15 RPM
   * - 250,000 TPM
   * Override: GEMINI_VISION_MODEL_ID=gemini-2.5-flash 로 flash 복귀 가능
   */
  gemini: {
    dailyTokenLimit: 250_000 * 60 * 24,
    requestsPerMinute: 15,
    tokensPerMinute: 250_000,
    requestsPerDay: 1_000,
  },
  /**
   * Tavily Web Search API
   * @see https://tavily.com/#pricing
   * @added 2026-02-01
   *
   * Free Tier Limits:
   * - 1,000 requests/month
   * - No RPM limit (but Circuit Breaker로 보호)
   * - Token 개념 없음 (request 단위 과금)
   */
  tavily: {
    dailyTokenLimit: Number.MAX_SAFE_INTEGER,
    requestsPerMinute: 30,
    tokensPerMinute: Number.MAX_SAFE_INTEGER,
    requestsPerDay: 33,
  },
};

export function getQuotaForProvider(
  provider: ProviderName,
  modelId?: string
): ProviderQuota {
  if (provider !== 'cerebras') {
    return PROVIDER_QUOTAS[provider];
  }

  const effectiveModelId = modelId || getCerebrasModelId();
  if (effectiveModelId === CEREBRAS_LLAMA_FALLBACK_MODEL_ID) {
    return CEREBRAS_MODEL_QUOTAS[effectiveModelId];
  }

  return CEREBRAS_MODEL_QUOTAS[CEREBRAS_LLAMA_FALLBACK_MODEL_ID];
}

export function getQuotaModelCandidates(
  provider: LLMProviderName
): (string | undefined)[] {
  if (provider !== 'cerebras') return [undefined];

  return [
    getCerebrasModelId(),
    ...getCerebrasFallbackModelIds(),
  ].filter((modelId, index, list) => modelId && list.indexOf(modelId) === index);
}

export function getQuotaUsageScope(
  provider: ProviderName,
  modelId?: string
): string {
  if (provider !== 'cerebras') return provider;

  const effectiveModelId = modelId || getCerebrasModelId();
  return `cerebras:${effectiveModelId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export const PREEMPTIVE_THRESHOLDS = {
  dailyTokenThreshold: 0.8,
  dailyRequestThreshold: 0.85,
  minuteRequestThreshold: 0.85,
  minuteTokenThreshold: 0.85,
  safetyMarginMs: 2000,
} as const;

export const PROVIDER_COOLDOWN_MS = 90_000;
