export const METRICS_QUERY_AGENT_NAME = 'Metrics Query Agent' as const;
export const LEGACY_NLQ_AGENT_NAME = 'NLQ Agent' as const;
export const METRICS_QUERY_AGENT_TYPE = 'nlq' as const;

const LEGACY_AGENT_NAME_ALIASES: Record<string, string> = {
  [LEGACY_NLQ_AGENT_NAME]: METRICS_QUERY_AGENT_NAME,
};

export function normalizeAgentRuntimeName(name: string): string {
  return LEGACY_AGENT_NAME_ALIASES[name] ?? name;
}

export function isMetricsQueryRuntimeName(name: string): boolean {
  return normalizeAgentRuntimeName(name) === METRICS_QUERY_AGENT_NAME;
}

export function buildAgentNameLookupEntries<T>(
  canonicalName: string,
  value: T
): Array<[string, T]> {
  const entries: Array<[string, T]> = [[canonicalName, value]];

  if (canonicalName === METRICS_QUERY_AGENT_NAME) {
    entries.push([LEGACY_NLQ_AGENT_NAME, value]);
  }

  return entries;
}
