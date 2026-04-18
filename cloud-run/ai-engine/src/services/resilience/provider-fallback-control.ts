import { logger } from '../../lib/logger';

export interface ProviderFallbackControlConfig {
  fallbackDelayMs: number;
  fallbackJitterMs: number;
  retryBudgetPerMinute: number;
}

export const DEFAULT_PROVIDER_FALLBACK_CONTROL: ProviderFallbackControlConfig =
  {
    fallbackDelayMs: 150,
    fallbackJitterMs: 250,
    retryBudgetPerMinute: 120,
  };

const RETRY_BUDGET_WINDOW_MS = 60_000;
let retryBudgetWindowStart = Date.now();
let retryBudgetConsumed = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getProviderFallbackDelay(
  config: Pick<ProviderFallbackControlConfig, 'fallbackDelayMs' | 'fallbackJitterMs'>
): number {
  const jitter = Math.floor(
    Math.random() * Math.max(0, config.fallbackJitterMs + 1)
  );
  return Math.max(0, config.fallbackDelayMs + jitter);
}

export function consumeProviderRetryBudget(
  config: Pick<ProviderFallbackControlConfig, 'retryBudgetPerMinute'>,
  reason: string,
  context = 'ProviderFallback'
): boolean {
  const now = Date.now();
  if (now - retryBudgetWindowStart >= RETRY_BUDGET_WINDOW_MS) {
    retryBudgetWindowStart = now;
    retryBudgetConsumed = 0;
  }

  if (retryBudgetConsumed >= config.retryBudgetPerMinute) {
    logger.warn(
      `[${context}] Retry budget exhausted (${retryBudgetConsumed}/${config.retryBudgetPerMinute}) reason=${reason}`
    );
    return false;
  }

  retryBudgetConsumed += 1;
  return true;
}

export async function waitBeforeProviderFallback(
  config: Pick<ProviderFallbackControlConfig, 'fallbackDelayMs' | 'fallbackJitterMs'>,
  context: string,
  metadata?: string
): Promise<number> {
  const delay = getProviderFallbackDelay(config);
  logger.debug(
    `[${context}] Provider fallback delay ${delay}ms${metadata ? ` (${metadata})` : ''}`
  );
  await sleep(delay);
  return delay;
}

export function __resetProviderRetryBudgetForTests(): void {
  retryBudgetWindowStart = Date.now();
  retryBudgetConsumed = 0;
}
