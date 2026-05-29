import type {
  AssistantMessage,
  AssistantRequestContext,
  DomainDataSource,
  DomainHistoryEntry,
  DomainSnapshot,
} from '../../../core/assistant-runtime';
import { logger } from '../../../lib/logger';

/**
 * 대화 히스토리에서 evidence 컨텍스트용 messages 배열을 구성한다.
 *
 * 팔로업 대명사 해석("방금 분석한 서버 중 …")은 이전 assistant 응답에 등장한
 * 서버 ID를 추출해야 하므로 현재 쿼리만이 아니라 직전 turn까지 보존해야 한다.
 * 히스토리가 없으면 기존 동작(현재 쿼리만)으로 안전하게 폴백한다.
 */
function buildContextMessages(
  query: string,
  conversationMessages?: AssistantMessage[]
): AssistantMessage[] {
  if (conversationMessages && conversationMessages.length > 0) {
    return conversationMessages;
  }
  return [{ role: 'user', content: query }];
}

export function createAgentDataSourceContext(params: {
  query: string;
  domainId?: string;
  sessionId?: string;
  traceId?: string;
  conversationMessages?: AssistantMessage[];
}): AssistantRequestContext {
  return {
    requestId: params.traceId ?? `agent-data-source:${params.sessionId ?? 'default'}`,
    domainId: params.domainId ?? 'runtime-domain',
    message: params.query,
    messages: buildContextMessages(params.query, params.conversationMessages),
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
