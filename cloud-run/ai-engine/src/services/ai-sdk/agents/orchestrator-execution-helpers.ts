import type { StreamEvent } from '../supervisor';

import { evaluateAgentResponseQuality } from './response-quality';
import type {
  MultiAgentRequest,
  MultiAgentResponse,
} from './orchestrator-types';
import {
  executeForcedRouting,
  executeWithAgentFactory,
} from './orchestrator-routing';
import { logger } from '../../../lib/logger';

export function getLastUserQuery(
  request: MultiAgentRequest
): string | null {
  return (
    request.messages
      .filter((message) => message.role === 'user')
      .pop()?.content ?? null
  );
}

export async function executeVisionOrFallback(
  query: string,
  startTime: number,
  webSearchEnabled: boolean,
  ragEnabled: boolean,
  images?: Parameters<typeof executeWithAgentFactory>[5],
  files?: Parameters<typeof executeWithAgentFactory>[6]
): Promise<MultiAgentResponse | null> {
  const result = await executeWithAgentFactory(
    query,
    'vision',
    startTime,
    webSearchEnabled,
    ragEnabled,
    images,
    files
  );
  if (result) {
    return result;
  }

  logger.warn('⚠️ [Vision] Gemini unavailable, falling back to Analyst Agent');
  return executeForcedRouting(
    query,
    'Analyst Agent',
    startTime,
    webSearchEnabled,
    ragEnabled,
    images,
    files
  );
}

export function buildFastPathResponse(
  responseText: string,
  startTime: number
): MultiAgentResponse {
  const durationMs = Date.now() - startTime;
  const quality = evaluateAgentResponseQuality('Orchestrator', responseText, {
    durationMs,
  });

  return {
    success: true,
    response: responseText,
    handoffs: [],
    finalAgent: 'Orchestrator (Fast Path)',
    toolsCalled: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metadata: {
      provider: 'rule-based',
      modelId: 'prefilter',
      totalRounds: 1,
      durationMs,
      responseChars: quality.responseChars,
      formatCompliance: quality.formatCompliance,
      qualityFlags: quality.qualityFlags,
      latencyTier: quality.latencyTier,
    },
  };
}

export async function* streamFastPathResponse(
  responseText: string,
  startTime: number
): AsyncGenerator<StreamEvent> {
  const durationMs = Date.now() - startTime;
  logger.info(`[Stream Fast Path] Direct response in ${durationMs}ms`);

  yield { type: 'text_delta', data: responseText };
  yield {
    type: 'done',
    data: {
      success: true,
      finalAgent: 'Orchestrator (Fast Path)',
      toolsCalled: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      metadata: { durationMs, provider: 'rule-based' },
    },
  };
}

export function mapOrchestratorErrorCode(errorMessage: string): string {
  if (errorMessage.includes('API key')) {
    return 'AUTH_ERROR';
  }
  if (errorMessage.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (errorMessage.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (errorMessage.includes('model')) {
    return 'MODEL_ERROR';
  }
  return 'UNKNOWN_ERROR';
}
