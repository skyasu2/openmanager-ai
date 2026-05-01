import { TIMEOUT_CONFIG } from '../../../config/timeout-config';
import { logger } from '../../../lib/logger';
import { AgentFactory, type AgentType } from './agent-factory';
import type { ImageAttachment, FileAttachment } from './base-agent';
import { getAgentMaxSteps } from './config';
import { recordHandoff } from './orchestrator-handoff';
import type { MultiAgentResponse } from './orchestrator-types';

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
  ragEnabled = true,
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
      ragEnabled,
      maxSteps: getAgentMaxSteps(agentName),
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
        ...(result.ragSources && { ragSources: result.ragSources }),
        ...(result.evidenceCards && { evidenceCards: result.evidenceCards }),
        metadata: {
          provider: result.metadata.provider,
          modelId: result.metadata.modelId,
          totalRounds: result.metadata.steps,
          handoffCount: 1,
          durationMs: Date.now() - startTime,
          responseChars: result.metadata.responseChars,
          formatCompliance: result.metadata.formatCompliance,
          qualityFlags: result.metadata.qualityFlags,
          latencyTier: result.metadata.latencyTier,
          ...(result.metadata.retrieval && {
            retrieval: result.metadata.retrieval,
          }),
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
      ...(result.ragSources && { ragSources: result.ragSources }),
      ...(result.evidenceCards && { evidenceCards: result.evidenceCards }),
      usage: result.usage,
      metadata: {
        provider: result.metadata.provider,
        modelId: result.metadata.modelId,
        totalRounds: result.metadata.steps,
        handoffCount: 1,
        durationMs,
        responseChars: result.metadata.responseChars,
        formatCompliance: result.metadata.formatCompliance,
        qualityFlags: result.metadata.qualityFlags,
        latencyTier: result.metadata.latencyTier,
        ...(result.metadata.retrieval && {
          retrieval: result.metadata.retrieval,
        }),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [AgentFactory] ${agentName} exception:`, errorMessage);
    return null;
  }
}
