import { generateObject, generateText } from 'ai';
import { type ZodTypeAny, type ZodError } from 'zod';
import { logger } from '../../../lib/logger';
import { selectTextModel, type TextProvider } from './config/agent-model-selectors';
import type { ProviderName } from '../model-provider.types';

interface StructuredOutputFallbackOptions<T extends ZodTypeAny> {
  model: Parameters<typeof generateObject>[0]['model'];
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
  operation: string;
  fallbackPromptExtra?: string;
  provider?: ProviderName;
  modelId?: string;
  providerFallback?: {
    agentLabel: string;
    providerOrder: TextProvider[];
    cbPrefix?: string;
  };
}

interface StructuredOutputResult<T> {
  object: T;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface UsageLike {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

type StructuredOutputUsage = NonNullable<StructuredOutputResult<unknown>['usage']>;

function coerceUsage(usage?: UsageLike): StructuredOutputUsage | undefined {
  if (!usage) return undefined;

  const safeInputTokens = usage.inputTokens;
  const safeOutputTokens = usage.outputTokens;
  const safeTotalTokens = usage.totalTokens;

  if (
    typeof safeInputTokens !== 'number' ||
    typeof safeOutputTokens !== 'number' ||
    typeof safeTotalTokens !== 'number'
  ) {
    return {
      inputTokens: safeInputTokens ?? 0,
      outputTokens: safeOutputTokens ?? 0,
      totalTokens: safeTotalTokens ?? (safeInputTokens ?? 0) + (safeOutputTokens ?? 0),
    };
  }

  return {
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens,
    totalTokens: safeTotalTokens,
  };
}

const STRUCTURED_OUTPUT_ERROR_PATTERNS = [
  'json_schema',
  'response format',
  'response-format',
  'output format',
  'must be a valid json',
  'failed to parse',
  'schema output validation failed',
];

const PROVIDER_FALLBACK_ERROR_PATTERNS = [
  'model_not_found',
  'does not exist or you do not have access',
  'do not have access',
  'model not found',
  'service unavailable',
  'rate limit',
];

function isSchemaError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  const lowerMessage = message.toLowerCase();
  return STRUCTURED_OUTPUT_ERROR_PATTERNS.some((pattern) =>
    lowerMessage.includes(pattern)
  );
}

function shouldFallbackProvider(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      PROVIDER_FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
    ) {
      return true;
    }

    const anyError = error as { status?: number; statusCode?: number };
    if (anyError.status && [404, 429, 502, 503, 504].includes(anyError.status)) {
      return true;
    }
    if (
      anyError.statusCode &&
      [404, 429, 502, 503, 504].includes(anyError.statusCode)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeModelText(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const start = candidate.indexOf('{');
  if (start === -1) return candidate;
  const end = candidate.lastIndexOf('}');
  if (end <= start) return candidate.substring(start).trim();

  return candidate.substring(start, end + 1).trim();
}

function parseTextAsJson(raw: string): unknown {
  const normalized = normalizeModelText(raw);
  if (!normalized) {
    throw new Error('Empty model fallback response');
  }

  return JSON.parse(normalized);
}

export async function generateObjectWithFallback<T extends ZodTypeAny>(
  options: StructuredOutputFallbackOptions<T>
): Promise<StructuredOutputResult<Awaited<T['_output']>>> {
  const attemptedProviders = new Set<ProviderName>();
  let currentModel = options.model;
  let currentProvider = options.provider;
  let currentModelId = options.modelId;

  if (currentProvider) {
    attemptedProviders.add(currentProvider);
  }

  for (;;) {
    try {
      const result = await generateObject({
        model: currentModel,
        schema: options.schema,
        system: options.system,
        prompt: options.prompt,
        temperature: options.temperature,
      });

      const parsedResult = options.schema.safeParse(result.object);
      if (!parsedResult.success) {
        logger.error(`[${options.operation}] generateObject returned invalid schema output`);
        const issueMessage = parsedResult.error.issues
          .map((issue: ZodError['issues'][number]) => issue.message)
          .join('; ');
        throw new Error(`Schema output validation failed: ${issueMessage}`);
      }

      return {
        object: parsedResult.data as Awaited<T['_output']>,
        usage: coerceUsage(result.usage as UsageLike),
      };
    } catch (error) {
      if (!isSchemaError(error)) {
        if (!shouldFallbackProvider(error) || !options.providerFallback) {
          throw error;
        }

        const nextModelResult = selectTextModel(
          options.providerFallback.agentLabel,
          options.providerFallback.providerOrder,
          {
            excludeProviders: Array.from(attemptedProviders),
            cbPrefix: options.providerFallback.cbPrefix,
            requiredCapabilities: { requireStructuredOutput: true },
          }
        );

        if (!nextModelResult) {
          throw error;
        }

        attemptedProviders.add(nextModelResult.provider as ProviderName);
        logger.warn(
          `[${options.operation}] Structured output failed on ${currentProvider ?? 'unknown'}/${currentModelId ?? 'unknown'}, ` +
            `falling back to ${nextModelResult.provider}/${nextModelResult.modelId}`
        );

        currentModel = nextModelResult.model;
        currentProvider = nextModelResult.provider as ProviderName;
        currentModelId = nextModelResult.modelId;
        continue;
      }

      logger.warn(
        `[${options.operation}] Structured output failed, falling back to text + JSON parse`
      );

      const fallbackPrompt = [
        options.fallbackPromptExtra ?? '',
        '반드시 아래 응답은 JSON 객체만 출력합니다.',
        '추가 설명, 코드블록, 접두/접미사는 출력하지 않습니다.',
        options.prompt,
      ]
        .filter(Boolean)
        .join('\n\n');

      const fallbackResult = await generateText({
        model: currentModel,
        system: options.system,
        prompt: fallbackPrompt,
        temperature: options.temperature,
      });

      try {
        const parsed = parseTextAsJson(
          typeof fallbackResult.text === 'string' ? fallbackResult.text : ''
        );
        const parsedResult = options.schema.safeParse(parsed);

        if (!parsedResult.success) {
          const issueMessage = parsedResult.error.issues
            .map((issue: ZodError['issues'][number]) => issue.message)
            .join('; ');
          throw new Error(`Schema fallback failed: ${issueMessage}`);
        }

        return {
          object: parsedResult.data as Awaited<T['_output']>,
          usage: coerceUsage(fallbackResult.usage as UsageLike),
        };
      } catch (parseError) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const parseMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(
          `[${options.operation}] Structured fallback parsing failed:`,
          parseMessage
        );

        throw new Error(
          `[${options.operation}] Structured output failed and text fallback also failed. ` +
            `Original: ${originalMessage}. Fallback: ${parseMessage}`
        );
      }
    }
  }
}
