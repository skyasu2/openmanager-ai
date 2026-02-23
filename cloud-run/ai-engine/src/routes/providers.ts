/**
 * Provider Management Routes
 *
 * Runtime toggle for AI providers (testing/debugging)
 *
 * @version 1.0.0
 * @created 2026-01-01
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  toggleProvider,
  getProviderToggleState,
  checkProviderStatus,
  type ProviderName,
} from '../services/ai-sdk/model-provider';
import { jsonSuccess, handleValidationError } from '../lib/error-handler';

export const providersRouter = new Hono();

/**
 * GET /providers - Get current provider status
 */
providersRouter.get('/', (c: Context) => {
  const toggleState = getProviderToggleState();
  const availableStatus = checkProviderStatus();

  return jsonSuccess(c, {
    toggle: toggleState,
    available: availableStatus,
    info: {
      cerebras: { role: 'Primary (Supervisor/NLQ/Advisor/Verifier/RAG-LLM)', model: 'gpt-oss-120b' },
      groq: { role: 'Primary (Analyst/Reporter)', model: 'llama-3.3-70b-versatile' },
      mistral: { role: 'RAG Embedding Only (mistral-embed)', model: 'mistral-embed' },
    },
  });
});

/**
 * POST /providers/:name/toggle - Toggle a provider on/off
 *
 * Body: { enabled: boolean }
 */
providersRouter.post('/:name/toggle', async (c: Context) => {
  const name = c.req.param('name') as ProviderName;
  const validProviders: ProviderName[] = ['cerebras', 'groq', 'mistral'];

  if (!validProviders.includes(name)) {
    return handleValidationError(c, `Invalid provider: ${name}. Valid: ${validProviders.join(', ')}`);
  }

  const body = await c.req.json();
  const enabled = body.enabled === true;

  toggleProvider(name, enabled);

  return jsonSuccess(c, {
    provider: name,
    enabled,
    message: `${name} ${enabled ? 'enabled' : 'disabled'}`,
    currentStatus: checkProviderStatus(),
  });
});

/**
 * POST /providers/reset - Reset all providers to enabled
 */
providersRouter.post('/reset', (c: Context) => {
  const providers: ProviderName[] = ['cerebras', 'groq', 'mistral'];

  for (const provider of providers) {
    toggleProvider(provider, true);
  }

  return jsonSuccess(c, {
    message: 'All providers reset to enabled',
    currentStatus: checkProviderStatus(),
  });
});
