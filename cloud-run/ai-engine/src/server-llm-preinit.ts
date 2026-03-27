import type { Logger } from './lib/logger';

type ModelProviderLoader = () => Promise<{
  getCerebrasModel: () => unknown;
  getGroqModel: () => unknown;
  getMistralModel: () => unknown;
}>;

function loadModelProviders() {
  return import('./services/ai-sdk/model-provider-core.js');
}

export async function preinitializeLlmProviders(
  log: Pick<Logger, 'debug' | 'warn'>,
  loadProviders: ModelProviderLoader = loadModelProviders
): Promise<void> {
  try {
    const { getCerebrasModel, getGroqModel, getMistralModel } =
      await loadProviders();

    try {
      getCerebrasModel();
      getGroqModel();
      getMistralModel();
      log.debug('LLM provider singletons pre-initialized');
    } catch (err) {
      log.debug(
        { err },
        'LLM pre-init skipped (keys not yet available)'
      );
    }
  } catch (err) {
    log.warn({ err }, 'LLM pre-init module import failed');
  }
}
