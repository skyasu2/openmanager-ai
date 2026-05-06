import type {
  AssistantRequestContext,
  DomainDataSource,
  DomainHistoryEntry,
  DomainSnapshot,
} from '../../../core/assistant-runtime';
import { logger } from '../../../lib/logger';

export function createAgentDataSourceContext(params: {
  query: string;
  domainId?: string;
  sessionId?: string;
  traceId?: string;
}): AssistantRequestContext {
  return {
    requestId: params.traceId ?? `agent-data-source:${params.sessionId ?? 'default'}`,
    domainId: params.domainId ?? 'runtime-domain',
    message: params.query,
    messages: [{ role: 'user', content: params.query }],
    ...(params.sessionId && { sessionId: params.sessionId }),
    ...(params.traceId && { traceId: params.traceId }),
  };
}

export async function resolveDomainSnapshot(
  dataSource: DomainDataSource | undefined,
  context: AssistantRequestContext,
  label: string
): Promise<DomainSnapshot | undefined> {
  if (!dataSource) return undefined;

  try {
    return await dataSource.snapshot(context);
  } catch (error) {
    logger.warn(
      `[DomainDataSource] ${label} snapshot failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return undefined;
  }
}

export async function resolveDomainHistory(
  dataSource: DomainDataSource | undefined,
  count: number,
  context: AssistantRequestContext,
  label: string
): Promise<DomainHistoryEntry[]> {
  if (!dataSource) return [];

  try {
    return await dataSource.history(count, context);
  } catch (error) {
    logger.warn(
      `[DomainDataSource] ${label} history failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
