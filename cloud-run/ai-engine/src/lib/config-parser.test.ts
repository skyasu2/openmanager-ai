/**
 * Config Parser Unit Tests
 *
 * P0 Priority Tests for API key management and configuration parsing
 *
 * @version 1.0.0
 * @created 2026-01-04
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTavilyApiKey,
  getTavilyApiKeyBackup,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterVisionModelId,
  getOpenRouterVisionFallbackModelIds,
  isOpenRouterVisionToolCallingEnabled,
  getConfigStatus,
  clearConfigCache,
  getAIProvidersConfig,
} from './config-parser';

describe('Config Parser', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    vi.resetModules();
    process.env = { ...originalEnv };
    clearConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearConfigCache();
  });

  // ============================================================================
  // 1. Tavily API Key Tests
  // ============================================================================
  describe('getTavilyApiKey', () => {
    it('should return key from AI_PROVIDERS_CONFIG JSON', () => {
      process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
        groq: 'groq-key',
        mistral: 'mistral-key',
        cerebras: 'cerebras-key',
        tavily: 'tavily-from-json',
      });

      const result = getTavilyApiKey();

      expect(result).toBe('tavily-from-json');
    });

    it('should fallback to TAVILY_API_KEY env var', () => {
      process.env.TAVILY_API_KEY = 'tavily-from-env';

      const result = getTavilyApiKey();

      expect(result).toBe('tavily-from-env');
    });

    it('should return null when no key configured', () => {
      delete process.env.AI_PROVIDERS_CONFIG;
      delete process.env.TAVILY_API_KEY;

      const result = getTavilyApiKey();

      expect(result).toBeNull();
    });

    it('should prefer AI_PROVIDERS_CONFIG over individual env var', () => {
      process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
        groq: '',
        mistral: '',
        cerebras: '',
        tavily: 'json-priority',
      });
      process.env.TAVILY_API_KEY = 'env-fallback';

      const result = getTavilyApiKey();

      expect(result).toBe('json-priority');
    });
  });

  // ============================================================================
  // 2. Tavily Backup API Key Tests
  // ============================================================================
  describe('getTavilyApiKeyBackup', () => {
    it('should return backup key from env var', () => {
      process.env.TAVILY_API_KEY_BACKUP = 'backup-key-123';

      const result = getTavilyApiKeyBackup();

      expect(result).toBe('backup-key-123');
    });

    it('should return null when backup key not configured', () => {
      delete process.env.TAVILY_API_KEY_BACKUP;

      const result = getTavilyApiKeyBackup();

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 3. Other Provider API Key Tests
  // ============================================================================
  describe('getGroqApiKey', () => {
    it('should return key from AI_PROVIDERS_CONFIG JSON', () => {
      process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
        groq: 'groq-from-json',
        mistral: '',
        cerebras: '',
        tavily: '',
      });

      const result = getGroqApiKey();

      expect(result).toBe('groq-from-json');
    });

    it('should fallback to GROQ_API_KEY env var', () => {
      process.env.GROQ_API_KEY = 'groq-from-env';

      const result = getGroqApiKey();

      expect(result).toBe('groq-from-env');
    });
  });

  describe('getCerebrasApiKey', () => {
    it('should return key from AI_PROVIDERS_CONFIG JSON', () => {
      process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
        groq: '',
        mistral: '',
        cerebras: 'cerebras-from-json',
        tavily: '',
      });

      const result = getCerebrasApiKey();

      expect(result).toBe('cerebras-from-json');
    });

    it('should fallback to CEREBRAS_API_KEY env var', () => {
      process.env.CEREBRAS_API_KEY = 'cerebras-from-env';

      const result = getCerebrasApiKey();

      expect(result).toBe('cerebras-from-env');
    });
  });

  // ============================================================================
  // 4. Config Status Tests
  // ============================================================================
  describe('getConfigStatus', () => {
    it('should return all false when no config', () => {
      delete process.env.AI_PROVIDERS_CONFIG;
      delete process.env.TAVILY_API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.CEREBRAS_API_KEY;
      delete process.env.MISTRAL_API_KEY;

      const status = getConfigStatus();

      expect(status.tavily).toBe(false);
      expect(status.groq).toBe(false);
      expect(status.cerebras).toBe(false);
      expect(status.mistral).toBe(false);
    });

    it('should return true for configured providers', () => {
      delete process.env.AI_PROVIDERS_CONFIG;
      process.env.TAVILY_API_KEY = 'test-key';
      process.env.GROQ_API_KEY = 'test-key';
      delete process.env.CEREBRAS_API_KEY;

      const status = getConfigStatus();

      expect(status.tavily).toBe(true);
      expect(status.groq).toBe(true);
      expect(status.cerebras).toBe(false);
    });

    it('should reflect AI_PROVIDERS_CONFIG correctly', () => {
      process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
        groq: 'key1',
        mistral: 'key2',
        cerebras: 'key3',
        tavily: 'key4',
      });

      const status = getConfigStatus();

      expect(status.groq).toBe(true);
      expect(status.mistral).toBe(true);
      expect(status.cerebras).toBe(true);
      expect(status.tavily).toBe(true);
    });
  });

  // ============================================================================
  // 5. Cache Behavior Tests
  // ============================================================================
  describe('clearConfigCache', () => {
    it('should clear cached config and allow fresh read', () => {
      // First read
      process.env.TAVILY_API_KEY = 'first-key';
      const firstResult = getTavilyApiKey();
      expect(firstResult).toBe('first-key');

      // Change env (but cache still has old value)
      process.env.TAVILY_API_KEY = 'second-key';
      const cachedResult = getTavilyApiKey();
      expect(cachedResult).toBe('first-key'); // Still cached

      // Clear cache and read again
      clearConfigCache();
      const freshResult = getTavilyApiKey();
      expect(freshResult).toBe('second-key'); // Fresh value
    });
  });

  // ============================================================================
  // 6. JSON Parsing Error Handling
  // ============================================================================
  describe('JSON Parsing', () => {
    it('should parse JSON wrapped in single quotes', () => {
      process.env.AI_PROVIDERS_CONFIG = `'${JSON.stringify({
        groq: 'groq-quoted',
        mistral: 'mistral-quoted',
        cerebras: 'cerebras-quoted',
        tavily: 'tavily-quoted',
      })}'`;

      const result = getAIProvidersConfig();

      expect(result?.groq).toBe('groq-quoted');
      expect(result?.tavily).toBe('tavily-quoted');
    });

    it('should parse JSON wrapped in double quotes', () => {
      process.env.AI_PROVIDERS_CONFIG = `"${JSON.stringify({
        groq: 'groq-quoted-double',
        mistral: 'mistral-quoted-double',
        cerebras: 'cerebras-quoted-double',
        tavily: 'tavily-quoted-double',
      })}"`;

      const result = getAIProvidersConfig();

      expect(result?.groq).toBe('groq-quoted-double');
      expect(result?.tavily).toBe('tavily-quoted-double');
    });

    it('should handle invalid JSON gracefully', () => {
      process.env.AI_PROVIDERS_CONFIG = 'not-valid-json';
      delete process.env.GROQ_API_KEY;
      delete process.env.MISTRAL_API_KEY;
      delete process.env.CEREBRAS_API_KEY;
      delete process.env.TAVILY_API_KEY;

      const result = getAIProvidersConfig();

      expect(result).toBeNull();
    });

    it('should handle empty JSON object', () => {
      process.env.AI_PROVIDERS_CONFIG = '{}';

      const result = getAIProvidersConfig();

      // Empty object is valid, but properties are undefined
      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // 7. OpenRouter Vision Config Tests
  // ============================================================================
  describe('OpenRouter Vision config', () => {
    it('should use default vision model when env is missing', () => {
      delete process.env.OPENROUTER_MODEL_VISION;
      expect(getOpenRouterVisionModelId()).toBe('google/gemma-3-4b-it:free');
    });

    it('should use OPENROUTER_MODEL_VISION when configured', () => {
      process.env.OPENROUTER_MODEL_VISION = 'google/gemma-3-4b-it:free';
      expect(getOpenRouterVisionModelId()).toBe('google/gemma-3-4b-it:free');
    });

    it('should parse fallback model list from env', () => {
      process.env.OPENROUTER_MODEL_VISION_FALLBACKS = 'a/b:free, c/d:free, a/b:free';
      expect(getOpenRouterVisionFallbackModelIds()).toEqual(['a/b:free', 'c/d:free']);
    });

    it('should return default fallback list when env is missing', () => {
      delete process.env.OPENROUTER_MODEL_VISION_FALLBACKS;
      expect(getOpenRouterVisionFallbackModelIds()).toEqual([
        'nvidia/nemotron-nano-12b-v2-vl:free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
      ]);
    });

    it('should disable OpenRouter vision tool-calling by default', () => {
      delete process.env.OPENROUTER_VISION_TOOL_CALLING;
      expect(isOpenRouterVisionToolCallingEnabled()).toBe(false);
    });

    it('should enable OpenRouter vision tool-calling when env is true', () => {
      process.env.OPENROUTER_VISION_TOOL_CALLING = 'true';
      expect(isOpenRouterVisionToolCallingEnabled()).toBe(true);
    });
  });
});
