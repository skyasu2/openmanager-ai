import { clampTimeoutEnv, parseNumericWithDefault } from './ai-proxy/config-env';

export type RedisTimeoutProfile =
  | 'operation'
  | 'fast'
  | 'standard'
  | 'write'
  | 'scan'
  | 'batch';

export interface RedisTimeoutConfig {
  operation: number;
  fast: number;
  standard: number;
  write: number;
  scan: number;
  batch: number;
}

const REDIS_TIMEOUT_DEFAULTS: RedisTimeoutConfig = {
  operation: 1_200,
  fast: 800,
  standard: 1_000,
  write: 1_200,
  scan: 1_500,
  batch: 1_500,
};

const TIMEOUT_ENV_KEYS: Record<RedisTimeoutProfile, string> = {
  operation: 'UPSTASH_REDIS_OPERATION_TIMEOUT_MS',
  fast: 'UPSTASH_REDIS_FAST_TIMEOUT_MS',
  standard: 'UPSTASH_REDIS_STANDARD_TIMEOUT_MS',
  write: 'UPSTASH_REDIS_WRITE_TIMEOUT_MS',
  scan: 'UPSTASH_REDIS_SCAN_TIMEOUT_MS',
  batch: 'UPSTASH_REDIS_BATCH_TIMEOUT_MS',
};

let cachedConfig: RedisTimeoutConfig | null = null;

function parseRedisTimeoutMs(profile: RedisTimeoutProfile): number {
  return clampTimeoutEnv(
    parseNumericWithDefault(
      TIMEOUT_ENV_KEYS[profile],
      REDIS_TIMEOUT_DEFAULTS[profile],
      (value) => value >= 100 && value <= 30_000
    ),
    100,
    30_000
  );
}

export function loadRedisTimeoutConfig(): RedisTimeoutConfig {
  return {
    operation: parseRedisTimeoutMs('operation'),
    fast: parseRedisTimeoutMs('fast'),
    standard: parseRedisTimeoutMs('standard'),
    write: parseRedisTimeoutMs('write'),
    scan: parseRedisTimeoutMs('scan'),
    batch: parseRedisTimeoutMs('batch'),
  };
}

export function getRedisTimeoutConfig(): RedisTimeoutConfig {
  if (!cachedConfig) {
    cachedConfig = loadRedisTimeoutConfig();
  }
  return cachedConfig;
}

function reloadRedisTimeoutConfig(): RedisTimeoutConfig {
  cachedConfig = null;
  return getRedisTimeoutConfig();
}

export function getRedisTimeoutMs(profile: RedisTimeoutProfile): number {
  return getRedisTimeoutConfig()[profile];
}

