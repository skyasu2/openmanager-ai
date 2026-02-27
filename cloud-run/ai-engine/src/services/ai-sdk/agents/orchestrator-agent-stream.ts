import {
  generateText,
  hasToolCall,
  stepCountIs,
  streamText,
  type UserContent,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { buildMultimodalContent, extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { logger } from '../../../lib/logger';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { createTimeoutSpan, logTimeoutEvent } from '../../observability/langfuse';
import { getCircuitBreaker } from '../../resilience/circuit-breaker';
import type { StreamEvent } from '../supervisor';
import type { FileAttachment, ImageAttachment } from './base-agent';
import { getAgentConfig, getAgentProviderOrder, executeReporterWithPipeline } from './orchestrator-routing';
import { saveAgentFindingsToContext } from './orchestrator-context';
import { selectTextModel, type TextProvider, type ModelResult } from './config/agent-model-selectors';
import { ORCHESTRATOR_CONFIG } from './orchestrator-types';
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import { evaluateAgentResponseQuality } from './response-quality';
import { streamTextInChunks } from './orchestrator-decomposition';

export async function* executeAgentStream(
  query: string,
  agentName: string,
  startTime: number,
  sessionId: string,
  webSearchEnabled = true,
  ragEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[]
): AsyncGenerator<StreamEvent> {
  const agentConfig = getAgentConfig(agentName);

  if (!agentConfig) {
    yield {
      type: 'error',
      data: { code: 'AGENT_NOT_FOUND', error: `Agent ${agentName} not found` },
    };
    return;
  }

  // Phase 3: Reporter Pipeline — run deterministic pipeline first, then stream result
  if (agentName === 'Reporter Agent') {
    try {
      const pipelineResult = await executeReporterWithPipeline(query, startTime);
      if (pipelineResult) {
        logger.info(`[Stream Reporter] Pipeline succeeded, streaming result`);
        yield* streamTextInChunks(pipelineResult.response);

        // Phase 2C: Context saving
        try { await saveAgentFindingsToContext(sessionId, agentName, pipelineResult.response); } catch { /* non-blocking */ }

        const durationMs = Date.now() - startTime;
        yield {
          type: 'done',
          data: {
            success: true,
            finalAgent: agentName,
            toolsCalled: pipelineResult.toolsCalled,
            handoffs: pipelineResult.handoffs,
            usage: {
              promptTokens: pipelineResult.usage?.promptTokens ?? 0,
              completionTokens: pipelineResult.usage?.completionTokens ?? 0,
            },
            metadata: { ...pipelineResult.metadata, durationMs },
          },
        };
        return;
      }
      logger.info(`[Stream Reporter] Pipeline failed, falling back to raw streamText`);
    } catch (pipelineError) {
      logger.warn(`[Stream Reporter] Pipeline error, falling back:`, pipelineError instanceof Error ? pipelineError.message : String(pipelineError));
    }
  }

  // Vision Agent: use native model (gemini) directly, skip text provider chain
  const isVisionAgent = agentName === 'Vision Agent';
  const nativeModel = isVisionAgent ? agentConfig.getModel() : null;

  // Phase 2A: Provider fallback — try multiple providers on failure
  const TEXT_PROVIDERS: TextProvider[] = ['cerebras', 'groq', 'mistral'];
  const rawProviderOrder = getAgentProviderOrder(agentName);
  const providerOrder = isVisionAgent
    ? [] // Vision Agent skips text providers
    : rawProviderOrder.filter((p): p is TextProvider => TEXT_PROVIDERS.includes(p as TextProvider));
  const excludedProviders: string[] = [];
  let lastError: string | undefined;

  // Build provider attempt list: Vision Agent uses native model, others use text providers
  const providerAttempts: ModelResult[] = [];

  if (isVisionAgent && nativeModel) {
    // Vision Agent: single attempt with native model (gemini/openrouter)
    providerAttempts.push(nativeModel);
  } else if (isVisionAgent && !nativeModel) {
    // Vision model unavailable — will fall through to "all providers exhausted"
    logger.warn(`[Stream ${agentName}] Native vision model unavailable`);
  }

  // Text agents: build attempts from provider order
  for (const attemptProvider of providerOrder) {
    const circuitBreaker = getCircuitBreaker(`orchestrator-${attemptProvider}`);
    if (!circuitBreaker.isAllowed()) {
      logger.warn(`🔌 [Stream ${agentName}] CB OPEN for ${attemptProvider}, trying next`);
      continue;
    }

    const modelResult = selectTextModel(agentName, [attemptProvider]);
    if (!modelResult) {
      logger.debug(`[Stream ${agentName}] No model for ${attemptProvider}, trying next`);
      continue;
    }

    providerAttempts.push(modelResult);
  }

  for (const { model, provider, modelId } of providerAttempts) {
    if (excludedProviders.includes(provider)) continue;
    logger.debug(`[Stream ${agentName}] Attempting ${provider}/${modelId}`);

    let filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
    filteredTools = filterToolsByRAG(filteredTools, ragEnabled);
    const timeoutSpan = createTimeoutSpan(sessionId, `${agentName}_stream`, ORCHESTRATOR_CONFIG.timeout);
    const abortController = new AbortController();

    try {
      const userContent = buildMultimodalContent(query, images, files);

      const streamResult = streamText({
        model,
        messages: [
          { role: 'system', content: agentConfig.instructions },
          { role: 'user', content: userContent as UserContent },
        ],
        tools: filteredTools as Parameters<typeof generateText>[0]['tools'],
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(10)],
        temperature: 0.4,
        maxOutputTokens: 2048,
        timeout: {
          totalMs: TIMEOUT_CONFIG.agent.hard,
          stepMs: TIMEOUT_CONFIG.subtask.hard,
          chunkMs: 25_000,
        },
        abortSignal: abortController.signal,
        onStepFinish: ({ finishReason, toolCalls }) => {
          const toolNames = toolCalls?.map((toolCall) => toolCall.toolName) || [];
          logger.debug(`[${agentName} Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`);
        },
      });

      let warningEmitted = false;
      let hardTimeoutReached = false;
      let textEmitted = false;
      const toolsCalled: string[] = [];
      let fullResponseText = '';
      let fallbackReason: string | undefined;

      for await (const textChunk of streamResult.textStream) {
        const elapsed = Date.now() - startTime;

        if (elapsed >= ORCHESTRATOR_CONFIG.hardTimeout) {
          hardTimeoutReached = true;
          logger.error(`🛑 [Stream ${agentName}] Hard timeout at ${elapsed}ms`);

          logTimeoutEvent('error', {
            operation: `${agentName}_stream_hard_timeout`,
            elapsed,
            threshold: ORCHESTRATOR_CONFIG.hardTimeout,
            sessionId,
          });

          yield {
            type: 'error',
            data: {
              code: 'HARD_TIMEOUT',
              error: `처리 시간이 ${ORCHESTRATOR_CONFIG.hardTimeout / 1000}초를 초과했습니다.`,
              elapsed,
            },
          };

          abortController.abort();
          return;
        }

        if (!warningEmitted && elapsed >= ORCHESTRATOR_CONFIG.warnThreshold) {
          warningEmitted = true;
          logger.warn(`⚠️ [Stream ${agentName}] Exceeding ${ORCHESTRATOR_CONFIG.warnThreshold}ms`);

          yield {
            type: 'warning',
            data: {
              code: 'SLOW_PROCESSING',
              message: '처리 시간이 25초를 초과했습니다.',
              elapsed,
            },
          };

          logTimeoutEvent('warning', {
            operation: `${agentName}_stream`,
            elapsed,
            threshold: ORCHESTRATOR_CONFIG.warnThreshold,
            sessionId,
          });
        }

        const sanitized = sanitizeChineseCharacters(textChunk);
        if (sanitized) {
          textEmitted = true;
          fullResponseText += sanitized;
          yield { type: 'text_delta', data: sanitized };
        }
      }

      if (hardTimeoutReached) {
        return;
      }

      const stepsAndUsage = await Promise.all([streamResult.steps, streamResult.usage]).catch(
        (stepsError) => {
          logger.warn(
            `[Stream ${agentName}] Steps/usage unavailable:`,
            stepsError instanceof Error ? stepsError.message : String(stepsError)
          );
          return undefined;
        }
      );
      const steps = stepsAndUsage?.[0];
      const usage = stepsAndUsage?.[1];
      const finalElapsed = Date.now() - startTime;
      timeoutSpan.complete(true, finalElapsed);

      let finalAnswerResult: { answer: string } | null = null;
      const collectedToolResults: Array<{ toolName: string; result: unknown }> = [];

      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              toolsCalled.push(toolCall.toolName);
              yield { type: 'tool_call', data: { name: toolCall.toolName } };
            }
          }
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              const toolResultOutput = extractToolResultOutput(toolResult);
              collectedToolResults.push({
                toolName: toolResult.toolName,
                result: toolResultOutput,
              });
              if (
                toolResult.toolName === 'finalAnswer' &&
                toolResultOutput &&
                typeof toolResultOutput === 'object'
              ) {
                finalAnswerResult = toolResultOutput as { answer: string };
              }
            }
          }
        }
      }

      if (!textEmitted && finalAnswerResult?.answer) {
        const sanitized = sanitizeChineseCharacters(finalAnswerResult.answer);
        if (sanitized) {
          textEmitted = true;
          fullResponseText += sanitized;
          yield { type: 'text_delta', data: sanitized };
        }
      }

      // Summarization Fallback
      if (!textEmitted && collectedToolResults.length > 0) {
        logger.warn(
          `[Stream ${agentName}] Empty response with ${collectedToolResults.length} tool results — attempting summarization fallback`
        );

        try {
          const uniqueResults = new Map<string, unknown>();
          for (const tr of collectedToolResults) {
            if (!uniqueResults.has(tr.toolName)) {
              uniqueResults.set(tr.toolName, tr.result);
            }
          }

          const toolResultsSummary = Array.from(uniqueResults.entries())
            .map(([name, result]) => `[${name}]: ${JSON.stringify(result).slice(0, 2000)}`)
            .join('\n\n');

          const summaryResult = await generateText({
            model,
            messages: [
              {
                role: 'system',
                content:
                  '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
              },
              {
                role: 'user',
                content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
              },
            ],
            temperature: 0.4,
            maxOutputTokens: 2048,
          });

          const summaryText = sanitizeChineseCharacters(summaryResult.text?.trim() || '');
          if (summaryText) {
            textEmitted = true;
            fullResponseText += summaryText;
            yield { type: 'text_delta', data: summaryText };
            logger.info(`[Stream ${agentName}] Summarization fallback succeeded (${summaryText.length} chars)`);
          }
        } catch (summaryError) {
          logger.warn(
            `[Stream ${agentName}] Summarization fallback failed:`,
            summaryError instanceof Error ? summaryError.message : String(summaryError)
          );
        }
      }

      if (!textEmitted) {
        const fallbackText =
          '응답을 생성하지 못했습니다. 질문을 더 구체적으로 다시 시도해 주세요.';
        logger.warn(`[Stream ${agentName}] Empty response, emitting fallback`);
        fallbackReason = 'EMPTY_RESPONSE';
        yield {
          type: 'warning',
          data: { code: 'EMPTY_RESPONSE', message: '모델이 빈 응답을 반환했습니다.' },
        };
        yield { type: 'text_delta', data: fallbackText };
        fullResponseText = fallbackText;
      }

      const durationMs = Date.now() - startTime;
      const quality = evaluateAgentResponseQuality(agentName, fullResponseText, {
        durationMs,
        fallbackReason,
      });
      logger.info(`[Stream ${agentName}] Completed in ${durationMs}ms via ${provider}, tools: [${toolsCalled.join(', ')}]`);

      // Phase 2C: Save agent findings to context (non-blocking)
      try { await saveAgentFindingsToContext(sessionId, agentName, fullResponseText); } catch { /* non-blocking */ }

      yield {
        type: 'done',
        data: {
          success: true,
          finalAgent: agentName,
          toolsCalled,
          handoffs: [{ from: 'Orchestrator', to: agentName, reason: 'Routing' }],
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
      return; // Success — exit provider loop
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNoOutput = errorMessage.includes('No output generated');

      if (isNoOutput) {
        logger.warn(`[Stream ${agentName}] No output from model (${provider}), providing fallback`);
        yield { type: 'text_delta', data: '모델이 응답을 생성하지 못했습니다. 다시 시도해 주세요.' };
        const quality = evaluateAgentResponseQuality(agentName, '모델이 응답을 생성하지 못했습니다. 다시 시도해 주세요.', {
          durationMs,
          fallbackReason: 'NO_OUTPUT',
        });
        yield {
          type: 'done',
          data: {
            success: false,
            finalAgent: agentName,
            toolsCalled: [],
            handoffs: [],
            usage: { promptTokens: 0, completionTokens: 0 },
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
        return;
      }

      // Record failure for circuit breaker
      try {
        const agentCircuitBreaker = getCircuitBreaker(`orchestrator-${provider}`);
        agentCircuitBreaker.execute(() => Promise.reject(error)).catch(() => {});
      } catch {
        // Ignore circuit breaker recording errors.
      }

      excludedProviders.push(provider);
      lastError = errorMessage;
      logger.warn(`[Stream ${agentName}] Provider ${provider} failed: ${errorMessage}, trying next...`);
      continue; // Try next provider
    }
  }

  // All providers exhausted
  logger.error(`❌ [Stream ${agentName}] All providers failed. Last error: ${lastError}`);
  yield { type: 'error', data: { code: 'STREAM_ERROR', error: lastError ?? `All providers failed for ${agentName}` } };
}
