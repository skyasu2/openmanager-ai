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
 * - Redis-based Session Memory & History Recovery
 *
 * @version 2.1.0 - Integrated Session Memory & Context Recovery
 * @created 2026-01-27
 * @updated 2026-02-24 - Session persistence & Redis recovery
 */

import {
  ToolLoopAgent,
  hasToolCall,
  stepCountIs,
  type ToolSet,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import type { AgentConfig, ModelResult } from './config';
import { logger } from '../../../lib/logger';
import { buildUserContent } from './base-agent-multimodal';
import { SessionMemoryService } from '../session-memory';
import {
  filterTools,
  getEmptyResponseFallbackMessage,
  resolveMaxOutputTokens,
} from './base-agent-tooling';
import {
  classifyLatencyTier,
  evaluateAgentResponseQuality,
} from './response-quality';
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
   * Build complete context including Redis history
   */
  private async buildContext(query: string, options: AgentRunOptions): Promise<ModelMessage[]> {
    const userContent = this.buildUserContent(query, options);
    const messages: ModelMessage[] = [];

    // 1. Recover history from Redis if sessionId provided
    if (options.sessionId) {
      try {
        const history = await SessionMemoryService.getHistory(options.sessionId);
        if (history && history.length > 0) {
          messages.push(...history);
        }
      } catch (err) {
        logger.error(`[SessionMemory] History recovery failed for ${options.sessionId}:`, err);
      }
    }

    // 2. Add current user message
    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  /**
   * Execute agent with query and return complete result
   *
   * @param query - User query to process
   * @param options - Execution options
   * @returns AgentResult with response and metadata
   */
  async run(query: string, options: AgentRunOptions = {}): Promise<AgentResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const agentName = this.getName();

    logger.info(`[${agentName}] Starting execution (Session: ${opts.sessionId || 'none'})`);

    // Validate configuration
    const config = this.getConfig();
    if (!config) {
      const durationMs = Date.now() - startTime;
      return {
        text: '',
        success: false,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'none',
          modelId: 'none',
          durationMs,
          steps: 0,
          responseChars: 0,
          formatCompliance: false,
          qualityFlags: ['CONFIG_NOT_FOUND'],
          latencyTier: classifyLatencyTier(durationMs, agentName),
        },
        error: `Agent ${agentName} config not found`,
      };
    }

    const modelResult = config.getModel();
    if (!modelResult) {
      const durationMs = Date.now() - startTime;
      return {
        text: '',
        success: false,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'none',
          modelId: 'none',
          durationMs,
          steps: 0,
          responseChars: 0,
          formatCompliance: false,
          qualityFlags: ['MODEL_UNAVAILABLE'],
          latencyTier: classifyLatencyTier(durationMs, agentName),
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
      // Build context (History + User Content)
      const messages = await this.buildContext(query, opts);

      // Create ToolLoopAgent with resolved configuration
      const agent = this.createToolLoopAgent({
        model,
        instructions: config.instructions,
        tools: filteredTools,
        maxSteps: opts.maxSteps,
        temperature: opts.temperature,
        maxOutputTokens,
      });

      // Execute via ToolLoopAgent.generate()
      const result = await agent.generate({
        messages,
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, stepMs: Math.max((opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs) - 5_000, 5_000) },
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
        if (step.finishReason) finishReason = step.finishReason;
        for (const toolCall of step.toolCalls) toolsCalled.push(toolCall.toolName);
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            const trOutput = extractToolResultOutput(tr);
            if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
              const res = trOutput as Record<string, unknown>;
              if ('answer' in res && typeof res.answer === 'string') {
                finalAnswerResult = { answer: res.answer };
              }
            }
          }
        }
      }

      const responseText = finalAnswerResult?.answer ?? result.text;
      let sanitizedText = sanitizeChineseCharacters(responseText);
      let fallbackUsed = false;
      let fallbackReason: string | undefined;
      
      if (!sanitizedText || sanitizedText.trim().length === 0) {
        logger.warn(`⚠️ [${agentName}] Empty response from ${provider}/${modelId}`);
        sanitizedText = getEmptyResponseFallbackMessage(provider, modelId, agentName);
        fallbackUsed = true;
        fallbackReason = 'EMPTY_RESPONSE';
      }

      // Persist session history in Redis (Async)
      if (opts.sessionId && sanitizedText) {
        const updatedMessages: ModelMessage[] = [
          ...messages,
          { role: 'assistant', content: sanitizedText }
        ];
        SessionMemoryService.saveHistory(opts.sessionId, updatedMessages).catch(err => {
          logger.error(`[SessionMemory] Failed to save history for ${opts.sessionId}:`, err);
        });
      }

      const durationMs = Date.now() - startTime;
      const quality = evaluateAgentResponseQuality(agentName, sanitizedText, {
        durationMs,
        fallbackReason,
      });
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
          responseChars: quality.responseChars,
          formatCompliance: quality.formatCompliance,
          qualityFlags: quality.qualityFlags,
          latencyTier: quality.latencyTier,
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
          provider: 'error',
          modelId: 'error',
          durationMs,
          steps: 0,
          responseChars: 0,
          formatCompliance: false,
          qualityFlags: ['EXECUTION_ERROR'],
          latencyTier: classifyLatencyTier(durationMs, agentName),
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Execute agent with streaming response
   */
  async *stream(query: string, options: AgentRunOptions = {}): AsyncGenerator<AgentStreamEvent> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const agentName = this.getName();

    logger.info(`[${agentName}] Starting stream (Session: ${opts.sessionId || 'none'})`);

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
    const filteredTools = filterTools(config.tools, opts, provider, agentName);

    try {
      const messages = await this.buildContext(query, opts);
      const agent = this.createToolLoopAgent({
        model,
        instructions: config.instructions,
        tools: filteredTools,
        maxSteps: opts.maxSteps,
        temperature: opts.temperature,
        maxOutputTokens,
      });

      const streamResult = await agent.stream({
        messages,
        timeout: { totalMs: opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs, chunkMs: 30_000 },
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map(tc => tc.toolName) || [];
          logger.debug(`[${agentName}] Step: reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      const toolsCalled: string[] = [];
      let hasTextContent = false;
      let fullResponseText = '';
      let streamFallbackReason: string | undefined;

      for await (const textChunk of streamResult.textStream) {
        const sanitized = sanitizeChineseCharacters(textChunk);
        if (sanitized && sanitized.trim().length > 0) {
          hasTextContent = true;
          fullResponseText += sanitized;
          yield { type: 'text_delta', data: sanitized };
        }
      }

      const [steps, usage] = await Promise.all([streamResult.steps, streamResult.usage]);

      let finalAnswerText: string | null = null;
      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              toolsCalled.push(tc.toolName);
              yield { type: 'tool_call', data: { name: tc.toolName } };
            }
          }
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const trOutput = extractToolResultOutput(tr);
              if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
                const res = trOutput as Record<string, unknown>;
                if ('answer' in res && typeof res.answer === 'string') {
                  finalAnswerText = res.answer;
                }
              }
            }
          }
        }
      }

      if (!hasTextContent && finalAnswerText) {
        const sanitized = sanitizeChineseCharacters(finalAnswerText);
        if (sanitized && sanitized.trim().length > 0) {
          fullResponseText = sanitized;
          yield { type: 'text_delta', data: sanitized };
          hasTextContent = true;
        }
      }

      if (!hasTextContent) {
        const fallbackText = getEmptyResponseFallbackMessage(provider, modelId, agentName);
        fullResponseText = fallbackText;
        streamFallbackReason = 'EMPTY_RESPONSE';
        yield { type: 'warning', data: { code: 'EMPTY_RESPONSE', message: fallbackText } };
        yield { type: 'text_delta', data: fallbackText };
      }

      if (opts.sessionId && fullResponseText) {
        const updatedMessages: ModelMessage[] = [
          ...messages,
          { role: 'assistant', content: fullResponseText }
        ];
        SessionMemoryService.saveHistory(opts.sessionId, updatedMessages).catch(err => {
          logger.error(`[SessionMemory] Failed to save history for ${opts.sessionId}:`, err);
        });
      }

      const durationMs = Date.now() - startTime;
      const quality = evaluateAgentResponseQuality(agentName, fullResponseText, {
        durationMs,
        fallbackReason: streamFallbackReason,
      });
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
          metadata: {
            provider,
            modelId,
            durationMs,
            responseChars: quality.responseChars,
            formatCompliance: quality.formatCompliance,
            qualityFlags: quality.qualityFlags,
            latencyTier: quality.latencyTier,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ [${agentName}] Stream error:`, errorMessage);
      yield { type: 'error', data: { code: 'STREAM_ERROR', error: errorMessage } };
    }
  }
}
