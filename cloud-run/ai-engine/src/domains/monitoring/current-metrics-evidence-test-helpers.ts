import { MONITORING_DOMAIN_ID } from './constants';
import { monitoringDomainDataSource } from './domain-pack';

export function createEvidenceRequest(
  message: string,
  data?: unknown,
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  return {
    requestId: 'current-metrics-evidence-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: messages ?? [{ role: 'user' as const, content: message }],
    dataSource: data
      ? {
          async snapshot() {
            return {
              timestamp: '2026-05-14T12:00:00+09:00',
              data,
            };
          },
        }
      : monitoringDomainDataSource,
  };
}
