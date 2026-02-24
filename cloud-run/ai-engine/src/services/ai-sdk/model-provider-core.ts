import { createCerebras } from '@ai-sdk/cerebras';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import {
  getCerebrasApiKey,
  getGeminiApiKey,
  getGroqApiKey,
  getMistralApiKey,
  getOpenRouterApiKey,
  getOpenRouterVisionFallbackModelIds,
  getOpenRouterVisionModelId,
} from '../../lib/config-parser';

// P-1: Lazy singleton — 동일 프로세스 내 provider 재생성 방지
let _cerebras: ReturnType<typeof createCerebras> | null = null;
let _groq: ReturnType<typeof createGroq> | null = null;
let _mistral: ReturnType<typeof createMistral> | null = null;
let _gemini: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getCerebrasProvider() {
  if (_cerebras) return _cerebras;
  const apiKey = getCerebrasApiKey();
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured');
  _cerebras = createCerebras({ apiKey });
  return _cerebras;
}

function getGroqProvider() {
  if (_groq) return _groq;
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  _groq = createGroq({ apiKey });
  return _groq;
}

function getMistralProvider() {
  if (_mistral) return _mistral;
  const apiKey = getMistralApiKey();
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');
  _mistral = createMistral({ apiKey });
  return _mistral;
}

function getGeminiProvider() {
  if (_gemini) return _gemini;
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  _gemini = createGoogleGenerativeAI({ apiKey });
  return _gemini;
}

function patchOpenRouterRequestInit(init?: RequestInit): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const parsedBody = JSON.parse(init.body) as Record<string, unknown>;
    const provider =
      typeof parsedBody.provider === 'object' && parsedBody.provider !== null
        ? (parsedBody.provider as Record<string, unknown>)
        : {};

    const modelId = typeof parsedBody.model === 'string' ? parsedBody.model : null;
    const primaryVisionModel = getOpenRouterVisionModelId();

    if (!('allow_fallbacks' in provider)) {
      provider.allow_fallbacks = true;
    }

    if (!('require_parameters' in provider)) {
      provider.require_parameters = true;
    }

    if (modelId === primaryVisionModel && !Array.isArray(parsedBody.models)) {
      const fallbacks = getOpenRouterVisionFallbackModelIds();
      parsedBody.models = [...new Set([primaryVisionModel, ...fallbacks])];
    }

    return {
      ...init,
      body: JSON.stringify({
        ...parsedBody,
        provider,
      }),
    };
  } catch {
    return init;
  }
}

let _openrouter: ReturnType<typeof createOpenAI> | null = null;

function getOpenRouterProvider() {
  if (_openrouter) return _openrouter;
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const referer = process.env.OPENROUTER_HTTP_REFERER;
  const title = process.env.OPENROUTER_X_TITLE || 'OpenManager AI';

  const headers: Record<string, string> = {};
  if (referer) {
    headers['HTTP-Referer'] = referer;
  }
  if (title) {
    headers['X-Title'] = title;
  }

  _openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    name: 'openrouter',
    headers,
    fetch: async (input, init) => fetch(input, patchOpenRouterRequestInit(init)),
  });
  return _openrouter;
}

function asLanguageModel(model: unknown): LanguageModel {
  if (!model || (typeof model !== 'object' && typeof model !== 'function')) {
    throw new TypeError('[ModelProvider] Model must be an object or function');
  }

  const m = model as Record<string, unknown>;
  const hasDoGenerate = typeof m.doGenerate === 'function';
  const hasDoStream = typeof m.doStream === 'function';

  if (!hasDoGenerate && !hasDoStream) {
    throw new TypeError(
      '[ModelProvider] Model does not implement LanguageModel interface (missing doGenerate/doStream)'
    );
  }

  return model as LanguageModel;
}

export function getCerebrasModel(
  modelId: string = 'gpt-oss-120b'
): LanguageModel {
  const cerebras = getCerebrasProvider();
  return asLanguageModel(cerebras(modelId));
}

export function getGroqModel(
  modelId: string = 'llama-3.3-70b-versatile'
): LanguageModel {
  const groq = getGroqProvider();
  return asLanguageModel(groq(modelId));
}

export function getMistralModel(
  modelId: string = 'mistral-large-3-25-12'
): LanguageModel {
  const mistral = getMistralProvider();
  return asLanguageModel(mistral(modelId));
}

export function getGeminiFlashLiteModel(
  modelId: string = 'gemini-2.5-flash'
): LanguageModel {
  const gemini = getGeminiProvider();
  return asLanguageModel(gemini(modelId));
}

export function getOpenRouterVisionModel(modelId?: string): LanguageModel {
  const openrouter = getOpenRouterProvider();
  const model = modelId || getOpenRouterVisionModelId();
  return asLanguageModel(openrouter(model));
}
