import type {
  AssistantDomain,
  AssistantRequestContext,
  DomainEvidenceRequest,
  DomainEvidenceResult,
} from '../../core/assistant-runtime';
import type { SupervisorRequest } from './supervisor-types';

function createEvidenceContext(params: {
  query: string;
  domain: AssistantDomain;
  sessionId?: string;
  traceId?: string;
}): AssistantRequestContext {
  return {
    requestId: params.traceId ?? `domain-evidence:${params.sessionId ?? 'default'}`,
    domainId: params.domain.id,
    message: params.query,
    messages: [{ role: 'user', content: params.query }],
    ...(params.sessionId && { sessionId: params.sessionId }),
    ...(params.traceId && { traceId: params.traceId }),
  };
}

export async function resolveDomainEvidenceSupport(params: {
  query: string;
  domain: AssistantDomain;
  sessionId?: string;
  traceId?: string;
}): Promise<DomainEvidenceResult | null> {
  const providers = params.domain.evidenceProviders ?? [];
  if (providers.length === 0) return null;

  const context: DomainEvidenceRequest = {
    ...createEvidenceContext(params),
    ...(params.domain.dataSource && { dataSource: params.domain.dataSource }),
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
