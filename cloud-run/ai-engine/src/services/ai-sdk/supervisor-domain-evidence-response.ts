import type { DomainEvidenceResult } from '../../core/assistant-runtime';
import type { IntentCategory } from '../../domains/monitoring/routing-policy';

export function getResponseQualityAgentName(intent: IntentCategory): string {
  switch (intent) {
    case 'metrics':
    case 'serverGroup':
      return 'Metrics Query Agent';
    case 'anomaly':
    case 'prediction':
    case 'rca':
      return 'Analyst Agent';
    case 'advisor':
      return 'Advisor Agent';
    default:
      return 'Supervisor';
  }
}

export function shouldUseDeterministicDomainEvidenceAnswer(
  domainEvidence: DomainEvidenceResult | undefined
): boolean {
  return [
    'deterministic_answer',
    'deterministic_clarification',
    'deterministic_read_only_advice',
    'deterministic_fail_closed',
  ].includes(String(domainEvidence?.metadata?.responsePolicy ?? ''));
}

export function buildDomainEvidenceMetadata(
  domainEvidence: DomainEvidenceResult
) {
  return {
    id: domainEvidence.id,
    responsePolicy: domainEvidence.metadata?.responsePolicy,
    capabilityId: domainEvidence.metadata?.capabilityId,
    intent: domainEvidence.metadata?.intent,
  };
}
