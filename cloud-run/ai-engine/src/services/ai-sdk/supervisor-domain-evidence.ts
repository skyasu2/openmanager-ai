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
import type { SupervisorRequest } from './supervisor-types';

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
    if (evidence) return evidence;
  }

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
  });
}
