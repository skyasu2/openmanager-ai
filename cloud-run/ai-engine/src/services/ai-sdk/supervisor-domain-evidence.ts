import type {
  AssistantDomain,
  AssistantRequestContext,
  DomainCapability,
  DomainEvidenceRequest,
  DomainEvidenceResult,
  DomainIntentAmbiguity,
  DomainIntentFrame,
  DomainIntentScope,
} from '../../core/assistant-runtime';
import { logger } from '../../lib/logger';
import type { SupervisorRequest } from './supervisor-types';
import {
  normalizeSemanticQueryTrace,
  type SemanticQueryTrace,
} from './supervisor-semantic-metadata';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .map(readString)
    .filter((item): item is string => item !== undefined);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function isDomainIntentScope(value: string): value is DomainIntentScope {
  return ['whole_fleet', 'entity', 'group', 'unknown'].includes(value);
}

function isDomainIntentAmbiguity(
  value: string
): value is DomainIntentAmbiguity {
  return ['low', 'medium', 'high'].includes(value);
}

function readIntentFrame(value: unknown): DomainIntentFrame | undefined {
  if (!isRecord(value)) return undefined;

  const domainId = readString(value.domainId);
  const intent = readString(value.intent);
  const scope = readString(value.scope);
  const targets = readStringArray(value.targets);
  const ambiguity = readString(value.ambiguity);
  const confidence = readFiniteNumber(value.confidence);
  const capabilityId = readString(value.capabilityId);
  const metric = readString(value.metric);
  const timeWindow = readString(value.timeWindow);
  const aggregation = readString(value.aggregation);
  const topN = readFiniteNumber(value.topN);

  if (
    !domainId ||
    !intent ||
    !scope ||
    !isDomainIntentScope(scope) ||
    targets === undefined ||
    !ambiguity ||
    !isDomainIntentAmbiguity(ambiguity) ||
    confidence === undefined
  ) {
    return undefined;
  }

  return {
    domainId,
    intent,
    scope,
    targets,
    ambiguity,
    confidence,
    ...(capabilityId && { capabilityId }),
    ...(metric && { metric }),
    ...(timeWindow && { timeWindow }),
    ...(aggregation && { aggregation }),
    ...(topN !== undefined && { topN }),
    ...(isRecord(value.slots) && { slots: value.slots }),
  };
}

async function resolveIntentFrame(params: {
  domain: AssistantDomain;
  context: AssistantRequestContext;
}): Promise<DomainIntentFrame | undefined> {
  const metadataFrame = readIntentFrame(params.context.metadata?.intentFrame);
  if (metadataFrame?.domainId === params.domain.id) return metadataFrame;

  try {
    const parsedFrame = await params.domain.intentParser?.parse(params.context);
    return parsedFrame?.domainId === params.domain.id ? parsedFrame : undefined;
  } catch {
    return undefined;
  }
}

function resolveCapability(params: {
  domain: AssistantDomain;
  frame?: DomainIntentFrame;
}): DomainCapability | undefined {
  const frame = params.frame;
  if (!frame || frame.domainId !== params.domain.id) return undefined;

  const capabilities = params.domain.capabilities?.capabilities ?? [];
  if (capabilities.length === 0) return undefined;

  if (frame.capabilityId) {
    return capabilities.find((capability) => capability.id === frame.capabilityId);
  }

  const matches = capabilities.filter((capability) =>
    capability.intents.includes(frame.intent)
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function createEvidenceContext(params: {
  query: string;
  domain: AssistantDomain;
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}): AssistantRequestContext {
  return {
    requestId: params.traceId ?? `domain-evidence:${params.sessionId ?? 'default'}`,
    domainId: params.domain.id,
    message: params.query,
    messages: [{ role: 'user', content: params.query }],
    ...(params.sessionId && { sessionId: params.sessionId }),
    ...(params.traceId && { traceId: params.traceId }),
    ...(params.metadata && { metadata: params.metadata }),
  };
}

function validateDomainEvidenceResult(
  evidence: DomainEvidenceResult
): { valid: boolean; reasonCodes: string[] } {
  const reasonCodes: string[] = [];
  if (evidence.prompt.trim().length === 0) {
    reasonCodes.push('evidence_prompt_empty');
  }
  if (evidence.fallback.trim().length === 0) {
    reasonCodes.push('evidence_fallback_empty');
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes,
  };
}

function buildValidatedSemanticQueryTrace(params: {
  context: DomainEvidenceRequest;
  domain: AssistantDomain;
  capability?: DomainCapability;
  evidence: DomainEvidenceResult;
  providerId: string;
}): SemanticQueryTrace | undefined {
  const baseTrace = normalizeSemanticQueryTrace(
    params.context.metadata?.semanticQueryTrace
  );
  const intentFrame = params.context.intentFrame;
  const evidenceCapabilityId = readString(
    params.evidence.metadata?.capabilityId
  );

  const selectedDomain =
    baseTrace?.selectedDomain ?? intentFrame?.domainId ?? params.domain.id;
  const selectedCapability =
    baseTrace?.selectedCapability ??
    params.capability?.id ??
    intentFrame?.capabilityId ??
    evidenceCapabilityId;
  const reasonCodes = new Set(baseTrace?.reasonCodes ?? []);
  if (!baseTrace && !intentFrame) {
    reasonCodes.add('semantic_frame_raw_fallback_used');
  }
  if (
    intentFrame?.capabilityId &&
    params.evidence.metadata?.capabilityId !== intentFrame.capabilityId
  ) {
    reasonCodes.add('semantic_frame_raw_fallback_used');
  }
  reasonCodes.add('semantic_frame_evidence_validated');

  return {
    originalQuery: baseTrace?.originalQuery ?? params.context.message,
    ...(selectedDomain && { selectedDomain }),
    ...(selectedCapability && { selectedCapability }),
    selectedEvidenceProvider: params.providerId,
    evidenceAvailable: true,
    clarificationRequired: false,
    reasonCodes: Array.from(reasonCodes),
  };
}

function attachSemanticQueryTrace(
  evidence: DomainEvidenceResult,
  semanticQueryTrace: SemanticQueryTrace | undefined
): DomainEvidenceResult {
  if (!semanticQueryTrace) return evidence;

  return {
    ...evidence,
    metadata: {
      ...(evidence.metadata ?? {}),
      semanticQueryTrace,
    },
  };
}

function logSemanticEvidenceValidated(params: {
  context: DomainEvidenceRequest;
  semanticQueryTrace: SemanticQueryTrace | undefined;
}) {
  if (!params.semanticQueryTrace) return;

  logger.info(
    {
      originalQuery: params.semanticQueryTrace.originalQuery,
      selectedDomain: params.semanticQueryTrace.selectedDomain,
      selectedCapability: params.semanticQueryTrace.selectedCapability,
      selectedEvidenceProvider:
        params.semanticQueryTrace.selectedEvidenceProvider,
      evidenceAvailable: params.semanticQueryTrace.evidenceAvailable,
      reasonCodes: params.semanticQueryTrace.reasonCodes,
      traceId: params.context.traceId,
    },
    '[DomainEvidence] semantic evidence validated'
  );
}

function logSemanticProviderMiss(params: {
  context: DomainEvidenceRequest;
  domain: AssistantDomain;
  capability?: DomainCapability;
}) {
  const baseTrace = normalizeSemanticQueryTrace(
    params.context.metadata?.semanticQueryTrace
  );
  const intentFrame = params.context.intentFrame;
  if (!baseTrace && !intentFrame) return;

  logger.info(
    {
      originalQuery: baseTrace?.originalQuery ?? params.context.message,
      selectedDomain:
        baseTrace?.selectedDomain ?? intentFrame?.domainId ?? params.domain.id,
      selectedCapability:
        baseTrace?.selectedCapability ??
        params.capability?.id ??
        intentFrame?.capabilityId,
      reasonCodes: ['semantic_frame_provider_miss'],
    },
    '[DomainEvidence] semantic frame provider miss; continuing with general stream path'
  );
}

export async function resolveDomainEvidenceSupport(params: {
  query: string;
  domain: AssistantDomain;
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<DomainEvidenceResult | null> {
  const providers = params.domain.evidenceProviders ?? [];
  if (providers.length === 0) return null;

  const baseContext = createEvidenceContext(params);
  const intentFrame = await resolveIntentFrame({
    domain: params.domain,
    context: baseContext,
  });
  const capability = resolveCapability({
    domain: params.domain,
    frame: intentFrame,
  });

  const context: DomainEvidenceRequest = {
    ...baseContext,
    ...(params.domain.dataSource && { dataSource: params.domain.dataSource }),
    ...(intentFrame && { intentFrame }),
    ...(capability && { capability }),
  };

  for (const provider of providers) {
    if (!provider.canHandle(context)) continue;
    const evidence = await provider.resolve(context);
    if (!evidence) continue;

    const validation = validateDomainEvidenceResult(evidence);
    if (!validation.valid) continue;

    const semanticQueryTrace = buildValidatedSemanticQueryTrace({
      context,
      domain: params.domain,
      capability,
      evidence,
      providerId: provider.id,
    });
    logSemanticEvidenceValidated({ context, semanticQueryTrace });

    return attachSemanticQueryTrace(evidence, semanticQueryTrace);
  }

  logSemanticProviderMiss({
    context,
    domain: params.domain,
    capability,
  });

  return null;
}

export function resolveDomainEvidenceForStream(params: {
  request: SupervisorRequest;
  query: string;
  domain: AssistantDomain;
}): Promise<DomainEvidenceResult | null> {
  return resolveDomainEvidenceSupport({
    query: params.query,
    domain: params.domain,
    sessionId: params.request.sessionId,
    traceId: params.request.traceId,
    metadata: params.request.metadata,
  });
}
