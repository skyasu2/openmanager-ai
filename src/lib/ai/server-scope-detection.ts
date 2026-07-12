import { getRegisteredServerIds } from '@/config/server-registry';

const REGISTERED_SERVER_IDS = getRegisteredServerIds().map((serverId) =>
  serverId.toLowerCase()
);

const SERVER_ID_LIKE_PATTERN =
  /\b(?:lb|web|api|db|cache|storage)-[a-z0-9]+(?:-[a-z0-9]+){0,4}\b/i;

const LEGACY_SERVER_ID_PATTERN = /\bserver-?\d+\b/i;

const CONTEXTUAL_SERVER_REFERENCE_PATTERN =
  /방금|직전|이전|앞서|위\s*(?:결과|답변|내용)|방금\s*분석한|분석한\s*서버\s*중|방금\s*본|앞에서\s*본|그\s*중|그중|이\s*중|이중|해당\s*목록\s*중|(?<![가-힣A-Za-z0-9])(?:그|해당|이|위)\s*(?:서버|대상|호스트|노드)\s*(?:들|중|만|의)?/i;

/**
 * Returns true when the query names a concrete server rather than a broad group.
 * Uses the static registry first, then falls back to the known OpenManager
 * server-id shape so newly added hosts still skip scope clarification.
 */
export function hasExplicitServerReference(query: string): boolean {
  const normalized = query.toLowerCase();

  return (
    REGISTERED_SERVER_IDS.some((serverId) => normalized.includes(serverId)) ||
    SERVER_ID_LIKE_PATTERN.test(query) ||
    LEGACY_SERVER_ID_PATTERN.test(query)
  );
}

export function hasContextualServerReference(query: string): boolean {
  return CONTEXTUAL_SERVER_REFERENCE_PATTERN.test(query);
}
