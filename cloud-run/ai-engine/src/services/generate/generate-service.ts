/**
 * Cloud Run Generate Service
 * AI SDK text generation endpoint with provider fallback.
 *
 * Hybrid Architecture:
 * - Vercel에서 프록시를 통해 이 서비스 호출
 * - API 키는 Cloud Run에서만 관리
 *
 * Updated: 2026-04-30 - Uses shared quota admission + provider fallback path
 */

import { logger } from '../../lib/logger';
import { getCerebrasModelId } from '../../lib/config-parser';
import {
  generateTextWithRetry,
  type ProviderAttempt,
} from '../resilience/retry-with-fallback';
import type { ProviderName } from '../ai-sdk/model-provider';

interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface GenerateResult {
  success: boolean;
  text?: string;
  error?: string;
  model?: string;
  provider?: ProviderName;
  usedFallback?: boolean;
  attempts?: ProviderAttempt[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime?: number;
}

class CloudRunGenerateService {
  // Use the verified-access Cerebras default model unless env overrides it.
  private readonly DEFAULT_MODEL = getCerebrasModelId();
  private readonly PROVIDER_ORDER: ProviderName[] = [
    'mistral',
    'zai',
    'groq',
    'cerebras',
  ];

  // 통계
  private stats = {
    requests: 0,
    successes: 0,
    errors: 0,
    totalTokens: 0,
  };

  /**
   * 텍스트 생성
   */
  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    const startTime = Date.now();
    const requestedModelId = options.model || this.DEFAULT_MODEL;

    this.stats.requests++;

    // 입력 검증
    if (!prompt || prompt.trim().length === 0) {
      return { success: false, error: 'Empty prompt provided' };
    }

    try {
      const retryResult = await generateTextWithRetry({
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        topP: options.topP ?? 0.95,
        ...(options.model && {
          providerModelIds: { cerebras: [options.model] },
        }),
      }, this.PROVIDER_ORDER, {
        // Legacy generate endpoint previously made one SDK attempt. Keep this
        // path conservative and rely on provider fallback instead of same-model retries.
        maxRetries: 0,
        timeoutMs: 30_000,
      });

      if (!retryResult.success || !retryResult.result) {
        const lastError =
          retryResult.attempts[retryResult.attempts.length - 1]?.error ||
          'All providers failed';
        this.stats.errors++;
        logger.error('[Generate] All providers failed:', lastError);
        return {
          success: false,
          error: lastError,
          provider: retryResult.provider,
          model: retryResult.modelId || requestedModelId,
          usedFallback: retryResult.usedFallback,
          attempts: retryResult.attempts,
          processingTime: Date.now() - startTime,
        };
      }

      const { text, usage } = retryResult.result;

      const processingTime = Date.now() - startTime;

      // 사용량 추적
      const usageInfo = {
        promptTokens: usage?.inputTokens || 0,
        completionTokens: usage?.outputTokens || 0,
        totalTokens:
          usage?.totalTokens ??
          (usage?.inputTokens || 0) + (usage?.outputTokens || 0),
      };

      this.stats.successes++;
      this.stats.totalTokens += usageInfo.totalTokens;

      logger.info(
        `[Generate] Success: ${retryResult.provider}/${retryResult.modelId}, ${usageInfo.totalTokens} tokens, ${processingTime}ms`
      );

      return {
        success: true,
        text,
        model: retryResult.modelId,
        provider: retryResult.provider,
        usedFallback: retryResult.usedFallback,
        attempts: retryResult.attempts,
        usage: usageInfo,
        processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[Generate] Error:', errorMessage);

      this.stats.errors++;
      return {
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 스트리밍 생성
   */
  async generateStream(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<ReadableStream<Uint8Array> | null> {
    const result = await this.generate(prompt, options);
    if (!result.success || !result.text) {
      logger.error('[Generate Stream] Generation failed:', result.error);
      return null;
    }

    const encoder = new TextEncoder();

    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          text: result.text,
          provider: result.provider,
          model: result.model,
          usedFallback: result.usedFallback,
        })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
  }

  /**
   * 서비스 통계
   */
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.requests > 0
          ? Math.round((this.stats.successes / this.stats.requests) * 100)
          : 0,
      provider: 'cerebras -> groq -> mistral (ai-sdk)',
      model: this.DEFAULT_MODEL,
    };
  }
}

// 싱글톤 인스턴스
export const generateService = new CloudRunGenerateService();
