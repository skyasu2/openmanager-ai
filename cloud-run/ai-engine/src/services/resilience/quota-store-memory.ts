import {
  getQuotaUsageScope,
  type ProviderName,
  type ProviderUsage,
} from './quota-types';

const inMemoryUsage = new Map<string, ProviderUsage>();
const inMemoryCooldowns = new Map<string, { until: number; reason: string }>();
const usageLocks = new Map<string, Promise<void>>();

export function getDefaultUsage(): ProviderUsage {
  const now = Date.now();
  return {
    dailyTokens: 0,
    dailyRequests: 0,
    minuteRequests: 0,
    minuteTokens: 0,
    lastUpdated: now,
    lastMinuteReset: now,
    date: new Date().toISOString().split('T')[0],
  };
}

export function normalizeUsage(value: unknown): ProviderUsage {
  const source = value && typeof value === 'object'
    ? value as Partial<ProviderUsage>
    : {};
  const fallback = getDefaultUsage();

  return {
    dailyTokens: Number(source.dailyTokens ?? 0),
    dailyRequests: Number(source.dailyRequests ?? 0),
    minuteRequests: Number(source.minuteRequests ?? 0),
    minuteTokens: Number(source.minuteTokens ?? 0),
    lastUpdated: Number(source.lastUpdated ?? fallback.lastUpdated),
    lastMinuteReset: Number(source.lastMinuteReset ?? fallback.lastMinuteReset),
    date: String(source.date ?? fallback.date),
  };
}

export function getMemoryUsage(
  provider: ProviderName,
  modelId?: string
): ProviderUsage | undefined {
  return inMemoryUsage.get(getQuotaUsageScope(provider, modelId));
}

export function setMemoryUsage(
  provider: ProviderName,
  usage: ProviderUsage,
  modelId?: string
): void {
  inMemoryUsage.set(getQuotaUsageScope(provider, modelId), usage);
}

export function getMemoryCooldown(
  provider: ProviderName,
  modelId?: string
): { until: number; reason: string } | null {
  const key = getQuotaUsageScope(provider, modelId);
  const cooldown = inMemoryCooldowns.get(key);
  if (!cooldown) return null;

  if (cooldown.until > Date.now()) {
    return cooldown;
  }

  inMemoryCooldowns.delete(key);
  return null;
}

export function setMemoryCooldown(
  provider: ProviderName,
  cooldown: { until: number; reason: string },
  modelId?: string
): void {
  inMemoryCooldowns.set(getQuotaUsageScope(provider, modelId), cooldown);
}

export function deleteMemoryCooldown(
  provider: ProviderName,
  modelId?: string
): void {
  inMemoryCooldowns.delete(getQuotaUsageScope(provider, modelId));
}

export async function withUsageLock<T>(
  provider: ProviderName,
  modelId: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  const usageScope = getQuotaUsageScope(provider, modelId);
  const previous = usageLocks.get(usageScope) ?? Promise.resolve();
  let release!: () => void;
  const current = previous.then(
    () => new Promise<void>((resolve) => {
      release = resolve;
    })
  );

  usageLocks.set(usageScope, current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (usageLocks.get(usageScope) === current) {
      usageLocks.delete(usageScope);
    }
  }
}
