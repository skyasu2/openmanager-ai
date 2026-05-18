import { describe, expect, it } from 'vitest';
import type {
  AssistantInputType,
  DomainIntentFrame,
} from '../../../core/assistant-runtime';
import {
  DEFAULT_DIRECT_ROUTING_AGENT,
  resolveDirectRoutingTarget,
} from './orchestrator-direct-routing';
import type { PreFilterResult } from './orchestrator-types';

const fallbackPreFilter: PreFilterResult = {
  shouldHandoff: true,
  suggestedAgent: DEFAULT_DIRECT_ROUTING_AGENT,
  confidence: 0.86,
};

function frame(
  overrides: Partial<DomainIntentFrame> = {}
): DomainIntentFrame {
  return {
    domainId: 'openmanager-monitoring',
    intent: 'metric_current',
    capabilityId: 'monitoring.metric_current',
    scope: 'whole_fleet',
    targets: [],
    metric: 'cpu',
    timeWindow: 'current',
    aggregation: 'summary',
    ambiguity: 'low',
    executionMode: 'single',
    confidence: 0.92,
    ...overrides,
  };
}

describe('resolveDirectRoutingTarget', () => {
  it.each([
    ['monitoring.incident_report', 'incident_report', 'Reporter Agent'],
    ['monitoring.ops_advice', 'ops_advice', 'Advisor Agent'],
    ['monitoring.root_cause', 'root_cause', 'Analyst Agent'],
    ['monitoring.log_analysis', 'log_analysis', 'Analyst Agent'],
    ['monitoring.metric_trend', 'metric_trend', 'Analyst Agent'],
    ['monitoring.anomaly_detection', 'anomaly_detection', 'Analyst Agent'],
    ['monitoring.anomaly_prediction', 'anomaly_prediction', 'Analyst Agent'],
    ['monitoring.capacity_forecast', 'capacity_forecast', 'Analyst Agent'],
    ['monitoring.failure_risk', 'failure_risk', 'Analyst Agent'],
    ['monitoring.metric_current', 'metric_current', 'Metrics Query Agent'],
  ] as const)(
    'uses high-confidence semantic frame %s before regex fallback',
    (capabilityId, intent, expectedAgent) => {
      expect(
        resolveDirectRoutingTarget(fallbackPreFilter, {
          intentFrame: frame({ capabilityId, intent }),
        })
      ).toMatchObject({
        agentName: expectedAgent,
        source: 'semantic_frame',
        confidence: 0.92,
      });
    }
  );

  it.each(['log_paste', 'mixed'] as const satisfies AssistantInputType[])(
    'routes %s inputs to Analyst when no semantic agent hint exists',
    (inputType) => {
      expect(
        resolveDirectRoutingTarget(
          { shouldHandoff: true, confidence: 0.5 },
          { inputType }
        )
      ).toMatchObject({
        agentName: 'Analyst Agent',
        source: 'input_type',
      });
    }
  );

  it('keeps pre-filter when semantic frame confidence is too low', () => {
    expect(
      resolveDirectRoutingTarget(fallbackPreFilter, {
        intentFrame: frame({
          capabilityId: 'monitoring.incident_report',
          intent: 'incident_report',
          confidence: 0.5,
        }),
      })
    ).toMatchObject({
      agentName: DEFAULT_DIRECT_ROUTING_AGENT,
      source: 'pre_filter',
    });
  });
});
