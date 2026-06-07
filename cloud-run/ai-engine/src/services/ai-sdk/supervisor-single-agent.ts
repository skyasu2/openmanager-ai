/**
 * Supervisor Single-Agent Execution
 *
 * Single-agent mode with multi-step tool calling, retry logic,
 * circuit breaker, and streaming support.
 */

import './domain-bootstrap';
import {
  buildOffDomainGuardrailMetadata,
  getOffDomainGuardrail,
} from '../../lib/off-domain-guard';
import { logger } from '../../lib/logger';
import { sanitizeUserFacingResponse } from '../../lib/text-sanitizer';
import { getIntentCategory } from '../../domains/monitoring/routing-policy';
import {
  buildInternalImplementationPathPolicyMetadata,
  buildInternalImplementationPathRefusal,
  shouldRefuseInternalImplementationPathRequest,
} from './internal-disclosure-policy';
import {
  getDefaultDomainHost,
  resolveDomainRuntimeContext,
} from './domain-registry';
import { evaluateAgentResponseQuality } from './agents/response-quality';
import { getSupervisorModel } from './model-provider';
import { normalizeSupervisorIntentFrame } from './supervisor-semantic-metadata';
import {
  buildSupervisorModeMetadata,
  resolveSupervisorModeDecision,
} from './supervisor-mode';
import type {
  SupervisorRequest,
  SupervisorResponse,
  SupervisorError,
  SupervisorHealth,
} from './supervisor-types';
import { resolveDomainEvidenceForStream } from './supervisor-domain-evidence';
import {
  buildDomainEvidenceMetadata,
  getResponseQualityAgentName,
  shouldUseDeterministicDomainEvidenceAnswer,
} from './supervisor-domain-evidence-response';
import { executeMultiAgentMode } from './supervisor-multi-agent-mode';
import { executeSingleAgentMode } from './supervisor-single-agent-mode';

export { executeSupervisorStream } from './supervisor-stream';

// ============================================================================
// Main Entry Point
// ============================================================================

export async function executeSupervisor(
  request: SupervisorRequest
): Promise<SupervisorResponse | SupervisorError> {
  const startTime = Date.now();
  const runtimeContext = await resolveDomainRuntimeContext(request);
  const runtimeMetadata = runtimeContext.metadata;
  const runtimeTools = runtimeContext.host.createToolSet(
    runtimeContext.result.context
  );
  const runtimeRequest: SupervisorRequest =
    request.runtimeHost === runtimeContext.host
      ? request
      : { ...request, runtimeHost: runtimeContext.host };
  const modeDecision = resolveSupervisorModeDecision(runtimeRequest);
  const mode = modeDecision.resolvedMode;
  const queryText =
    runtimeRequest.messages
      .filter((message) => message.role === 'user')
      .at(-1)?.content ?? '';
  const intentFrame = normalizeSupervisorIntentFrame(
    runtimeRequest.metadata?.intentFrame
  );
  const queryIntent = getIntentCategory(queryText, intentFrame);

  logger.info(
    {
      sessionId: request.sessionId,
      requestedMode: modeDecision.requestedMode,
      resolvedMode: modeDecision.resolvedMode,
      modeSelectionSource: modeDecision.modeSelectionSource,
      autoSelectedByComplexity: modeDecision.autoSelectedByComplexity,
    },
    '[Supervisor] Mode resolved'
  );

  if (
    shouldRefuseInternalImplementationPathRequest(
      queryText,
      runtimeRequest.internalDisclosureMode
    )
  ) {
    const durationMs = Date.now() - startTime;
    const response = buildInternalImplementationPathRefusal(queryText);
    return {
      success: true,
      response,
      toolsCalled: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        ...buildInternalImplementationPathPolicyMetadata(durationMs),
        ...buildSupervisorModeMetadata(modeDecision),
        ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
      },
    };
  }

  const domainEvidence =
    (await resolveDomainEvidenceForStream({
      request: runtimeRequest,
      query: queryText,
      domain: runtimeContext.host.domain,
    })) ?? undefined;
  if (
    domainEvidence &&
    shouldUseDeterministicDomainEvidenceAnswer(domainEvidence)
  ) {
    const durationMs = Date.now() - startTime;
    const response = sanitizeUserFacingResponse(domainEvidence.fallback);
    const qualityAgentName = getResponseQualityAgentName(queryIntent);
    const quality = evaluateAgentResponseQuality(qualityAgentName, response, {
      durationMs,
    });

    return {
      success: true,
      response,
      toolsCalled: [domainEvidence.id],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'deterministic',
        modelId: domainEvidence.id,
        stepsExecuted: 0,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        finalAgent: qualityAgentName,
        mode: modeDecision.resolvedMode,
        ...buildSupervisorModeMetadata(modeDecision),
        ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
        domainEvidence: buildDomainEvidenceMetadata(domainEvidence),
        ...(domainEvidence.metadata?.semanticQueryTrace !== undefined &&
        domainEvidence.metadata.semanticQueryTrace !== null
          ? { semanticQueryTrace: domainEvidence.metadata.semanticQueryTrace }
          : {}),
      },
    };
  }

  const offDomainGuardrail = getOffDomainGuardrail(queryText);
  if (offDomainGuardrail?.action === 'block') {
    const durationMs = Date.now() - startTime;
    logger.info(
      { category: offDomainGuardrail.category },
      'Supervisor: off-domain hard block triggered'
    );
    return {
      success: true,
      response:
        offDomainGuardrail.response ?? offDomainGuardrail.offDomainWarning,
      toolsCalled: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'deterministic',
        modelId: 'off-domain-guard',
        stepsExecuted: 0,
        durationMs,
        mode,
        ...buildSupervisorModeMetadata(modeDecision),
        ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
        offDomainAction: 'block',
        offDomainCategory: offDomainGuardrail.category,
      },
    };
  }

  // Off-domain warn: append warning and continue to LLM.
  if (offDomainGuardrail?.action === 'warn') {
    logger.info(
      { category: offDomainGuardrail.category },
      'Supervisor: off-domain detected, delegating to LLM with warning'
    );
  }
  const warningPrefix = Array.from(
    new Set(
      [
        request.securityWarning,
        request.offDomainWarning,
        offDomainGuardrail?.offDomainWarning,
      ].filter((warning): warning is string => Boolean(warning))
    )
  ).join('\n');

  const llmResult =
    mode === 'multi'
      ? await executeMultiAgentMode(
          runtimeRequest,
          startTime,
          modeDecision,
          runtimeMetadata,
          runtimeTools
        )
      : await executeSingleAgentMode(
          runtimeRequest,
          startTime,
          undefined,
          modeDecision,
          runtimeMetadata,
          runtimeTools
        );

  if (
    warningPrefix.length > 0 &&
    'response' in llmResult &&
    typeof llmResult.response === 'string'
  ) {
    const offDomainMetadata =
      offDomainGuardrail?.action === 'warn'
        ? buildOffDomainGuardrailMetadata(offDomainGuardrail)
        : {};
    return {
      ...llmResult,
      response: `${llmResult.response}\n\n---\n*${warningPrefix}*`,
      metadata: {
        ...llmResult.metadata,
        ...offDomainMetadata,
      },
    };
  }

  return llmResult;
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkSupervisorHealth(): Promise<SupervisorHealth> {
  try {
    const { provider, modelId } = getSupervisorModel();
    const runtimeHost = getDefaultDomainHost();
    const toolCount = Object.keys(
      runtimeHost.createToolSet({
        id: 'supervisor-health-check',
        domainId: runtimeHost.domain.id,
        message: 'health check',
        messages: [{ role: 'user', content: 'health check' }],
      })
    ).length;

    return {
      status: 'ok',
      provider,
      modelId,
      toolsAvailable: toolCount,
    };
  } catch {
    return {
      status: 'error',
      provider: 'none',
      modelId: 'none',
      toolsAvailable: 0,
    };
  }
}
