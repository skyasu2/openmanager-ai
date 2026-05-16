import {
  markProviderQuotaCooldown,
  reconcileProviderQuotaReservation,
  reserveProviderQuota,
  type LLMProviderName,
  type ProviderQuotaReservation,
} from '../resilience/quota-tracker';

const APPROX_CHARS_PER_TOKEN = 4;

export type { ProviderQuotaReservation };

function estimateSerializedLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  return (JSON.stringify(value) ?? '').length;
}

export function isQuotaTrackedProvider(
  provider: string
): provider is LLMProviderName {
  return (
    provider === 'cerebras' ||
    provider === 'groq' ||
    provider === 'mistral' ||
    provider === 'zai' ||
    provider === 'gemini'
  );
}

export function classifyRateLimitLikeProviderError(
  errorMessage: string
): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('too_many_requests') ||
    normalized.includes('queue_exceeded') ||
    normalized.includes('high traffic')
  );
}

export function estimateSerializedQuotaTokens(
  values: unknown[],
  maxOutputTokens: number
): number {
  const inputChars = values.reduce<number>(
    (total, value) => total + estimateSerializedLength(value),
    0
  );
  return Math.ceil(inputChars / APPROX_CHARS_PER_TOKEN) + maxOutputTokens;
}

export function estimateContentQuotaTokens(
  contents: Array<string | unknown>,
  maxOutputTokens: number
): number {
  const inputChars = contents.reduce<number>((total, content) => {
    return total + estimateSerializedLength(content);
  }, 0);

  return Math.ceil(inputChars / APPROX_CHARS_PER_TOKEN) + maxOutputTokens;
}

export async function reserveStreamQuota(
  provider: string,
  modelId: string,
  estimatedTokens: number
): Promise<ProviderQuotaReservation | null> {
  if (!isQuotaTrackedProvider(provider)) return null;
  return reserveProviderQuota(provider, estimatedTokens, modelId);
}

export async function reconcileStreamQuota(
  reservation: ProviderQuotaReservation | null,
  actualTokensUsed: number
): Promise<void> {
  await reconcileProviderQuotaReservation(reservation, actualTokensUsed);
}

export async function markStreamProviderCooldown(
  provider: string,
  modelId: string,
  errorMessage: string
): Promise<void> {
  if (!isQuotaTrackedProvider(provider)) return;
  if (!classifyRateLimitLikeProviderError(errorMessage)) return;
  await markProviderQuotaCooldown(provider, modelId, errorMessage);
}
