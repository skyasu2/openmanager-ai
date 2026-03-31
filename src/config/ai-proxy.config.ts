/**
 * AI Proxy Configuration facade.
 *
 * Runtime env parsing and Zod validation live in `ai-proxy/config-loader.ts`.
 * This module keeps the cached singleton and stable accessor exports used by routes.
 */

import { logger } from '@/lib/logging';
import { loadAIProxyConfig } from './ai-proxy/config-loader';
import type {
  AIProxyConfig,
  CacheEndpoint,
  ComplexityCategoryWeights,
  ObservabilityConfig,
  ProxyEndpoint,
  RAGWeightsConfig,
  StreamRetryConfig,
  VercelTier,
} from './ai-proxy/config-schema';

export type {
  AIProxyConfig,
  CacheEndpoint,
  ComplexityCategoryWeights,
  ObservabilityConfig,
  ProxyEndpoint,
  RAGWeightsConfig,
  StreamRetryConfig,
  VercelTier,
} from './ai-proxy/config-schema';

let _config: AIProxyConfig | null = null;

export function getAIProxyConfig(): AIProxyConfig {
  if (!_config) {
    _config = loadAIProxyConfig();
    logger.info(`🔧 AI Proxy config loaded (tier: ${_config.tier})`);
  }
  return _config;
}

export function reloadAIProxyConfig(): AIProxyConfig {
  _config = null;
  return getAIProxyConfig();
}

export function getVercelTier(): VercelTier {
  return getAIProxyConfig().tier;
}

export function getCurrentMaxDuration(): number {
  const config = getAIProxyConfig();
  return config.maxDuration[config.tier];
}

export function getRouteMaxExecutionMs(routeMaxDurationSeconds: number): number {
  if (!Number.isFinite(routeMaxDurationSeconds) || routeMaxDurationSeconds <= 0) {
    return 0;
  }
  const routeMaxMs = routeMaxDurationSeconds * 1_000;
  return Math.max(0, Math.min(routeMaxMs, getMaxFunctionDurationMs()));
}

export function getMaxFunctionDurationMs(): number {
  return getAIProxyConfig().maxFunctionDurationMs;
}

export function getFunctionTimeoutReserveMs(): number {
  return getAIProxyConfig().functionTimeoutReserveMs;
}

export function getDefaultTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].default;
}

export function getMaxTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].max;
}

export function getMinTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].min;
}

export function clampTimeout(endpoint: ProxyEndpoint, timeout: number): number {
  const config = getAIProxyConfig().timeouts[endpoint];
  return Math.max(config.min, Math.min(config.max, timeout));
}

function getCacheTTL(endpoint: CacheEndpoint): number {
  return getAIProxyConfig().cacheTTL[endpoint];
}

export function getComplexityThreshold(): number {
  return getAIProxyConfig().queryRouting.complexityThreshold;
}

function getForceJobQueueKeywords(): string[] {
  return getAIProxyConfig().queryRouting.forceJobQueueKeywords;
}

export function getStreamRetryConfig(): StreamRetryConfig {
  return getAIProxyConfig().streamRetry;
}

export function isRetryableError(errorMessage: string): boolean {
  const config = getStreamRetryConfig();
  return config.retryableErrors.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase()),
  );
}

export function calculateRetryDelay(attempt: number): number {
  const config = getStreamRetryConfig();
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(cappedDelay + jitter));
}

function getRAGWeights(): RAGWeightsConfig {
  return getAIProxyConfig().ragWeights;
}

export function getObservabilityConfig(): ObservabilityConfig {
  return getAIProxyConfig().observability;
}

export function getComplexityCategoryWeights(): ComplexityCategoryWeights {
  return getAIProxyConfig().complexityWeights;
}

function getComplexityCategoryWeight(
  category: keyof ComplexityCategoryWeights,
): number {
  return getAIProxyConfig().complexityWeights[category];
}

export {
  generateTraceId,
  normalizeTraceId,
  generateTraceparent,
  parseTraceparentTraceId,
  TRACEPARENT_HEADER,
  traceIdToUUID,
} from './ai-proxy/tracing';
