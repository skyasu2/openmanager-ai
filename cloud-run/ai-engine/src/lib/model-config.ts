/**
 * API Key Configuration
 *
 * Minimal configuration for API key validation.
 * LangChain model factories removed (2025-12-28) - using AI SDK instead.
 *
 * @version 2.0.0
 * @updated 2025-12-28
 */

import { getGroqApiKey, getCerebrasApiKey, getMistralApiKey } from './config-parser';
import { logger } from './logger';

// ============================================================================
// API Key Validation
// ============================================================================

/**
 * Validate that all required API keys are configured
 */
export function validateAPIKeys(): {
  mistral: boolean;
  groq: boolean;
  cerebras: boolean;
  all: boolean;
} {
  // Trim whitespace to prevent false positives from whitespace-only keys
  const mistralKey = getMistralApiKey()?.trim();
  const groqKey = getGroqApiKey()?.trim();
  const cerebrasKey = getCerebrasApiKey()?.trim();

  return {
    mistral: !!mistralKey,
    groq: !!groqKey,
    cerebras: !!cerebrasKey,
    all: !!mistralKey && !!groqKey && !!cerebrasKey,
  };
}

/**
 * Log API key status to console
 */
export function logAPIKeyStatus(): void {
  const status = validateAPIKeys();
  logger.info('[APIKeyStatus]', {
    'Mistral AI': status.mistral ? 'configured' : 'missing',
    Groq: status.groq ? 'configured' : 'missing',
    Cerebras: status.cerebras ? 'configured' : 'missing',
  });
}
