import type { VercelTier } from './config-schema';

export const parseOptionalIntEnv = (key: string): number | null => {
  const raw = process.env[key];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parseOptionalDecimalEnv = (key: string): number | null => {
  const raw = process.env[key];
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parseOptionalBooleanEnv = (key: string): boolean | null => {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
};

export const parseStringListEnv = (key: string): string[] | null => {
  const raw = process.env[key];
  if (!raw) return null;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

export const parseNumericWithDefault = <T extends number>(
  key: string,
  fallback: T,
  validate: (value: number) => boolean,
): T => {
  const parsed = parseOptionalIntEnv(key);
  return parsed === null || !validate(parsed) ? fallback : (parsed as T);
};

export const parseDecimalWithDefault = <T extends number>(
  key: string,
  fallback: T,
  validate: (value: number) => boolean,
): T => {
  const parsed = parseOptionalDecimalEnv(key);
  return parsed === null || !validate(parsed) ? fallback : (parsed as T);
};

export const parseTier = (rawTier?: string, rawPlan?: string): VercelTier => {
  const tier = rawTier?.toLowerCase();
  const plan = rawPlan?.toLowerCase();

  if (tier === 'free' || tier === 'hobby' || tier === 'pro') {
    return tier === 'pro' ? 'pro' : 'free';
  }

  if (plan === 'free' || plan === 'hobby') {
    return 'free';
  }

  if (plan === 'pro' || plan === 'enterprise' || plan === 'ent') {
    return 'pro';
  }

  return 'free';
};

export const clampTimeoutEnv = (
  value: number,
  min = 1_000,
  max = 60_000,
): number => {
  return Math.max(min, Math.min(max, value));
};
