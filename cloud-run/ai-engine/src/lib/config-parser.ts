import './env-loader';
import { logger } from './logger';
import {
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
} from '../services/ai-sdk/provider-model-policy';
export {
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
  DEPRECATED_CEREBRAS_QWEN_MODEL_ID,
} from '../services/ai-sdk/provider-model-policy';
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
 * 2. AI_PROVIDERS_CONFIG: Groq, Z.AI, Mistral, Cerebras, Tavily
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
 */
export interface AIProvidersConfig {
  groq: string;
  zai?: string;
  mistral: string;
  cerebras: string;
  tavily: string;
  tavilyBackup?: string; // Failover key
  gemini?: string; // Vision Agent - Gemini 2.5 Flash-Lite
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

  const normalizedValue = value.trim().replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');

  try {
    return JSON.parse(normalizedValue) as T;
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
 * Contains Groq, Z.AI, Mistral, Cerebras, Tavily API keys
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
    const zai = process.env.ZAI_API_KEY;
    const mistral = process.env.MISTRAL_API_KEY;
    const cerebras = process.env.CEREBRAS_API_KEY;
    const tavily = process.env.TAVILY_API_KEY;

    if (groq || zai || mistral || cerebras || tavily) {
      cachedAIProvidersConfig = {
        groq: groq || '',
        zai: zai || '',
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
 * Get Z.AI API Key.
 * Uses AI_PROVIDERS_CONFIG.zai or falls back to individual env var.
 */
export function getZaiApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.zai) return providersConfig.zai;
  return process.env.ZAI_API_KEY || null;
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
 * Get Cerebras API Key (secondary provider - fast inference)
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 * @see https://inference-docs.cerebras.ai
 * Default model is the current Cerebras production model available in this
 * account. Qwen 235B remains documented as a preview override only, and
 * gpt-oss-120b is retained as the confirmed Cerebras replacement candidate.
 */
export function getCerebrasApiKey(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.cerebras) return providersConfig.cerebras;
  return process.env.CEREBRAS_API_KEY || null;
}

const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';
const DEFAULT_ZAI_TEXT_MODEL = 'glm-4.5-flash';

/**
 * Get default Cerebras text model id.
 *
 * Account entitlements can differ from public model listings, so the model id
 * must stay configurable instead of being hardcoded across agent wiring.
 */
export function getCerebrasModelId(): string {
  return process.env.CEREBRAS_MODEL_ID || DEFAULT_CEREBRAS_MODEL;
}

/**
 * Intra-provider fallback models for Cerebras. The default model is already
 * llama3.1-8b, so gpt-oss-120b is the built-in replacement fallback unless
 * CEREBRAS_FALLBACK_MODEL_IDS is explicitly set.
 */
export function getCerebrasFallbackModelIds(): string[] {
  const configured = process.env.CEREBRAS_FALLBACK_MODEL_IDS;
  if (configured) {
    return configured
      .split(',')
      .map((modelId) => modelId.trim())
      .filter((modelId) => modelId.length > 0);
  }

  const defaultModel: string = DEFAULT_CEREBRAS_MODEL;
  return defaultModel === CEREBRAS_GPT_OSS_MODEL_ID
    ? []
    : [CEREBRAS_GPT_OSS_MODEL_ID];
}

/**
 * Cerebras tool-calling gate for emergency compatibility fallback.
 * Runtime default: false (disabled). Deployment/env files must set
 * CEREBRAS_TOOL_CALLING_ENABLED=true to enable tool-calling fallback.
 */
export function isCerebrasToolCallingEnabled(): boolean {
  return process.env.CEREBRAS_TOOL_CALLING_ENABLED === 'true';
}

/**
 * Cerebras long-context gate.
 *
 * Cerebras context support is account/model specific. Keep an emergency
 * disable switch so production can fall back to conservative prompt budgets
 * without code changes.
 */
export function isCerebrasLongContextEnabled(): boolean {
  return process.env.CEREBRAS_LONG_CONTEXT_ENABLED !== 'false';
}

/**
 * Get default Groq text model id.
 * Default: llama-4-scout-17b (500K TPD, 131K ctx, tool calling ✅)
 * @see https://console.groq.com/docs/rate-limits
 */
export function getGroqModelId(): string {
  return process.env.GROQ_MODEL_ID || DEFAULT_GROQ_MODEL;
}

/**
 * Get Z.AI OpenAI-compatible base URL.
 */
export function getZaiBaseUrl(): string {
  return process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL;
}

/**
 * Get default Z.AI free text model id.
 */
export function getZaiModelId(): string {
  return process.env.ZAI_DEFAULT_MODEL || DEFAULT_ZAI_TEXT_MODEL;
}

const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';

/**
 * Get default Mistral text model id.
 * Default: mistral-small-latest (free-tier friendly last-resort text fallback)
 * Override: MISTRAL_MODEL_ID env var
 */
export function getMistralModelId(): string {
  return process.env.MISTRAL_MODEL_ID || DEFAULT_MISTRAL_MODEL;
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
 * Uses AI_PROVIDERS_CONFIG.tavilyBackup or falls back to individual env var
 * @added 2026-01-04
 */
export function getTavilyApiKeyBackup(): string | null {
  const providersConfig = getAIProvidersConfig();
  if (providersConfig?.tavilyBackup) return providersConfig.tavilyBackup;
  return process.env.TAVILY_API_KEY_BACKUP || null;
}

/**
 * Get Gemini API Key (Vision Agent - Gemini 2.5 Flash)
 * Uses AI_PROVIDERS_CONFIG or falls back to individual env var
 *
 * Free Tier Limits (2026-04):
 * - 1,000 RPD (requests per day)
 * - 15 RPM (requests per minute)
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
 * Check if single-agent mode is allowed in production.
 * Default: false (Multi-agent is the standard).
 * Can be overridden via ALLOW_DEGRADED_SINGLE env var for emergency/degraded operations.
 */
export function isSingleModeAllowed(): boolean {
  return process.env.ALLOW_DEGRADED_SINGLE === 'true';
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
  zai: boolean;
  cerebras: boolean;
  tavily: boolean;
  tavilyBackup: boolean;
  gemini: boolean;
  langfuse: boolean;
  cloudRunApi: boolean;
} {
  return {
    supabase: getSupabaseConfig() !== null,
    upstash: getUpstashConfig() !== null,
    groq: getGroqApiKey() !== null,
    mistral: getMistralApiKey() !== null,
    zai: getZaiApiKey() !== null,
    cerebras: getCerebrasApiKey() !== null,
    tavily: getTavilyApiKey() !== null,
    tavilyBackup: getTavilyApiKeyBackup() !== null,
    gemini: getGeminiApiKey() !== null,
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
