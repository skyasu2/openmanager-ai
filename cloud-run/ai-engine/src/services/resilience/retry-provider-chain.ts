import type { LanguageModel } from 'ai';
import {
  getCerebrasFallbackModelIds,
  getCerebrasModelId,
  getGroqModelId,
  getMistralModelId,
} from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import {
  checkProviderStatus,
  getCerebrasModel,
  getGroqModel,
  getMistralModel,
  type ProviderName,
} from '../ai-sdk/model-provider';
import type { TextProviderName } from '../ai-sdk/provider-capabilities';
import { getCircuitBreaker } from './circuit-breaker';

interface ProviderConfig {
  name: TextProviderName;
  getModel: (modelId?: string) => LanguageModel;
  modelIds: () => string[];
}

const PROVIDER_CHAIN: ProviderConfig[] = [
  {
    name: 'cerebras',
    getModel: getCerebrasModel,
    modelIds: () =>
      [getCerebrasModelId(), ...getCerebrasFallbackModelIds()].filter(
        (modelId, index, list) => modelId && list.indexOf(modelId) === index
      ),
  },
  {
    name: 'groq',
    getModel: getGroqModel,
    modelIds: () => [getGroqModelId()],
  },
  {
    name: 'mistral',
    getModel: getMistralModel,
    modelIds: () => [getMistralModelId()],
  },
];

/**
 * Get available providers based on current status
 */
export function getAvailableProviders(
  preferredOrder: ProviderName[] = ['groq', 'cerebras', 'mistral'],
  excludeProviders: ProviderName[] = []
): ProviderConfig[] {
  const status = checkProviderStatus();
  const excluded = new Set(excludeProviders);

  return preferredOrder
    .filter((name) => {
      if (excluded.has(name)) return false;
      if (!status[name]) return false;
      const cb = getCircuitBreaker(name);
      if (!cb.isAllowed()) {
        logger.warn(`[RetryWithFallback] Skipping ${name}: circuit breaker OPEN`);
        return false;
      }
      return true;
    })
    .map((name) => PROVIDER_CHAIN.find((p) => p.name === name)!)
    .filter(Boolean);
}
