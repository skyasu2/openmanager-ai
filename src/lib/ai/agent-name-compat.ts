export const METRICS_QUERY_AGENT_NAME = 'Metrics Query Agent';
export const LEGACY_NLQ_AGENT_NAME = 'NLQ Agent';

const LEGACY_AGENT_NAME_ALIASES: Record<string, string> = {
  [LEGACY_NLQ_AGENT_NAME]: METRICS_QUERY_AGENT_NAME,
};

export function normalizeAgentDisplayName(
  agent?: string | null
): string | null {
  if (!agent) {
    return null;
  }

  return LEGACY_AGENT_NAME_ALIASES[agent] ?? agent;
}
