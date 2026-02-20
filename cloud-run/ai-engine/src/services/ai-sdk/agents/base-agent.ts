/**
 * BaseAgent - Abstract base class for all agents
 *
 * Encapsulates the common agent execution pattern using AI SDK v6's
 * ToolLoopAgent for tool-loop orchestration with stopWhen conditions.
 *
 * Key Features:
 * - Unified execution interface via run() method
 * - AI SDK v6 ToolLoopAgent: official agent pattern with stopWhen
 * - Provider fallback chain support
 * - Step-by-step monitoring via onStepFinish
 * - Timeout protection with configurable limits
 *
 * @version 2.0.0 - Migrated to ToolLoopAgent composition
 * @created 2026-01-27
 * @updated 2026-02-16 - ToolLoopAgent adoption (AI SDK v6 official pattern)
 */

import {
  ToolLoopAgent,
  hasToolCall,
  stepCountIs,
  type ToolSet,
  type LanguageModel,
} from 'ai';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import type { AgentConfig, ModelResult } from './config';
import { logger } from '../../../lib/logger';
import { buildUserContent } from './base-agent-multimodal';
import {
  filterTools,
  getEmptyResponseFallbackMessage,
  resolveMaxOutputTokens,
} from './base-agent-tooling';
import {
  DEFAULT_OPTIONS,
  type AgentResult,
  type AgentRunOptions,
  type AgentStreamEvent,
} from './base-agent-types';
export type {
  AgentResult,
  AgentRunOptions,
  AgentStreamEvent,
  FileAttachment,
  ImageAttachment,
} from './base-agent-types';

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
   * Create a ToolLoopAgent instance with resolved configuration
   *
   * @param model - Resolved language model
   * @param instructions - Agent system prompt
   * @param tools - Filtered tools map
   * @param maxSteps - Maximum number of steps
   * @returns ToolLoopAgent instance
   */
  private createToolLoopAgent(params: {
    model: LanguageModel;
    instructions: string;
    tools: ToolSet;
    maxSteps: number;
    temperature: number;
    maxOutputTokens: number;
  }) {
    return new ToolLoopAgent({
      model: params.model,
      instructions: params.instructions,
      tools: params.tools,
      stopWhen: [hasToolCall('finalAnswer'), stepCountIs(params.maxSteps)],
      maxRetries: 1,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });
  }

  // Backward-compatible protected hook for subclasses/tests.
  protected buildUserContent(query: string, options: AgentRunOptions) {
    return buildUserContent(this.getName(), query, options);
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

    logger.info(`[${agentName}] Starting execution`);

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
    const maxOutputTokens = resolveMaxOutputTokens(opts, provider, agentName);
    const filteredTools = filterTools(
      config.tools,
      opts,
      provider,
      agentName
    );

    logger.info(`[${agentName}] Using ${provider}/${modelId}`);

    try {
      // Build multimodal user content (text + images + files)
      const userContent = this.buildUserContent(query, opts);

      // Create ToolLoopAgent with resolved configuration
      const agent = this.createToolLoopAgent({
        model,
        instructions: config.instructions,
        tools: filteredTools,
        maxSteps: opts.maxSteps,
        temperature: opts.temperature,
        maxOutputTokens,
      });

      // Execute via ToolLoopAgent.generate() (AI SDK v6 official pattern)
      const result = await agent.generate({
        messages: [{ role: 'user', content: userContent }],
        // 🎯 Fix: Apply timeout configuration (AI SDK v6.0.50)
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, stepMs: Math.max((opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs) - 5_000, 5_000) },
        // Step-by-step monitoring
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map(tc => tc.toolName) || [];
          logger.debug(`[${agentName}] Step: reason=${finishReason}, tools=[${toolNames.join(',')}]`);
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
        sanitizedText = getEmptyResponseFallbackMessage(
          provider,
          modelId,
          agentName
        );
        fallbackUsed = true;
        fallbackReason = 'EMPTY_RESPONSE';
      }

      const durationMs = Date.now() - startTime;
      logger.info(`[${agentName}] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]`);

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

    logger.info(`[${agentName}] Starting stream...`);

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
    const maxOutputTokens = resolveMaxOutputTokens(opts, provider, agentName);
    const filteredTools = filterTools(
      config.tools,
      opts,
      provider,
      agentName
    );

    logger.info(`[${agentName}] Streaming with ${provider}/${modelId}`);

    try {
      // Build multimodal user content (text + images + files)
      const userContent = this.buildUserContent(query, opts);

      // Create ToolLoopAgent with resolved configuration
      const agent = this.createToolLoopAgent({
        model,
        instructions: config.instructions,
        tools: filteredTools,
        maxSteps: opts.maxSteps,
        temperature: opts.temperature,
        maxOutputTokens,
      });

      // Execute via ToolLoopAgent.stream() (AI SDK v6 official pattern)
      const streamResult = await agent.stream({
        messages: [{ role: 'user', content: userContent }],
        // 🎯 Fix: Apply timeout configuration (AI SDK v6.0.50)
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, chunkMs: 30_000 },
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map(tc => tc.toolName) || [];
          logger.debug(`[${agentName}] Step: reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      const toolsCalled: string[] = [];
      let hasTextContent = false;

      // TODO: Tool call events are only yielded after textStream is fully consumed (lines below).
      // This means the client won't see tool_call events interleaved with text_delta events.
      // To fix, switch to streamResult.fullStream which yields interleaved text/tool events,
      // but this requires reworking the event loop and sanitization logic.

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
        const fallbackText = getEmptyResponseFallbackMessage(
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
      logger.info(`[${agentName}] Stream completed in ${durationMs}ms`);

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
