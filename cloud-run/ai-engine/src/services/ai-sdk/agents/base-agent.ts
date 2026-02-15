/**
 * BaseAgent - Abstract base class for all agents
 *
 * Encapsulates the common agent execution pattern using AI SDK v6's
 * generateText with stopWhen conditions for graceful termination.
 *
 * Key Features:
 * - Unified execution interface via run() method
 * - AI SDK v6 native: stopWhen with hasToolCall('finalAnswer') + stepCountIs(N)
 * - Provider fallback chain support
 * - Step-by-step monitoring via onStepFinish
 * - Timeout protection with configurable limits
 *
 * @version 1.0.0
 * @created 2026-01-27
 */

import {
  generateText,
  streamText,
  hasToolCall,
  stepCountIs,
  type Tool,
  type TextPart,
  type ImagePart,
  type FilePart,
  type UserContent,
} from 'ai';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { isOpenRouterVisionToolCallingEnabled } from '../../../lib/config-parser';
import type { AgentConfig, ModelResult } from './config';
import { logger } from '../../../lib/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Image attachment for multimodal messages
 * Supports Base64, Data URL, HTTP(S) URL formats
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
 */
export interface ImageAttachment {
  /** Image data: Base64 string, Data URL, or HTTP(S) URL */
  data: string;
  /** MIME type (e.g., 'image/png', 'image/jpeg') */
  mimeType: string;
  /** Optional filename for display */
  name?: string;
}

/**
 * File attachment for multimodal messages
 * Supports PDF, audio, and other file types
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#file-parts
 */
export interface FileAttachment {
  /** File data: Base64 string or HTTP(S) URL */
  data: string;
  /** MIME type (e.g., 'application/pdf', 'text/plain') */
  mimeType: string;
  /** Optional filename */
  name?: string;
}

/**
 * Result returned by agent execution
 */
export interface AgentResult {
  /** Generated text response */
  text: string;
  /** Whether execution was successful */
  success: boolean;
  /** Tools called during execution */
  toolsCalled: string[];
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Execution metadata */
  metadata: {
    provider: string;
    modelId: string;
    durationMs: number;
    steps: number;
    finishReason?: string;
    fallbackUsed?: boolean;
    fallbackReason?: string;
  };
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration options for agent execution
 */
export interface AgentRunOptions {
  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
  /** Maximum number of steps (LLM calls) */
  maxSteps?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Enable web search tools */
  webSearchEnabled?: boolean;
  /** Session ID for context tracking */
  sessionId?: string;
  /**
   * Image attachments for multimodal queries (Vision Agent)
   * Images are passed directly to the model via message content
   * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
   */
  images?: ImageAttachment[];
  /**
   * File attachments for multimodal queries (PDF, audio, etc.)
   * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#file-parts
   */
  files?: FileAttachment[];
}

/**
 * Stream event types for streaming execution
 */
export interface AgentStreamEvent {
  type: 'text_delta' | 'tool_call' | 'step_finish' | 'done' | 'error' | 'warning';
  data: unknown;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<AgentRunOptions, 'sessionId' | 'images' | 'files'>> = {
  timeoutMs: 45_000,
  maxSteps: 7,
  temperature: 0.4,
  maxOutputTokens: 2048,
  webSearchEnabled: true,
};

const OPENROUTER_VISION_MIN_OUTPUT_TOKENS = 256;
const VISION_EMPTY_RESPONSE_FALLBACK =
  '비전 분석 모델 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.';
const GENERIC_EMPTY_RESPONSE_FALLBACK =
  'AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.';

// ============================================================================
// BaseAgent Abstract Class
// ============================================================================

/**
 * Abstract base class for all agents
 *
 * Subclasses must implement:
 * - getName(): Agent display name
 * - getConfig(): Get AgentConfig from AGENT_CONFIGS
 *
 * Provides:
 * - run(): Execute agent with query and return result
 * - stream(): Execute agent with streaming response
 * - isAvailable(): Check if agent has valid model
 */
export abstract class BaseAgent {
  /**
   * Get the agent's display name
   */
  abstract getName(): string;

  /**
   * Get the agent's configuration from AGENT_CONFIGS
   */
  abstract getConfig(): AgentConfig | null;

  /**
   * Check if agent is available (has valid model)
   */
  isAvailable(): boolean {
    const config = this.getConfig();
    if (!config) return false;
    return config.getModel() !== null;
  }

  /**
   * Get model result from config
   */
  protected getModel(): ModelResult | null {
    const config = this.getConfig();
    if (!config) return null;
    return config.getModel();
  }

  /**
   * Filter tools based on options
   */
  protected filterTools(
    tools: Record<string, Tool>,
    options: AgentRunOptions,
    provider: string
  ): Record<string, Tool> {
    const filtered = { ...tools };

    if (options.webSearchEnabled !== false) {
      // keep default tools
    } else if ('searchWeb' in filtered) {
      delete filtered.searchWeb;
      console.log(`🚫 [${this.getName()}] searchWeb disabled`);
    }

    if (
      this.getName() === 'Vision Agent' &&
      provider === 'openrouter' &&
      !isOpenRouterVisionToolCallingEnabled()
    ) {
      const toolCount = Object.keys(filtered).length;
      if (toolCount > 0) {
        logger.warn(
          `⚠️ [Vision Agent] OpenRouter free-tier compatibility mode: disabling ${toolCount} tools (set OPENROUTER_VISION_TOOL_CALLING=true to override)`
        );
      }
      return {};
    }

    return filtered;
  }

  protected isVisionOpenRouter(provider: string, agentName?: string): boolean {
    return (agentName ?? this.getName()) === 'Vision Agent' && provider === 'openrouter';
  }

  protected resolveMaxOutputTokens(
    options: AgentRunOptions,
    provider: string,
    agentName?: string
  ): number {
    const requested = options.maxOutputTokens ?? DEFAULT_OPTIONS.maxOutputTokens;

    if (
      this.isVisionOpenRouter(provider, agentName) &&
      requested < OPENROUTER_VISION_MIN_OUTPUT_TOKENS
    ) {
      logger.warn(
        `⚠️ [Vision Agent] OpenRouter maxOutputTokens too low (${requested}), overriding to ${OPENROUTER_VISION_MIN_OUTPUT_TOKENS}`
      );
      return OPENROUTER_VISION_MIN_OUTPUT_TOKENS;
    }

    return requested;
  }

  protected getEmptyResponseFallbackMessage(
    provider: string,
    modelId: string,
    agentName?: string
  ): string {
    if (this.isVisionOpenRouter(provider, agentName)) {
      return VISION_EMPTY_RESPONSE_FALLBACK;
    }

    logger.warn(
      `⚠️ [${agentName ?? this.getName()}] Empty response from ${provider}/${modelId}, using generic fallback message`
    );
    return GENERIC_EMPTY_RESPONSE_FALLBACK;
  }

  /**
   * Build multimodal user message content
   *
   * AI SDK v6 Best Practice: Include images/files directly in message content
   * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
   *
   * @param query - Text query
   * @param options - Options with images/files
   * @returns Content array or string (for text-only)
   */
  protected buildUserContent(
    query: string,
    options: AgentRunOptions
  ): UserContent {
    const hasImages = options.images && options.images.length > 0;
    const hasFiles = options.files && options.files.length > 0;

    // Text-only: return simple string (most common case)
    if (!hasImages && !hasFiles) {
      return query;
    }

    // Multimodal: build content array with AI SDK-compatible types
    const content: Array<TextPart | ImagePart | FilePart> = [
      { type: 'text', text: query } as TextPart,
    ];

    // Add images (Vision Agent)
    if (hasImages) {
      for (const img of options.images!) {
        content.push({
          type: 'image',
          image: img.data,
          mimeType: img.mimeType,
        } as ImagePart);
      }
      console.log(`📷 [${this.getName()}] Added ${options.images!.length} image(s) to message`);
    }

    // Add files (PDF, audio, etc.)
    // Note: AI SDK FilePart uses 'mediaType' not 'mimeType'
    if (hasFiles) {
      for (const file of options.files!) {
        content.push({
          type: 'file',
          data: file.data,
          mediaType: file.mimeType, // AI SDK uses 'mediaType'
        } as FilePart);
      }
      console.log(`📎 [${this.getName()}] Added ${options.files!.length} file(s) to message`);
    }

    return content;
  }

  /**
   * Execute agent with query and return complete result
   *
   * Uses AI SDK v6 generateText with stopWhen conditions:
   * - hasToolCall('finalAnswer'): Graceful termination when agent calls finalAnswer
   * - stepCountIs(maxSteps): Safety limit to prevent infinite loops
   *
   * @param query - User query to process
   * @param options - Execution options
   * @returns AgentResult with response and metadata
   */
  async run(query: string, options: AgentRunOptions = {}): Promise<AgentResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const agentName = this.getName();

    console.log(`🤖 [${agentName}] Starting execution...`);

    // Validate configuration
    const config = this.getConfig();
    if (!config) {
      return {
        text: '',
        success: false,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'none',
          modelId: 'none',
          durationMs: Date.now() - startTime,
          steps: 0,
        },
        error: `Agent ${agentName} config not found`,
      };
    }

    const modelResult = config.getModel();
    if (!modelResult) {
      return {
        text: '',
        success: false,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'none',
          modelId: 'none',
          durationMs: Date.now() - startTime,
          steps: 0,
        },
        error: `No model available for ${agentName}`,
      };
    }

    const { model, provider, modelId } = modelResult;
    const maxOutputTokens = this.resolveMaxOutputTokens(opts, provider, agentName);
    const filteredTools = this.filterTools(
      config.tools as Record<string, Tool>,
      opts,
      provider
    );

    console.log(`🎯 [${agentName}] Using ${provider}/${modelId}`);

    try {
      // Build multimodal user content (text + images + files)
      const userContent = this.buildUserContent(query, opts);

      // Execute with AI SDK v6 native pattern
      const result = await generateText({
        model,
        system: config.instructions,
        messages: [{ role: 'user', content: userContent }],
        tools: filteredTools,
        maxRetries: 1,
        // 🎯 Fix: Apply timeout configuration (AI SDK v6.0.50)
        // Defensive: use default if undefined to avoid SDK validation errors
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, stepMs: (opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs) - 5_000 },
        // AI SDK v6 Best Practice: Graceful termination conditions
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(opts.maxSteps)],
        temperature: opts.temperature,
        maxOutputTokens,
        // Step-by-step monitoring
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map(tc => tc.toolName) || [];
          console.log(`📍 [${agentName}] Step: reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      // Extract tool calls and check for finalAnswer
      const toolsCalled: string[] = [];
      let finalAnswerResult: { answer: string } | null = null;
      let finishReason = 'stop';

      for (const step of result.steps) {
        if (step.finishReason) {
          finishReason = step.finishReason;
        }
        for (const toolCall of step.toolCalls) {
          toolsCalled.push(toolCall.toolName);
        }
        // Extract finalAnswer result if called
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            const trOutput = extractToolResultOutput(tr);
            if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
              const result = trOutput as Record<string, unknown>;
              if ('answer' in result && typeof result.answer === 'string') {
                finalAnswerResult = { answer: result.answer };
              }
            }
          }
        }
      }

      // Use finalAnswer if called, otherwise fall back to result.text
      const responseText = finalAnswerResult?.answer ?? result.text;
      let sanitizedText = sanitizeChineseCharacters(responseText);
      let fallbackUsed = false;
      let fallbackReason: string | undefined;
      if (!sanitizedText || sanitizedText.trim().length === 0) {
        logger.warn(
          `⚠️ [${agentName}] Empty response from ${provider}/${modelId} (finish=${finishReason}, outputTokens=${result.usage?.outputTokens ?? 0})`
        );
        sanitizedText = this.getEmptyResponseFallbackMessage(
          provider,
          modelId,
          agentName
        );
        fallbackUsed = true;
        fallbackReason = 'EMPTY_RESPONSE';
      }

      const durationMs = Date.now() - startTime;
      console.log(`✅ [${agentName}] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]`);

      return {
        text: sanitizedText,
        success: true,
        toolsCalled,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
        metadata: {
          provider,
          modelId,
          durationMs,
          steps: result.steps.length,
          finishReason,
          fallbackUsed,
          fallbackReason,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error(`❌ [${agentName}] Error after ${durationMs}ms:`, errorMessage);

      return {
        text: '',
        success: false,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider,
          modelId,
          durationMs,
          steps: 0,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Execute agent with streaming response
   *
   * Yields AgentStreamEvent chunks in real-time for progressive UI updates.
   *
   * @param query - User query to process
   * @param options - Execution options
   * @yields AgentStreamEvent - Real-time streaming events
   */
  async *stream(query: string, options: AgentRunOptions = {}): AsyncGenerator<AgentStreamEvent> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const agentName = this.getName();

    console.log(`🤖 [${agentName}] Starting stream...`);

    // Validate configuration
    const config = this.getConfig();
    if (!config) {
      yield { type: 'error', data: { code: 'CONFIG_NOT_FOUND', error: `Agent ${agentName} config not found` } };
      return;
    }

    const modelResult = config.getModel();
    if (!modelResult) {
      yield { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: `No model available for ${agentName}` } };
      return;
    }

    const { model, provider, modelId } = modelResult;
    const maxOutputTokens = this.resolveMaxOutputTokens(opts, provider, agentName);
    const filteredTools = this.filterTools(
      config.tools as Record<string, Tool>,
      opts,
      provider
    );

    console.log(`🎯 [${agentName}] Streaming with ${provider}/${modelId}`);

    try {
      // Build multimodal user content (text + images + files)
      const userContent = this.buildUserContent(query, opts);

      const streamResult = streamText({
        model,
        system: config.instructions,
        messages: [{ role: 'user', content: userContent }],
        tools: filteredTools,
        // 🎯 Fix: Apply timeout configuration (AI SDK v6.0.50)
        // Defensive: use default if undefined to avoid SDK validation errors
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, chunkMs: 30_000 },
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(opts.maxSteps)],
        temperature: opts.temperature,
        maxOutputTokens,
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map(tc => tc.toolName) || [];
          console.log(`📍 [${agentName}] Step: reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      const toolsCalled: string[] = [];
      let hasTextContent = false;

      // Stream text deltas
      for await (const textChunk of streamResult.textStream) {
        const sanitized = sanitizeChineseCharacters(textChunk);
        // 🎯 Fix: Only set hasTextContent for non-whitespace content (Codex review feedback)
        // This ensures finalAnswer fallback works when stream is empty/whitespace-only
        if (sanitized && sanitized.trim().length > 0) {
          hasTextContent = true;
          yield { type: 'text_delta', data: sanitized };
        }
      }

      // Gather metadata after streaming completes
      const [steps, usage] = await Promise.all([streamResult.steps, streamResult.usage]);

      // Extract tool calls and finalAnswer result
      let finalAnswerText: string | null = null;
      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              toolsCalled.push(tc.toolName);
              yield { type: 'tool_call', data: { name: tc.toolName } };
            }
          }
          // 🎯 Fix: Extract finalAnswer from toolResults (Codex review feedback)
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const trOutput = extractToolResultOutput(tr);
              if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
                const result = trOutput as Record<string, unknown>;
                if ('answer' in result && typeof result.answer === 'string') {
                  finalAnswerText = result.answer;
                }
              }
            }
          }
        }
      }

      // 🎯 Fix: If no text was streamed but finalAnswer exists, emit it
      if (!hasTextContent && finalAnswerText) {
        const sanitized = sanitizeChineseCharacters(finalAnswerText);
        if (sanitized && sanitized.trim().length > 0) {
          yield { type: 'text_delta', data: sanitized };
          hasTextContent = true;
        }
      }

      if (!hasTextContent) {
        const fallbackText = this.getEmptyResponseFallbackMessage(
          provider,
          modelId,
          agentName
        );
        logger.warn(
          `⚠️ [${agentName}] Stream completed with empty content from ${provider}/${modelId}, emitting fallback`
        );
        yield {
          type: 'warning',
          data: {
            code: 'EMPTY_RESPONSE',
            message: fallbackText,
          },
        };
        yield { type: 'text_delta', data: fallbackText };
      }

      const durationMs = Date.now() - startTime;
      console.log(`✅ [${agentName}] Stream completed in ${durationMs}ms`);

      yield {
        type: 'done',
        data: {
          success: true,
          finalAgent: agentName,
          toolsCalled,
          usage: {
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
          },
          metadata: { provider, modelId, durationMs },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error(`❌ [${agentName}] Stream error after ${durationMs}ms:`, errorMessage);
      yield { type: 'error', data: { code: 'STREAM_ERROR', error: errorMessage } };
    }
  }
}
