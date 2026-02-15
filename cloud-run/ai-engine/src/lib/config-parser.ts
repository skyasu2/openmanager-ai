import './env-loader';
import { logger } from './logger';
/**
 * Secret Configuration Parser
 * Parses JSON-based consolidated secrets from environment variables
 *
 * @module secret-config
 * @version 2.2.0
 *
 * ## Secret Consolidation (2025-12-28)
 * Consolidated into 4 grouped secrets for Cloud Run cost optimization:
 * 1. SUPABASE_CONFIG: Database connection
 * 2. AI_PROVIDERS_CONFIG: Groq, Mistral, Cerebras, Tavily
 * 3. KV_CONFIG: Upstash Redis
 * 4. CLOUD_RUN_API_SECRET: API authentication
 *
 * ## v2.2.0 (2025-12-31)
 * - Removed GOOGLE_AI_CONFIG (embeddings migrated to Mistral)
 *
 * ## v2.1.0 (2025-12-28)
 * - Removed Langfuse (unused due to createReactAgent callback limitation)
 */

// =============================================================================
// Types
// =============================================================================

export interface UpstashConfig {
  url: string;
  token: string;
}

export interface SupabaseConfig {
  url: string;
  directUrl: string;
  serviceRoleKey: string;
  upstash?: UpstashConfig; // Redis cache (optional)
}

/**
 * AI Providers Configuration (Grouped)
 * Contains API keys for multiple AI providers
 *
 * @updated 2026-01-27 - Added Gemini Flash-Lite for Vision Agent
 * @updated 2026-02-15 - Re-added OpenRouter as Vision fallback with guarded defaults
 */
export interface AIProvidersConfig {
  groq: string;
  mistral: string;
  cerebras: string;
  tavily: string;
  gemini?: string; // Vision Agent - Gemini 2.5 Flash
  openrouter?: string; // Fallback Vision
}

/**
 * KV (Upstash Redis) Configuration (Grouped)
 */
export interface KVConfig {
  url: string;
  token: string;
}

/**
 * Langfuse Configuration (LLM Observability)
 * @added 2026-01-06
 */
export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

// =============================================================================
// JSON Parsing Helpers
// =============================================================================

function parseJsonSecret<T>(envVar: string, secretName: string): T | null {
  const value = process.env[envVar];
  if (!value) {
    logger.warn(`⚠️ [Config] ${secretName} not found in environment`);
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (err) {
    logger.error(`❌ [Config] Failed to parse ${secretName}:`, err);
    return null;
  }
}

// =============================================================================
// Legacy Environment Variable Support
// =============================================================================

function getSupabaseConfigLegacy(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const directUrl = process.env.SUPABASE_DIRECT_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    return {
      url,
      directUrl: directUrl || url,
      serviceRoleKey,
    };
  }
  return null;
}

// =============================================================================
// Public API - Config Getters with Fallback
// =============================================================================

let cachedSupabaseConfig: SupabaseConfig | null = null;
let cachedAIProvidersConfig: AIProvidersConfig | null = null;
let cachedKVConfig: KVConfig | null = null;
let cachedLangfuseConfig: LangfuseConfig | null = null;

const DEFAULT_OPENROUTER_VISION_MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';
const DEFAULT_OPENROUTER_VISION_FALLBACKS = [
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'google/gemma-3-4b-it:free',
];

/**
 * Get Supabase configuration
 * Tries JSON secret first, falls back to legacy env vars
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  if (cachedSupabaseConfig) return cachedSupabaseConfig;

  // Try JSON secret first
  cachedSupabaseConfig = parseJsonSecret<SupabaseConfig>(
    'SUPABASE_CONFIG',
    'supabase-config'
  );

  // Fallback to legacy env vars
  if (!cachedSupabaseConfig) {
    cachedSupabaseConfig = getSupabaseConfigLegacy();
  }

  return cachedSupabaseConfig;
}

/**
 * Get Cloud Run API Secret (unchanged - single value)
 */
export function getCloudRunApiSecret(): string | null {
  return process.env.CLOUD_RUN_API_SECRET || null;
}

/**
 * Get AI Providers configuration (grouped)
 * Contains Groq, Mistral, Cerebras, Tavily API keys
 */
export function getAIProvidersConfig(): AIProvidersConfig | null {
  if (cachedAIProvidersConfig) return cachedAIProvidersConfig;

  // Try JSON secret first
  cachedAIProvidersConfig = parseJsonSecret<AIProvidersConfig>(
    'AI_PROVIDERS_CONFIG',
    'ai-providers-config'
  );

  // Fallback to individual env vars
  if (!cachedAIProvidersConfig) {
    const groq = process.env.GROQ_API_KEY;
    const mistral = process.env.MISTRAL_API_KEY;
    const cerebras = process.env.CEREBRAS_API_KEY;
    const tavily = process.env.TAVILY_API_KEY;

    if (groq || mistral || cerebras || tavily) {
      cachedAIProvidersConfig = {
        groq: groq || '',
        mistral: mistral || '',
        cerebras: cerebras || '',
        tavily: tavily || '',
      };
    }
  }

  return cachedAIProvidersConfig;
}

/**
 * Get KV (Upstash Redis) configuration (grouped)
 */
export function getKVConfig(): KVConfig | null {
  if (cachedKVConfig) return cachedKVConfig;

  // Try JSON secret first
  cachedKVConfig = parseJsonSecret<KVConfig>('KV_CONFIG', 'kv-config');

  // Fallback to individual env vars
  if (!cachedKVConfig) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (url && token) {
      cachedKVConfig = { url, token };
    }
  }

  return cachedKVConfig;
}

/**
 * Get Langfuse configuration (LLM Observability)
 * Tries JSON secret first, falls back to individual env vars
 * @added 2026-01-06
 */
export function getLangfuseConfig(): LangfuseConfig | null {
  if (cachedLangfuseConfig) return cachedLangfuseConfig;

  // Try JSON secret first
  cachedLangfuseConfig = parseJsonSecret<LangfuseConfig>(
    'LANGFUSE_CONFIG',
    'langfuse-config'
  );

  // Fallback to individual env vars
  if (!cachedLangfuseConfig) {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

    if (publicKey && secretKey) {
      cachedLangfuseConfig = { publicKey, secretKey, baseUrl };
    }
  }

  // Set individual env vars for langfuse.ts compatibility
  if (cachedLangfuseConfig) {
    process.env.LANGFUSE_PUBLIC_KEY = cachedLangfuseConfig.publicKey;
    process.env.LANGFUSE_SECRET_KEY = cachedLangfuseConfig.secretKey;
    process.env.LANGFUSE_BASE_URL = cachedLangfuseConfig.baseUrl;
  }

  return cachedLangfuseConfig;
}

/**
 * Get Groq API Key
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 */
export function getGroqApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.groq) return providersConfig.groq;
  return process.env.GROQ_API_KEY || null;
}

/**
 * Get Mistral API Key
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 */
export function getMistralApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.mistral) return providersConfig.mistral;
  return process.env.MISTRAL_API_KEY || null;
}

/**
 * Mistral Configuration for embedding.ts
 * Returns API key in config object format
 */
export interface MistralConfig {
  apiKey: string;
}

export function getMistralConfig(): MistralConfig | null {
  const apiKey = getMistralApiKey();
  if (!apiKey) return null;
  return { apiKey };
}

/**
 * Get Cerebras API Key (NLQ Agent - fast inference)
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 * @see https://cloud.cerebras.ai/
 */
export function getCerebrasApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.cerebras) return providersConfig.cerebras;
  return process.env.CEREBRAS_API_KEY || null;
}

/**
 * Get Tavily API Key (Web Search)
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 */
export function getTavilyApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.tavily) return providersConfig.tavily;
  return process.env.TAVILY_API_KEY || null;
}

/**
 * Get Tavily Backup API Key (Failover)
 * Used when primary key hits rate limit or fails
 * @added 2026-01-04
 */
export function getTavilyApiKeyBackup(): string | null {
  return process.env.TAVILY_API_KEY_BACKUP || null;
}

/**
 * Get Gemini API Key (Vision Agent - Gemini 2.5 Flash)
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 *
 * Free Tier Limits (2026-02):
 * - 250 RPD (requests per day)
 * - 10 RPM (requests per minute)
 * - 250K TPM (tokens per minute)
 * - 1M context window
 *
 * @added 2026-01-27
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export function getGeminiApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.gemini) return providersConfig.gemini;
  return process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_PRIMARY || null;
}

/**
 * Get OpenRouter API Key (Fallback Vision)
 */
export function getOpenRouterApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.openrouter) return providersConfig.openrouter;
  return process.env.OPENROUTER_API_KEY || null;
}

/**
 * Get OpenRouter Vision Model ID
 * Default: nvidia/nemotron-nano-12b-v2-vl:free
 */
export function getOpenRouterVisionModelId(): string {
  return process.env.OPENROUTER_MODEL_VISION || DEFAULT_OPENROUTER_VISION_MODEL;
}

/**
 * Get OpenRouter Vision fallback model IDs (comma-separated)
 * Example: "mistralai/mistral-small-3.1-24b-instruct:free,google/gemma-3-4b-it:free"
 */
export function getOpenRouterVisionFallbackModelIds(): string[] {
  const raw = process.env.OPENROUTER_MODEL_VISION_FALLBACKS;
  if (!raw) return [...DEFAULT_OPENROUTER_VISION_FALLBACKS];

  const parsed = raw
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return [...DEFAULT_OPENROUTER_VISION_FALLBACKS];
  }

  return [...new Set(parsed)];
}

/**
 * Free-tier OpenRouter vision models often fail on tool calling.
 * Default is disabled for reliability; enable only when validated.
 */
export function isOpenRouterVisionToolCallingEnabled(): boolean {
  return process.env.OPENROUTER_VISION_TOOL_CALLING === 'true';
}

/**
 * Get Upstash Redis configuration
 * Priority order:
 * 1. KV_CONFIG (grouped secret - preferred)
 * 2. SUPABASE_CONFIG.upstash (embedded)
 * 3. Legacy env vars
 *
 * Supported env var names:
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (standard)
 * - KV_REST_API_URL / KV_REST_API_TOKEN (Vercel KV naming)
 */
export function getUpstashConfig(): UpstashConfig | null {
  // 1. Try from KV_CONFIG (grouped secret) first
  const kvConfig = getKVConfig();
  if (kvConfig) {
    return kvConfig;
  }

  // 2. Try from SUPABASE_CONFIG.upstash (embedded)
  const supabaseConfig = getSupabaseConfig();
  if (supabaseConfig?.upstash) {
    return supabaseConfig.upstash;
  }

  // 3. Fallback to legacy env vars (try multiple naming conventions)
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    return { url, token };
  }

  return null;
}

// =============================================================================
// Status & Debugging
// =============================================================================

export function getConfigStatus(): {
  supabase: boolean;
  upstash: boolean;
  groq: boolean;
  mistral: boolean;
  cerebras: boolean;
  tavily: boolean;
  gemini: boolean;
  openrouter: boolean;
  langfuse: boolean;
  cloudRunApi: boolean;
} {
  return {
    supabase: getSupabaseConfig() !== null,
    upstash: getUpstashConfig() !== null,
    groq: getGroqApiKey() !== null,
    mistral: getMistralApiKey() !== null,
    cerebras: getCerebrasApiKey() !== null,
    tavily: getTavilyApiKey() !== null,
    gemini: getGeminiApiKey() !== null,
    openrouter: getOpenRouterApiKey() !== null,
    langfuse: getLangfuseConfig() !== null,
    cloudRunApi: getCloudRunApiSecret() !== null,
  };
}

/**
 * Clear cached configs (for testing)
 */
export function clearConfigCache(): void {
  cachedSupabaseConfig = null;
  cachedAIProvidersConfig = null;
  cachedKVConfig = null;
  cachedLangfuseConfig = null;
}
