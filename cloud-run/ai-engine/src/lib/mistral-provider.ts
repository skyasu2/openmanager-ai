/**
 * Shared Mistral AI Provider (Singleton)
 *
 * Used by: embedding.ts, query-expansion.ts, reranker.ts
 * Eliminates duplicate provider initialization across RAG modules.
 */

import { createMistral } from '@ai-sdk/mistral';
import { getMistralApiKey } from './config-parser';

let provider: ReturnType<typeof createMistral> | null = null;

export function getMistralProvider(): ReturnType<typeof createMistral> | null {
  if (provider) return provider;

  const apiKey = getMistralApiKey();
  if (!apiKey) return null;

  provider = createMistral({ apiKey });
  return provider;
}
