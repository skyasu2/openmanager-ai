import { describe, expect, it } from 'vitest';
import {
  LEGACY_NLQ_AGENT_NAME,
  METRICS_QUERY_AGENT_NAME,
  buildAgentNameLookupEntries,
  isMetricsQueryRuntimeName,
  normalizeAgentRuntimeName,
} from './agent-name-compat';

describe('agent name compatibility helpers', () => {
  it('normalizes the legacy NLQ Agent display name to Metrics Query Agent', () => {
    expect(normalizeAgentRuntimeName(LEGACY_NLQ_AGENT_NAME)).toBe(
      METRICS_QUERY_AGENT_NAME
    );
    expect(isMetricsQueryRuntimeName(LEGACY_NLQ_AGENT_NAME)).toBe(true);
    expect(isMetricsQueryRuntimeName(METRICS_QUERY_AGENT_NAME)).toBe(true);
  });

  it('builds canonical plus legacy lookup entries only for Metrics Query', () => {
    expect(buildAgentNameLookupEntries(METRICS_QUERY_AGENT_NAME, 1)).toEqual([
      [METRICS_QUERY_AGENT_NAME, 1],
      [LEGACY_NLQ_AGENT_NAME, 1],
    ]);
    expect(buildAgentNameLookupEntries('Analyst Agent', 2)).toEqual([
      ['Analyst Agent', 2],
    ]);
  });
});
