import { describe, expect, it } from 'vitest';
import {
  normalizeSupervisorSemanticMetadata,
  type SemanticQueryTrace,
} from './supervisor-semantic-metadata';

const validIntentFrame = {
  domainId: 'openmanager-monitoring',
  intent: 'metric_peak',
  capabilityId: 'monitoring.metric_peak',
  scope: 'whole_fleet',
  targets: [],
  metric: 'load1',
  timeWindow: '24h',
  aggregation: 'peak',
  ambiguity: 'low',
  confidence: 0.91,
};

describe('normalizeSupervisorSemanticMetadata', () => {
  it('keeps valid intent frames and semantic query trace payloads', () => {
    const trace: SemanticQueryTrace = {
      originalQuery: '최근 24시간 load1 피크 알려줘',
      evidenceAvailable: false,
      clarificationRequired: false,
      reasonCodes: [],
    };

    expect(
      normalizeSupervisorSemanticMetadata({
        metadata: { intentFrame: validIntentFrame },
        semanticQueryTrace: trace,
      })
    ).toEqual({
      metadata: {
        intentFrame: validIntentFrame,
        semanticQueryTrace: trace,
      },
      reasonCodes: [],
    });
  });

  it('drops invalid metadata frames and records the invalid-frame reason', () => {
    expect(
      normalizeSupervisorSemanticMetadata({
        metadata: {
          intentFrame: {
            ...validIntentFrame,
            scope: 'server',
            targets: 'api-was-dc1-01',
          },
        },
      })
    ).toEqual({
      reasonCodes: ['semantic_frame_invalid'],
    });
  });
});
