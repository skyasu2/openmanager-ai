export const SERVER_TYPE_PREFIXES = [
  'api',
  'web',
  'db',
  'cache',
  'storage',
  'lb',
  'monitoring',
  'batch',
  'worker',
] as const;

function escapeRegexSource(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createServerIdPattern(
  prefixes: readonly string[] = SERVER_TYPE_PREFIXES
): RegExp {
  const source = prefixes.map(escapeRegexSource).join('|');
  return new RegExp(`\\b((?:${source})-[a-z0-9]+(?:-[a-z0-9]+)*)\\b`, 'i');
}
