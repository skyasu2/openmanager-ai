/**
 * Orchestrator Routing Logic
 *
 * Model selection, Reporter Pipeline, Agent config/forced routing,
 * and AgentFactory-based execution.
 *
 * @version 4.0.0
 */

import { generateText, hasToolCall, stepCountIs } from 'ai';
import type { ProviderName } from '../model-provider';
import { generateTextWithRetry } from '../../resilience/retry-with-fallback';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { AGENT_CONFIGS, type AgentConfig } from './config';
import { selectTextModel } from './config/agent-model-selectors';
import { executeReporterPipeline } from './reporter-pipeline';
import { createSupervisorTrace } from '../../observability/langfuse';
import { AgentFactory, type AgentType } from './agent-factory';
import type { ImageAttachment, FileAttachment } from './base-agent';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';

import type { MultiAgentResponse } from './orchestrator-types';
import { filterToolsByWebSearch } from './orchestrator-web-search';
import { evaluateAgentResponseQuality } from './response-quality';
import { logger } from '../../../lib/logger';
// ============================================================================
// Handoff Event Tracking — Ring Buffer (Cloud Run Memory Safety)
// ============================================================================

type HandoffEvent = { from: string; to: string; reason?: string; timestamp: Date };

const HANDOFF_MAX = 50;
const handoffBuffer: (HandoffEvent | null)[] = new Array(HANDOFF_MAX).fill(null);
let handoffHead = 0;   // next write index
let handoffCount = 0;  // total stored

export function recordHandoff(from: string, to: string, reason?: string) {
  handoffBuffer[handoffHead] = { from, to, reason, timestamp: new Date() };
  handoffHead = (handoffHead + 1) % HANDOFF_MAX;
  if (handoffCount < HANDOFF_MAX) handoffCount++;
  logger.info(`[Handoff] ${from} → ${to} (${reason || 'no reason'}) [${handoffCount}/${HANDOFF_MAX}]`);
}

export function getRecentHandoffs(n = 10): HandoffEvent[] {
  const result: HandoffEvent[] = [];
  const start = (handoffHead - handoffCount + HANDOFF_MAX) % HANDOFF_MAX;
  const count = Math.min(n, handoffCount);
  const offset = handoffCount - count;
  for (let i = 0; i < count; i++) {
    const idx = (start + offset + i) % HANDOFF_MAX;
    const event = handoffBuffer[idx];
    if (event) result.push(event);
  }
  return result;
}

// ============================================================================
// Orchestrator Model (3-way fallback)
// ============================================================================

export function getOrchestratorModel() {
  // Orchestrator uses generateObject (requires json_schema support).
  // Groq llama-3.3-70b-versatile does NOT support json_schema,
  // so prefer Cerebras/Mistral first.
  return selectTextModel('Orchestrator', ['cerebras', 'mistral', 'groq']);
}

// Log available agents from AGENT_CONFIGS
const availableAgentNames = Object.keys(AGENT_CONFIGS).filter(name => {
  const config = AGENT_CONFIGS[name];
  return config && config.getModel() !== null;
});

if (availableAgentNames.length === 0) {
  logger.error('❌ [CRITICAL] No agents available! Check API keys: CEREBRAS_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY');
} else {
  logger.info(`[Orchestrator] Available agents: ${availableAgentNames.length} - [${availableAgentNames.join(', ')}]`);
}

// ============================================================================
// Reporter Pipeline Execution
// ============================================================================

export async function executeReporterWithPipeline(
  query: string,
  startTime: number
): Promise<MultiAgentResponse | null> {
  logger.info(`[ReporterPipeline] Starting pipeline for query: "${query.substring(0, 50)}..."`);

  try {
    const pipelineResult = await executeReporterPipeline(query, {
      qualityThreshold: 0.75,
      maxIterations: 2,
      timeout: 45_000,
    });

    if (!pipelineResult.success || !pipelineResult.report) {
      logger.warn(`⚠️ [ReporterPipeline] Pipeline failed: ${pipelineResult.error || 'No report generated'}`);
      return null;
    }

    const durationMs = Date.now() - startTime;

    let responseText = pipelineResult.report.markdown ?? '';

    if (!responseText) {
      responseText = `# ${pipelineResult.report.title}\n\n`;
      responseText += `## 요약\n${pipelineResult.report.summary}\n\n`;

      if (pipelineResult.report.affectedServers.length > 0) {
        responseText += `## 영향받은 서버 (${pipelineResult.report.affectedServers.length}대)\n`;
        for (const server of pipelineResult.report.affectedServers) {
          responseText += `- **${server.name}** (${server.status}): ${server.primaryIssue}\n`;
        }
        responseText += '\n';
      }

      if (pipelineResult.report.rootCause) {
        responseText += `## 근본 원인 분석\n`;
        responseText += `- **원인**: ${pipelineResult.report.rootCause.cause}\n`;
        responseText += `- **신뢰도**: ${(pipelineResult.report.rootCause.confidence * 100).toFixed(0)}%\n`;
        responseText += `- **제안**: ${pipelineResult.report.rootCause.suggestedFix}\n\n`;
      }

      if (pipelineResult.report.suggestedActions.length > 0) {
        responseText += `## 권장 조치\n`;
        for (const action of pipelineResult.report.suggestedActions) {
          responseText += `- ${action}\n`;
        }
      }
    }

    const sanitizedResponse = sanitizeChineseCharacters(responseText);
    const quality = evaluateAgentResponseQuality('Reporter Agent', sanitizedResponse, {
      durationMs,
    });

    // Record quality scores to Langfuse for quantitative evaluation (non-blocking)
    try {
      const trace = createSupervisorTrace({
        sessionId: `reporter-pipeline-${Date.now()}`,
        mode: 'multi',
        query,
      });
      trace.score({ name: 'report-initial-score', value: pipelineResult.quality.initialScore });
      trace.score({ name: 'report-final-score', value: pipelineResult.quality.finalScore });
      trace.score({ name: 'report-correction-rate', value: pipelineResult.quality.finalScore - pipelineResult.quality.initialScore });
    } catch (error) {
      logger.warn(`⚠️ [ReporterPipeline] Langfuse score recording failed (non-blocking):`, error instanceof Error ? error.message : error);
    }

    logger.info(
      `[ReporterPipeline] Completed in ${durationMs}ms, ` +
      `Quality: ${(pipelineResult.quality.initialScore * 100).toFixed(0)}% → ${(pipelineResult.quality.finalScore * 100).toFixed(0)}%, ` +
      `Iterations: ${pipelineResult.quality.iterations}`
    );

    return {
      success: true,
      response: sanitizedResponse,
      handoffs: [{
        from: 'Orchestrator',
        to: 'Reporter Agent',
        reason: `Pipeline execution (quality: ${(pipelineResult.quality.finalScore * 100).toFixed(0)}%)`,
      }],
      finalAgent: 'Reporter Agent',
      toolsCalled: ['executeReporterPipeline'],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'pipeline',
        modelId: 'reporter-pipeline',
        totalRounds: pipelineResult.quality.iterations,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        qualityScore: pipelineResult.quality.finalScore,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [ReporterPipeline] Error: ${errorMessage}`);
    return null;
  }
}

// ============================================================================
// Agent Execution (AI SDK v6 Native)
// ============================================================================

export function getAgentConfig(name: string): AgentConfig | null {
  return AGENT_CONFIGS[name] ?? null;
}

function getAgentProviderOrder(agentName: string): ProviderName[] {
  switch (agentName) {
    case 'NLQ Agent':
      return ['cerebras', 'groq', 'mistral'];
    case 'Advisor Agent':
      return ['mistral', 'cerebras', 'groq'];
    case 'Analyst Agent':
      return ['cerebras', 'groq', 'mistral'];
    case 'Reporter Agent':
      return ['groq', 'cerebras', 'mistral'];
    default:
      return ['cerebras', 'groq', 'mistral'];
  }
}

/**
 * Per-agent maxSteps configuration
 *
 * Analyst/Reporter need more steps for multi-tool workflows:
 * - Analyst: detectAnomaliesAllServers + searchKnowledgeBase + findRootCause + finalAnswer
 * - Reporter: buildIncidentTimeline + findRootCause + correlateMetrics + finalAnswer
 */
function getAgentMaxSteps(agentName: string): number {
  switch (agentName) {
    case 'Analyst Agent':
    case 'Reporter Agent':
      return 10;
    default:
      return 7;
  }
}

export async function executeForcedRouting(
  query: string,
  suggestedAgentName: string,
  startTime: number,
  webSearchEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[]
): Promise<MultiAgentResponse | null> {
  logger.info(`[Forced Routing] Looking up agent config: "${suggestedAgentName}"`);

  if (suggestedAgentName === 'Reporter Agent') {
    logger.info(`[Forced Routing] Routing to Reporter Pipeline`);
    const pipelineResult = await executeReporterWithPipeline(query, startTime);
    if (pipelineResult) {
      return pipelineResult;
    }
    logger.info(`[Forced Routing] Pipeline failed, falling back to direct Reporter Agent`);
  }

  const agentConfig = AGENT_CONFIGS[suggestedAgentName];

  if (!agentConfig) {
    logger.warn(`⚠️ [Forced Routing] No config for "${suggestedAgentName}"`);
    return null;
  }

  const providerOrder = getAgentProviderOrder(suggestedAgentName);
  logger.info(`[Forced Routing] Using retry with fallback: [${providerOrder.join(' → ')}]`);

  const filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
  const attachmentHint =
    images?.length || files?.length
      ? `\n\n[첨부 컨텍스트]\n- images: ${images?.length ?? 0}\n- files: ${files?.length ?? 0}`
      : '';

  // Per-agent maxSteps: Analyst/Reporter need more steps for multi-tool workflows
  const agentMaxSteps = getAgentMaxSteps(suggestedAgentName);

  try {
    const retryResult = await generateTextWithRetry(
      {
        messages: [
          { role: 'system', content: agentConfig.instructions },
          { role: 'user', content: `${query}${attachmentHint}` },
        ],
        tools: filteredTools as Parameters<typeof generateText>[0]['tools'],
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(agentMaxSteps)],
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      providerOrder,
      { timeoutMs: 60000 }
    );

    if (!retryResult.success || !retryResult.result) {
      logger.warn(`⚠️ [Forced Routing] All providers failed for ${suggestedAgentName}`);
      for (const attempt of retryResult.attempts) {
        logger.warn(`  - ${attempt.provider}: ${attempt.error || 'unknown error'}`);
      }
      return null;
    }

    const { result, provider, modelId, usedFallback, attempts } = retryResult;
    const durationMs = Date.now() - startTime;

    const toolsCalled: string[] = [];
    let finalAnswerResult: { answer: string } | null = null;
    const ragSources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }> = [];

    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        toolsCalled.push(toolCall.toolName);
      }
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const trOutput = extractToolResultOutput(tr);

          if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
            finalAnswerResult = trOutput as { answer: string };
          }

          if (tr.toolName === 'searchKnowledgeBase' && trOutput && typeof trOutput === 'object') {
            const kbResult = trOutput as Record<string, unknown>;
            const similarCases = (kbResult.similarCases ?? kbResult.results) as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(similarCases)) {
              for (const doc of similarCases) {
                ragSources.push({
                  title: String(doc.title ?? doc.name ?? 'Unknown'),
                  similarity: Number(doc.similarity ?? doc.score ?? 0),
                  sourceType: String(doc.sourceType ?? doc.type ?? 'vector'),
                  category: doc.category ? String(doc.category) : undefined,
                });
              }
            }
          }

          if (tr.toolName === 'searchWeb' && trOutput && typeof trOutput === 'object') {
            const webResult = trOutput as Record<string, unknown>;
            const webResults = webResult.results as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(webResults)) {
              for (const doc of webResults) {
                ragSources.push({
                  title: String(doc.title ?? 'Web Result'),
                  similarity: Number(doc.score ?? 0),
                  sourceType: 'web',
                  category: 'web-search',
                  url: doc.url ? String(doc.url) : undefined,
                });
              }
            }
          }
        }
      }
    }

    let response = finalAnswerResult?.answer ?? result.text;

    // Summarization Fallback: if model called tools but produced no text,
    // re-run generateText without tools to summarize tool results.
    if (!response && toolsCalled.length > 0) {
      logger.warn(`[Forced Routing] ${suggestedAgentName}: Empty response with ${toolsCalled.length} tool calls — summarization fallback`);

      try {
        const uniqueResults = new Map<string, unknown>();
        for (const step of result.steps) {
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const trOutput = extractToolResultOutput(tr);
              if (!uniqueResults.has(tr.toolName)) {
                uniqueResults.set(tr.toolName, trOutput);
              }
            }
          }
        }

        const toolResultsSummary = Array.from(uniqueResults.entries())
          .map(([name, r]) => `[${name}]: ${JSON.stringify(r).slice(0, 2000)}`)
          .join('\n\n');

        const summaryResult = await generateTextWithRetry(
          {
            messages: [
              {
                role: 'system',
                content: '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
              },
              {
                role: 'user',
                content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
              },
            ],
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
          providerOrder,
          { timeoutMs: 30000 }
        );

        if (summaryResult.success && summaryResult.result?.text) {
          response = summaryResult.result.text;
          logger.info(`[Forced Routing] Summarization fallback succeeded (${response.length} chars)`);
        }
      } catch (summaryError) {
        logger.warn(
          `[Forced Routing] Summarization fallback failed:`,
          summaryError instanceof Error ? summaryError.message : String(summaryError)
        );
      }
    }

    const sanitizedResponse = sanitizeChineseCharacters(response);
    const quality = evaluateAgentResponseQuality(
      suggestedAgentName,
      sanitizedResponse,
      { durationMs }
    );

    if (usedFallback) {
      logger.info(`[Forced Routing] Used fallback: ${attempts.map(a => a.provider).join(' → ')}`);
    }

    logger.info(
      `[Forced Routing] ${suggestedAgentName} completed in ${durationMs}ms via ${provider}, tools: [${toolsCalled.join(', ')}], ragSources: ${ragSources.length}`
    );

    return {
      success: true,
      response: sanitizedResponse,
      ragSources: ragSources.length > 0 ? ragSources : undefined,
      handoffs: [{
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason: usedFallback
          ? `Forced routing with fallback (${attempts.length} attempts)`
          : 'Forced routing (high confidence pre-filter)',
      }],
      finalAgent: suggestedAgentName,
      toolsCalled,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      metadata: {
        provider,
        modelId,
        totalRounds: attempts.length,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [Forced Routing] ${suggestedAgentName} failed:`, errorMessage);
    return null;
  }
}

// ============================================================================
// AgentFactory-based Execution
// ============================================================================

export function getAgentTypeFromName(agentName: string): AgentType | null {
  const mapping: Record<string, AgentType> = {
    'NLQ Agent': 'nlq',
    'Analyst Agent': 'analyst',
    'Reporter Agent': 'reporter',
    'Advisor Agent': 'advisor',
    'Vision Agent': 'vision',
    'Evaluator Agent': 'evaluator',
    'Optimizer Agent': 'optimizer',
  };
  return mapping[agentName] ?? null;
}

export async function executeWithAgentFactory(
  query: string,
  agentType: AgentType,
  startTime: number,
  webSearchEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[]
): Promise<MultiAgentResponse | null> {
  const agent = AgentFactory.create(agentType);

  if (!agent) {
    logger.warn(`⚠️ [AgentFactory] Agent ${agentType} not available (no model configured)`);
    return null;
  }

  const agentName = agent.getName();
  logger.info(`[AgentFactory] Executing ${agentName}...`);

  try {
    const result = await agent.run(query, {
      webSearchEnabled,
      maxSteps: 10,
      timeoutMs: TIMEOUT_CONFIG.agent.hard,
      images,
      files,
    });

    if (!result.success) {
      logger.error(`❌ [AgentFactory] ${agentName} failed: ${result.error}`);
      return {
        success: false,
        response: `에이전트 실행 실패: ${result.error}`,
        handoffs: [{
          from: 'Orchestrator',
          to: agentName,
          reason: `AgentFactory routing - failed: ${result.error}`,
        }],
        finalAgent: agentName,
        toolsCalled: result.toolsCalled,
        usage: result.usage,
        metadata: {
          provider: result.metadata.provider,
          modelId: result.metadata.modelId,
          totalRounds: result.metadata.steps,
          durationMs: Date.now() - startTime,
          responseChars: result.metadata.responseChars,
          formatCompliance: result.metadata.formatCompliance,
          qualityFlags: result.metadata.qualityFlags,
          latencyTier: result.metadata.latencyTier,
        },
      };
    }

    const durationMs = Date.now() - startTime;
    recordHandoff('Orchestrator', agentName, 'AgentFactory routing');

    return {
      success: true,
      response: result.text,
      handoffs: [{
        from: 'Orchestrator',
        to: agentName,
        reason: 'AgentFactory routing',
      }],
      finalAgent: agentName,
      toolsCalled: result.toolsCalled,
      usage: result.usage,
      metadata: {
        provider: result.metadata.provider,
        modelId: result.metadata.modelId,
        totalRounds: result.metadata.steps,
        durationMs,
        responseChars: result.metadata.responseChars,
        formatCompliance: result.metadata.formatCompliance,
        qualityFlags: result.metadata.qualityFlags,
        latencyTier: result.metadata.latencyTier,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [AgentFactory] ${agentName} exception:`, errorMessage);
    return null;
  }
}
