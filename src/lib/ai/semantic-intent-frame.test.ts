import { describe, expect, it } from 'vitest';
import {
  ENTITY_CONFIDENCE_THRESHOLD,
  type SemanticIntentFrame,
} from './entity-extractor';
import {
  buildSemanticIntentRequestMetadata,
  normalizeSemanticQueryTrace,
  toDomainIntentFrame,
} from './semantic-intent-frame';

const validPeakFrame: SemanticIntentFrame = {
  domain: 'monitoring',
  intent: 'metric_peak',
  scope: 'whole_fleet',
  targets: [],
  metric: 'load1',
  timeWindow: '24h',
  aggregation: 'peak',
  topN: 5,
  ambiguity: 'low',
  confidence: 91,
};

const validServerHealthFrame: SemanticIntentFrame = {
  domain: 'monitoring',
  intent: 'server_health',
  scope: 'whole_fleet',
  targets: [],
  metric: 'unknown',
  timeWindow: 'current',
  aggregation: 'summary',
  ambiguity: 'low',
  confidence: 88,
};

describe('semantic intent frame mapping', () => {
  it('uses the Phase 1 confidence threshold as the forwarding cutoff', () => {
    expect(ENTITY_CONFIDENCE_THRESHOLD).toBe(80);
  });

  it('maps a root monitoring peak frame into the Cloud Run domain frame contract', () => {
    expect(toDomainIntentFrame(validPeakFrame)).toEqual({
      intentFrame: {
        domainId: 'openmanager-monitoring',
        intent: 'metric_peak',
        capabilityId: 'monitoring.metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        topN: 5,
        ambiguity: 'low',
        confidence: 0.91,
      },
      reasonCodes: [],
    });
  });

  it('maps a root monitoring server health frame into the Cloud Run domain frame contract', () => {
    expect(toDomainIntentFrame(validServerHealthFrame)).toEqual({
      intentFrame: {
        domainId: 'openmanager-monitoring',
        intent: 'server_health',
        capabilityId: 'monitoring.server_health',
        scope: 'whole_fleet',
        targets: [],
        metric: 'unknown',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.88,
      },
      reasonCodes: [],
    });
  });

  it.each([
    [
      'semantic_frame_low_confidence',
      { ...validPeakFrame, confidence: ENTITY_CONFIDENCE_THRESHOLD - 1 },
    ],
    ['semantic_frame_high_ambiguity', { ...validPeakFrame, ambiguity: 'high' }],
    ['semantic_frame_unknown_domain', { ...validPeakFrame, domain: 'unknown' }],
    ['semantic_frame_unknown_intent', { ...validPeakFrame, intent: 'unknown' }],
  ] as const)('drops %s frames before Cloud Run forwarding', (reasonCode, frame) => {
    expect(toDomainIntentFrame(frame as SemanticIntentFrame)).toEqual({
      reasonCodes: [reasonCode],
    });
  });

  it('builds metadata only for valid frames and keeps drop reasons in trace metadata', () => {
    const validPayload = buildSemanticIntentRequestMetadata({
      frame: validPeakFrame,
      originalQuery: '최근 24시간 load1 피크 알려줘',
    });
    expect(validPayload.metadata).toEqual({
      intentFrame: expect.objectContaining({
        domainId: 'openmanager-monitoring',
        capabilityId: 'monitoring.metric_peak',
      }),
    });
    expect(validPayload.semanticQueryTrace).toMatchObject({
      originalQuery: '최근 24시간 load1 피크 알려줘',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      evidenceAvailable: false,
      clarificationRequired: false,
      reasonCodes: [],
    });

    const droppedPayload = buildSemanticIntentRequestMetadata({
      frame: { ...validPeakFrame, confidence: 79 },
      originalQuery: '최근 24시간 load1 피크 알려줘',
    });
    expect(droppedPayload.metadata).toBeUndefined();
    expect(droppedPayload.semanticQueryTrace).toMatchObject({
      reasonCodes: ['semantic_frame_low_confidence'],
      evidenceAvailable: false,
    });
  });

  it('normalizes backend semantic query traces with validated evidence reason codes', () => {
    expect(
      normalizeSemanticQueryTrace({
        originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        clarificationRequired: false,
        reasonCodes: ['semantic_frame_evidence_validated'],
      })
    ).toEqual({
      originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      selectedEvidenceProvider: 'monitoring-peak-metric',
      evidenceAvailable: true,
      clarificationRequired: false,
      reasonCodes: ['semantic_frame_evidence_validated'],
    });
  });
});
