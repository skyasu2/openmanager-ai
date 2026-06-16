import { createServerIdPattern } from '@/config/server-id-pattern';
import { logger } from '@/lib/logging';
import intentPatternsJson from './intent-patterns.json';
import {
  INTENT_PATTERN_NAMES,
  IntentPatternsSchema,
  type IntentPatternName,
  type IntentPatternsConfig,
} from './schema';

export type { IntentPatternName, IntentPatternsConfig };

const DEFAULT_INTENT_PATTERNS_CONFIG = intentPatternsJson;
const DISABLED_PATTERN = /a^/;
const INTENT_PATTERN_NAME_SET = new Set<string>(INTENT_PATTERN_NAMES);

type ResilientIntentPatternLoaderOptions = {
  onLoadError?: (error: unknown) => void;
};

function formatLoadError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      fallback: 'disabled-patterns',
    };
  }

  return {
    errorMessage: String(error),
    fallback: 'disabled-patterns',
  };
}

export function reportIntentPatternLoadError(error: unknown): void {
  logger.error(
    '[intent-rules] Failed to load intent patterns; artifact matching disabled',
    formatLoadError(error)
  );
}

export class IntentPatternLoader {
  private readonly parsedConfig: IntentPatternsConfig;
  private readonly compiledPatterns = new Map<IntentPatternName, RegExp>();
  private readonly serverIdPattern: RegExp;

  constructor(configInput: unknown = DEFAULT_INTENT_PATTERNS_CONFIG) {
    this.parsedConfig = IntentPatternsSchema.parse(configInput);

    for (const [name, entry] of Object.entries(this.parsedConfig.patterns)) {
      this.compiledPatterns.set(
        name as IntentPatternName,
        new RegExp(entry.source, entry.flags)
      );
    }

    this.serverIdPattern = createServerIdPattern();
  }

  config(): IntentPatternsConfig {
    return this.parsedConfig;
  }

  pattern(name: IntentPatternName): RegExp {
    const pattern = this.compiledPatterns.get(name);
    if (!pattern) {
      throw new Error(`unknown intent pattern: ${name}`);
    }
    return pattern;
  }

  serverId(): RegExp {
    return this.serverIdPattern;
  }
}

export function createIntentPatternLoader(
  configInput?: unknown
): IntentPatternLoader {
  return new IntentPatternLoader(configInput ?? DEFAULT_INTENT_PATTERNS_CONFIG);
}

class ResilientIntentPatternLoader {
  private loader: IntentPatternLoader | null = null;
  private loadError: unknown = null;

  constructor(
    private readonly configInput: unknown = DEFAULT_INTENT_PATTERNS_CONFIG,
    private readonly options: ResilientIntentPatternLoaderOptions = {}
  ) {}

  private getLoader(): IntentPatternLoader | null {
    if (this.loader) return this.loader;
    if (this.loadError) return null;

    try {
      this.loader = createIntentPatternLoader(this.configInput);
      return this.loader;
    } catch (error) {
      this.loadError = error;
      this.options.onLoadError?.(error);
      return null;
    }
  }

  config(): IntentPatternsConfig {
    const loader = this.getLoader();
    if (!loader) {
      throw new Error('intent pattern config is unavailable');
    }
    return loader.config();
  }

  pattern(name: IntentPatternName): RegExp {
    if (!INTENT_PATTERN_NAME_SET.has(name)) {
      throw new Error(`unknown intent pattern: ${name}`);
    }
    return this.getLoader()?.pattern(name) ?? DISABLED_PATTERN;
  }

  serverId(): RegExp {
    return this.getLoader()?.serverId() ?? DISABLED_PATTERN;
  }
}

export function createResilientIntentPatternLoader(
  configInput: unknown = DEFAULT_INTENT_PATTERNS_CONFIG,
  options: ResilientIntentPatternLoaderOptions = {
    onLoadError: reportIntentPatternLoadError,
  }
): ResilientIntentPatternLoader {
  return new ResilientIntentPatternLoader(configInput, options);
}

export const intentPatterns = createResilientIntentPatternLoader();
