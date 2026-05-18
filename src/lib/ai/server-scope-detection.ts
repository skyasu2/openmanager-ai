import { getRegisteredServerIds } from '@/config/server-registry';

const REGISTERED_SERVER_IDS = getRegisteredServerIds().map((serverId) =>
  serverId.toLowerCase()
);

const SERVER_ID_LIKE_PATTERN =
  /\b(?:lb|web|api|db|cache|storage)-[a-z0-9]+(?:-[a-z0-9]+){0,4}\b/i;

const LEGACY_SERVER_ID_PATTERN = /\bserver-?\d+\b/i;

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
