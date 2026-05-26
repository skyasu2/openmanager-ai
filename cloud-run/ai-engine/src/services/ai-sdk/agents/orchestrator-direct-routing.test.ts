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

  it('ignores semantic keys that only contain a known intent as a substring', () => {
    expect(
      resolveDirectRoutingTarget(fallbackPreFilter, {
        intentFrame: frame({
          capabilityId: 'monitoring.not_incident_report',
          intent: 'incident_report_bypass',
          confidence: 0.93,
        }),
      })
    ).toMatchObject({
      agentName: DEFAULT_DIRECT_ROUTING_AGENT,
      source: 'pre_filter',
    });
  });

  it('keeps explicit remediation queries on Advisor before semantic anomaly routing', () => {
    expect(
      resolveDirectRoutingTarget(
        {
          shouldHandoff: true,
          suggestedAgent: 'Advisor Agent',
          confidence: 0.9,
        },
        {
          intentFrame: frame({
            capabilityId: 'monitoring.anomaly_detection',
            intent: 'anomaly_detection',
            confidence: 0.93,
          }),
        }
      )
    ).toMatchObject({
      agentName: 'Advisor Agent',
      source: 'pre_filter',
      reason: 'Direct routing (explicit remediation pre-filter)',
    });
  });

  it('keeps single-server operational advice on Advisor before metric semantic routing', () => {
    expect(
      resolveDirectRoutingTarget(
        {
          shouldHandoff: true,
          suggestedAgent: 'Advisor Agent',
          confidence: 0.87,
        },
        {
          intentFrame: frame({
            capabilityId: 'monitoring.metric_ranking',
            intent: 'metric_ranking',
            scope: 'entity',
            targets: ['db-mysql-dc1-primary'],
            metric: 'disk',
            aggregation: 'top_n',
            executionMode: 'single',
            confidence: 0.93,
          }),
        }
      )
    ).toMatchObject({
      agentName: 'Advisor Agent',
      source: 'pre_filter',
      reason: 'Direct routing (explicit remediation pre-filter)',
    });
  });

  it('keeps broad metric ranking on semantic routing even with advisory wording', () => {
    expect(
      resolveDirectRoutingTarget(
        {
          shouldHandoff: true,
          suggestedAgent: 'Advisor Agent',
          confidence: 0.87,
        },
        {
          intentFrame: frame({
            capabilityId: 'monitoring.metric_ranking',
            intent: 'metric_ranking',
            scope: 'whole_fleet',
            targets: [],
            metric: 'cpu',
            aggregation: 'top_n',
            executionMode: 'single',
            confidence: 0.93,
          }),
        }
      )
    ).toMatchObject({
      agentName: 'Metrics Query Agent',
      source: 'semantic_frame',
    });
  });

  it('keeps explicit RCA questions on Analyst before current-metric semantic routing', () => {
    expect(
      resolveDirectRoutingTarget(
        {
          shouldHandoff: true,
          suggestedAgent: 'Analyst Agent',
          confidence: 0.88,
        },
        {
          intentFrame: frame({
            capabilityId: 'monitoring.metric_current',
            intent: 'metric_current',
            scope: 'entity',
            targets: ['lb-haproxy-dc1-01'],
            metric: 'cpu',
            aggregation: 'summary',
            executionMode: 'single',
            confidence: 0.93,
          }),
        }
      )
    ).toMatchObject({
      agentName: 'Analyst Agent',
      source: 'pre_filter',
      reason: 'Direct routing (explicit RCA pre-filter)',
    });
  });

  it('preserves peak-metric semantic routing even when the wording asks for cause candidates', () => {
    expect(
      resolveDirectRoutingTarget(
        {
          shouldHandoff: true,
          suggestedAgent: 'Analyst Agent',
          confidence: 0.88,
        },
        {
          intentFrame: frame({
            capabilityId: 'monitoring.metric_peak',
            intent: 'metric_peak',
            scope: 'whole_fleet',
            targets: [],
            metric: 'load1',
            timeWindow: '24h',
            aggregation: 'peak',
            executionMode: 'single',
            confidence: 0.93,
          }),
        }
      )
    ).toMatchObject({
      agentName: 'Metrics Query Agent',
      source: 'semantic_frame',
    });
  });
});
