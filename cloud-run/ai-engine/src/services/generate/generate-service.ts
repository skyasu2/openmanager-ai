/**
 * Cloud Run Generate Service
 * Cerebras AI 텍스트 생성 담당 (AI SDK 버전)
 *
 * Hybrid Architecture:
 * - Vercel에서 프록시를 통해 이 서비스 호출
 * - API 키는 Cloud Run에서만 관리
 *
 * Updated: 2026-02-23 - Migrated from Mistral to Cerebras (gpt-oss-120b)
 */

import { generateText, streamText } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';
import { logger } from '../../lib/logger';

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
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime?: number;
}

class CloudRunGenerateService {
  // Use Cerebras gpt-oss-120b for high throughput (3000 tok/s)
  private readonly DEFAULT_MODEL = 'gpt-oss-120b';
  private cerebras: ReturnType<typeof createCerebras> | null = null;

  // 통계
  private stats = {
    requests: 0,
    successes: 0,
    errors: 0,
    totalTokens: 0,
  };

  /**
   * Get Cerebras provider (lazy initialization)
   */
  private getCerebras(): ReturnType<typeof createCerebras> | null {
    if (this.cerebras) return this.cerebras;

    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      logger.error('❌ [Generate] CEREBRAS_API_KEY not configured');
      return null;
    }

    this.cerebras = createCerebras({ apiKey });
    return this.cerebras;
  }

  /**
   * 텍스트 생성
   */
  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    const startTime = Date.now();
    const modelId = options.model || this.DEFAULT_MODEL;

    this.stats.requests++;

    // 입력 검증
    if (!prompt || prompt.trim().length === 0) {
      return { success: false, error: 'Empty prompt provided' };
    }

    const cerebras = this.getCerebras();
    if (!cerebras) {
      return { success: false, error: 'No API key configured' };
    }

    try {
      const { text, usage } = await generateText({
        model: cerebras(modelId),
        prompt,
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        topP: options.topP ?? 0.95,
      });

      const processingTime = Date.now() - startTime;

      // 사용량 추적
      const usageInfo = {
        promptTokens: usage?.inputTokens || 0,
        completionTokens: usage?.outputTokens || 0,
        totalTokens: (usage?.inputTokens || 0) + (usage?.outputTokens || 0),
      };

      this.stats.successes++;
      this.stats.totalTokens += usageInfo.totalTokens;

      console.log(
        `✅ [Generate] Success: ${modelId}, ${usageInfo.totalTokens} tokens, ${processingTime}ms`
      );

      return {
        success: true,
        text,
        model: modelId,
        usage: usageInfo,
        processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ [Generate] Error:', errorMessage);

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
    const modelId = options.model || this.DEFAULT_MODEL;

    const cerebras = this.getCerebras();
    if (!cerebras) {
      logger.error('❌ [Generate Stream] No API key available');
      return null;
    }

    try {
      const result = streamText({
        model: cerebras(modelId),
        prompt,
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        topP: options.topP ?? 0.95,
      });

      const encoder = new TextEncoder();
      const textStream = result.textStream;

      return new ReadableStream({
        async start(controller) {
          try {
            for await (const text of textStream) {
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } catch (error) {
      logger.error('❌ [Generate Stream] Error:', error);
      return null;
    }
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
      provider: 'cerebras (ai-sdk)',
      model: this.DEFAULT_MODEL,
    };
  }
}

// 싱글톤 인스턴스
export const generateService = new CloudRunGenerateService();
