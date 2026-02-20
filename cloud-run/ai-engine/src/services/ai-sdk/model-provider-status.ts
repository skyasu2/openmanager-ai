import {
  getCerebrasApiKey,
  getGeminiApiKey,
  getGroqApiKey,
  getMistralApiKey,
  getOpenRouterApiKey,
} from '../../lib/config-parser';
import type { ProviderName, ProviderStatus } from './model-provider.types';

/**
 * Runtime toggle state for providers (default: all enabled)
 * Use toggleProvider() to enable/disable at runtime for testing
 */
const providerToggleState: Record<ProviderName, boolean> = {
  cerebras: true,
  groq: true,
  mistral: true,
  gemini: true,
  openrouter: true,
};

/**
 * Cached provider status (invalidated when toggling providers)
 * @optimization Reduces redundant API key checks during agent initialization
 */
let cachedProviderStatus: ProviderStatus | null = null;

/**
 * Check if provider is enabled (both has API key AND toggle is on)
 */
function isProviderEnabled(provider: ProviderName): boolean {
  return providerToggleState[provider];
}

/**
 * Toggle a provider on/off at runtime
 * @note Invalidates provider status cache to reflect changes
 */
export function toggleProvider(provider: ProviderName, enabled: boolean): void {
  providerToggleState[provider] = enabled;
  cachedProviderStatus = null;
  console.log(`🔧 [Provider] ${provider} ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current toggle state for all providers
 */
export function getProviderToggleState(): Record<ProviderName, boolean> {
  return { ...providerToggleState };
}

/**
 * Check which providers are available (API key exists AND toggle enabled)
 * @optimization Caches result for startup performance (agent-configs.ts calls this 5+ times)
 */
export function checkProviderStatus(): ProviderStatus {
  if (cachedProviderStatus) {
    return cachedProviderStatus;
  }

  cachedProviderStatus = {
    cerebras: !!getCerebrasApiKey() && isProviderEnabled('cerebras'),
    groq: !!getGroqApiKey() && isProviderEnabled('groq'),
    mistral: !!getMistralApiKey() && isProviderEnabled('mistral'),
    gemini: !!getGeminiApiKey() && isProviderEnabled('gemini'),
    openrouter: !!getOpenRouterApiKey() && isProviderEnabled('openrouter'),
  };

  return cachedProviderStatus;
}

/**
 * Invalidate provider status cache (call when toggling providers)
 */
export function invalidateProviderStatusCache(): void {
  cachedProviderStatus = null;
}
